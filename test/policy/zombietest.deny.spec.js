/*******************************************************************************
*  Code contributed to the webinos project
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*
* Copyright 2013 John Lyle, University of Oxford
*******************************************************************************/

var Browser = require("zombie");
var assert = require("assert");
var util = require('util');

var testPath = "test/policy/testdeny.html"
var testURL = "file://" + process.cwd() + "/" + testPath;

console.log("Testing " + testURL);

function waitFor(window) {
  var res = window.document.getElementById("testResult").innerText.indexOf("Test in progress");
  console.log("Testing: " + window.document.getElementById("testResult").innerText + ", === " + res);
  return ( res < 0 );
}
  
Browser.debug = false;
Browser.silent = true;

browser = new Browser()

browser.visit(testURL).then(function() {
  setTimeout(function() {
    var result = JSON.stringify(browser.text("#testResult"));
    if ( result.indexOf("Failed:") >= 0 && result.indexOf("SecurityError") >= 0 ) {
      console.log("Successfully failed to connect");
      process.exit(0);
    } else {
      console.log()
      console.log("Test failed - " + result + " - " + browser.window.console.output);
      process.exit(-1000);
    }

  }, 5000);
});


