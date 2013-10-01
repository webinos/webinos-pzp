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
 * Copyright 2012 - 2013 Samsung Electronics (UK) Ltd
 * AUTHORS: Habib Virji (habib.virji@samsung.com)
 *******************************************************************************/
/**
 * Connects with PZH and handle respective events
 */
var PzpConnectHub = function () {
    "use strict";
    var PzpCommon = require("./pzp.js");
    var PzpObject = this;
    var logger    = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var pzpClient;
    var retryTryOut = 0;
    var retryTimeOut;

    //This function will be called when PZH is disconnected and retries connection
    function retryConnecting () {
        if (PzpObject.getEnrolledStatus()) {
            setTimeout (function () {
                logger.log ("Retrying to connect back to the PZH ");
                retryTryOut++;
                if(retryTryOut == 3){
                    retryTryOut = 0;
                } else {
                    retryTimeOut *= 10;
                }
                PzpObject.connectOwnPzh();
            }, retryTimeOut);//increase time limit to suggest when it should retry connecting back to the PZH
        }
    }

    //This function will be called when PZH is connected
    function connectionWithPzhChecker() {
        var id = setInterval(function(){
            var socket = PzpCommon.net.createConnection(PzpObject.getWebinosPorts("provider"),  PzpObject.getMetaData("serverName"));
            socket.setTimeout(10);
            socket.on('connect', function() {
                 socket.end();
            });
            socket.on('error', function() { // Assuming this will happen as internet is not reachable
                logger.log("connection with pzh has been lost. Will try reconnecting back when PZH is available");
                pzpClient.socket.destroy();
                clearInterval(id)
            });
        },retryTimeOut);
    }
    /**
     *
     *
     */
    this.connectOwnPzh = function () {
        try {
            if (!retryTimeOut) {
                retryTimeOut = PzpObject.getMetaData("retryConnection");
            }
            logger.log("connection towards pzh "+ PzpObject.getPzhId() +" initiated");
            var socket = PzpCommon.net.createConnection(PzpObject.getWebinosPorts("provider"),  PzpObject.getMetaData("serverName")); //Check if we are online..
            socket.setTimeout(10);
            socket.on('connect', function() {
                socket.end();
                logger.log("you are connected to the internet, now trying to connect to PZH");
                var options = PzpObject.setConnectionParameters();
                options.ca = (PzpObject.getEnrolledStatus()) ? PzpObject.getCertificate("pzh"): PzpObject.getCertificate("master");
                pzpClient = PzpCommon.tls.connect(PzpObject.getWebinosPorts("provider"),
                    PzpObject.getMetaData("serverName"),
                    options, function() {
                        if (pzpClient.authorized) {
                            PzpObject.handleAuthorization(pzpClient);
                            connectionWithPzhChecker();
                        } else {
                            PzpObject.unAuthorized(pzpClient, "Pzh");
                        }
                    });


                pzpClient.on ("data", function (buffer) {
                    PzpObject.handleMsg(pzpClient, buffer);
                });

                pzpClient.on ("close", function (had_errors) {
                    if(had_errors) logger.log("socket connection failed due to transmission error");
                });

                pzpClient.on ("end", function() {
                    if (pzpClient.id) {
                        logger.log("connection end for "+ pzpClient.id);
                        PzpObject.socketCleanUp(pzpClient.id);
                    }
                    retryConnecting();
                });

                pzpClient.on ("error", function(err) {
                    PzpObject.emit("PZP_CONNECTION_FAILED", err);
                });
            });
            socket.on('error', function() { // Assuming this will happen as internet is not reachable
               logger.log("currently your PZH is offline.");
                retryConnecting();
            });
        } catch (err) {
            PzpObject.emit("EXCEPTION", "Connecting Personal Zone Hub Failed - " + err)
        }
    }
};

//require("util").inherits(PzpConnectHub, PzpOtherManager);
module.exports = PzpConnectHub;
