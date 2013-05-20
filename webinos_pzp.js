#!/usr/bin/env node
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
 *******************************************************************************/

var Pzp = require ("./lib/pzp");
var PzpSession = require("./lib/pzp_sessionHandling.js");
__EnablePolicyEditor = false;

var argv = require ('optimist')
    .usage ('Starts webinos PZP \nUsage: $0')
    .options ({
        "pzhHost"         :{
            describe:"set the ip-address of the pzh provider",
            default :"0.0.0.0"
        },
        "pzhName"         :{
            describe:"sets The email id of the pzh you intend to connect",
            default :""
        },
        "friendlyName"    :{
            describe:"sets the name assigned to the PZP such as PC/Mobile/TV",
            default :""
        },
        "forcedDeviceName":{
            describe:"Forced PZP device name that you assign instead of the default PZP name",
            default :""
        },
        "widgetServer"    :{
            describe:"starts widget server",
            default :false
        },
        "policyEditor"    :{
            describe:"starts policy editor server",
            default :false
        },
        "signedWidgetOnly":{
            describe:"only allow signed widgets",
            default :false
        },
        "enforceWidgetCSP":{
            describe:"enforce content security policy on the widgets",
            default :false
        },
        "test":{
            describe:"start the PZP and exit if it loaded successfully.  Useful for testing the build",
            default :false
        },
        "help"            :{
            describe:"to get this help menu"
        }})
    .argv;

if (argv.help) {
    require ('optimist').showHelp ();
    process.exit ();
}
if (argv.policyEditor) {
    __EnablePolicyEditor = true;
}

require ("fs").readFile (require ("path").join (__dirname, "config-pzp.json"), function (err, data) {
    var config = {};
    if (!err) {
        config = JSON.parse (data);
    }

    // overwrite config file options with cli options
    config = require ('webinos-utilities').webinosHelpers.extend (config, argv);

    if (config.pzhName !== "") {
        config.sessionIdentity = config.pzhHost + '/' + config.pzhName;
    } else {
        config.sessionIdentity = config.pzhHost;
    }
    initializePzp (config);
});

function initializeWidgetServer () {
    // Widget manager server
    var wrt;
    try {
        wrt = require ("webinos-widget").widgetServer;
    } catch(err) {
        console.log("Webinos widget is missing");
    }

    if (wrt) {
        // Attempt to start the widget server.
        wrt.start (argv.signedWidgetOnly, argv.enforceWidgetCSP, Pzp.session.getWebinosPorts().pzp_webSocket,
            function (msg, wrtPort) {
                if (msg === "startedWRT") {
                    // Write the websocket and widget server ports to file so the renderer can pick them up.
                    var wrtConfig = {};
                    wrtConfig.runtimeWebServerPort = wrtPort;
                    wrtConfig.pzpWebSocketPort = Pzp.session.getWebinosPorts ().pzp_webSocket;
                    wrtConfig.pzpPath = Pzp.session.getWebinosPath ();
                    require ("fs").writeFile ((require ("path").join (Pzp.session.getWebinosPath (), '../wrt/webinos_runtime.json')),
                        JSON.stringify (wrtConfig, null, ' '), function (err) {
                            if (err) {
                                console.log ('error saving runtime configuration file: ' + err);
                            } else {
                                console.log ('saved configuration runtime file');
                            }
                        });
                } else {
                    console.log ('error starting wrt server: ' + msg);
                }
            });
    }
}
function startPzp() {
    var pzpInstance = PzpSession.getInstance();
    pzpInstance.on("PZP_STARTED", function(){
        testStart(true);
        if (argv.widgetServer) initializeWidgetServer ();
    });
    pzpInstance.on("PZP_START_FAILED", function(errDetails){
        console.log(errDetails);
        testStart(false);
    });

}
function ask(name) {
    process.stdin.resume();
    logger.log("change value - " + name);
    process.stdin.once("data", function(data){
        var response = data.toString().trim().toLowerCase();
        if (isNumeric(response)){

        }
    })
}
function initializePzp (config) {
   // Add a command line option to configure ports
  /*if (!Pzp.session.getPzpConfigurationStatus()) { // PZP is not configured .. Reconfigure it
      if (process.stdout.isTTY && process.stdin.isTTY) {
          logger.log("Welcome to Webinos PZP","Current used ports by PZP are ", require("config.json").ports);
          process.stdin.resume()
          logger.log("Do you wish to change these ports? (Y/N): ");
          process.stdin.once('data', function(data){
             var response = data.toString().trim().toLowerCase();
             if (response === "y") {
                 require("config.json").ports.forEach(function(name){
                    ask(name);
                 });
                 Pzp.session.setInputConfig(config);
             } else {
                 Pzp.session.setInputConfig(config);
             }
             startPzp();
          });
      } else {
          startPzp();
      }
   }    */
    PzpSession.setInputConfig(config);
    startPzp();
}

/* This function is only relevant when the --test switch is passed to
 * the webinos_pzp.js script.
 */
function testStart(hasStarted) {
  if (argv.test) {
    if (hasStarted) {
      console.log("Started successfully.  This is a test, so the process is now exiting");
      process.exit(0);
    } else {
      console.log("The PZP did not start successfully.  Ending.");
      process.exit(-1);
    }
  }
}


