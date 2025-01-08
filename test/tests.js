const whichBin = require('../whichBin.js');

var assert = require('assert');

describe('Council Endpoint', function () {
  it('Should return successful bin type', async function () {
      var result = await whichBin.getNextBinType();
      assert.equal(result, 'organic'); 
  });
});
