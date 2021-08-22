//
// Simple node.js application to retrieve the bin day and next bin type for a given 
// household.
//

const https = require('https')

var today = new Date();
let nextBin = '';

function selectNext(data) { 
  // Recursively loop through the elements of the array to find first event in the future.
  // Note: Currently no validation on the input data.
  // Inputs: data - JSON array containing objects with elements: start, event_type 

  var current = data[0];
  var currentDate = new Date(current.start);

    if (currentDate > today) {
        return current.event_type;
    } else {
      data.shift();
      return selectNext(data);
    }
} 

function addDays(date, days) {
  // Add the specified nunber of days to the given date

  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}


//
// Main
//

let startDate = new Date().toISOString().replace(/T.+/, '');
let endDate = addDays(startDate, 14).toISOString().replace(/T.+/, '');
let path = '/api/v1/properties/869759.json?start=' + startDate + '&end=' + endDate;

const options = {
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

const req = https.request(options, res => {

  let chunks = [];

  // data may not come all at once.  Need to capture it all.
  res.on('data', function(data) {
    chunks.push(data);
  }).on('end', function() {
      if (res.statusCode !== 200) {  console.log(`statusCode: ${res.statusCode}`) }
      
      let data   = Buffer.concat(chunks);
      body = JSON.parse(data);
      console.log("BODY: " + body);
      nextBin = selectNext(body);
      console.log(nextBin);
    })
}) 

req.on('error', error => {
  console.error(error)
})

req.end()
