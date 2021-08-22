//
// Simple node.js application to retrieve the bin day and next bin type for a given 
// household.
//
const https = require('https');

var today = new Date();
let nextBin = '';


// Recursively loop through the elements of the array to find first event in the future.
// Note: Currently no validation on the input data.
// Inputs: data - JSON array containing objects with elements: start, event_type 
function selectNext(data) { 
  var current = data[0];
  var currentDate = new Date(current.start);

  if (currentDate > today) {
      return current.event_type;
  } else {
    data.shift();
    return selectNext(data);
  }
} 

// Add the specified number of days to the given date
// Inputs: date - Specific Date; days - number of days to add
function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

//
// Get the next bin type (organic | recycle)
function getNextBinType() {
  let startDate = new Date().toISOString().replace(/T.+/, '');
  let endDate = addDays(startDate, 14).toISOString().replace(/T.+/, '');
  let path = '/api/v1/properties/869759.json?start=' + startDate + '&end=' + endDate;

  const connOptions = {
    hostname: 'brisbane.waste-info.com.au',
    port: 443,
    path: path,
    method: 'GET',
    headers: {
      'Connection': 'keep-alive',
      'Host': 'brisbane.waste-info.com.au',
      'Accept': 'application/json, text/plain, */*',
      'Content-Type' : 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36'
      }
  }

  return new Promise(function (resolve, reject) {

    const req = https.request(connOptions, res => {
    
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error('statusCode=' + res.statusCode));
      }

      let body = [];
      res.on('data', function(data) {
        body.push(data);
      })
      
      res.on('end', function() {
        body = JSON.parse(Buffer.concat(body).toString());
        nextBin = selectNext(body);
        resolve(nextBin);
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.end();
  });
}

//
// Main Code
//

getNextBinType()
.then(function(binType) {
  var binIndex = (binType == 'organic') ? 1 : 0;  
  console.log("Type: " + binType);
  console.log("value [" + binIndex + "]");

  return binIndex;
})
.catch(function(error) {console.log("ERROR:" + error)});
