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
var PzpOtherManager = require("./pzp_otherManager.js");

var PzpConnectHub = function () {
    "use strict";
    PzpOtherManager.call(this);
    var PzpCommon       = require("./pzp.js");
    var PzpObject = this;
    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var pzpClient;

    //This function will be called when PZH is disconnected and retries connection
    function retryConnecting () {
        if (PzpObject.getEnrolledStatus()) {
            setTimeout (function () {
                logger.log ("Retrying to connect back to the PZH ");
                PzpObject.connectHub();
            }, PzpObject.getRetryConnectionValue());//increase time limit to suggest when it should retry connecting back to the PZH
        }
    }

    //This function will be called when PZH is connected
    function connectionWithPzhChecker() {
        var id = setInterval(function(){
            var socket = PzpCommon.net.createConnection(PzpObject.getPorts().provider,  PzpObject.getServerAddress());
            socket.setTimeout(10);
            socket.on('connect', function() {
                 socket.end();
            });
            socket.on('error', function() { // Assuming this will happen as internet is not reachable
                logger.log("connection with pzh has been lost. Will try reconnecting back when PZH is available");
                pzpClient.socket.destroy();
                clearInterval(id)
            });
        },PzpObject.getRetryConnectionValue());
    }
    /**
     *
     *
     */
    this.connectHub = function () {
        try {
            logger.log("connection towards pzh "+ PzpObject.getPzhId() +" initiated");
            var socket = PzpCommon.net.createConnection(PzpObject.getPorts().provider,  PzpObject.getServerAddress()); //Check if we are online..
            socket.setTimeout(10);
            socket.on('connect', function() {
                socket.end();
                logger.log("you are connected to the internet");
                pzpClient = PzpCommon.tls.connect(PzpObject.getPorts().provider,
                    PzpObject.getServerAddress(),
                    PzpObject.setConnectionParameters(), function() {
                        logger.log ("connection to pzh status: " + pzpClient.authorized);
                        if (pzpClient.authorized) {
                            PzpObject.handlePzhAuthentication(pzpClient);
                            connectionWithPzhChecker();
                        } else {
                            PzpObject.unAuthentication(pzpClient);
                        }
                        pzpClient.setKeepAlive(true,1200);
                    });


                pzpClient.on ("data", function (buffer) {
                    PzpObject.handleMsg(pzpClient, buffer);
                });

                pzpClient.on ("close", function (had_errors) {
                    if(had_errors) logger.log("socket connection failed due to transmission error");
                });

                pzpClient.on ("end", function() {
                    logger.log("connection end for "+ pzpClient.id);
                    if (pzpClient.id) PzpObject.cleanUp(pzpClient.id);
                    retryConnecting();
                });

                pzpClient.on ("error", function(err) {
                    PzpObject.emit("CONNECTION_FAILED", err);
                });
            });
            socket.on('error', function() { // Assuming this will happen as internet is not reachable
               logger.log("currently your PZH is offline.");
                retryConnecting();
            });
        } catch (err) {
            PzpObject.emit("EXCEPTION", new Error("Connecting Personal Zone Hub Failed - " + err))
        }
    }
};

require("util").inherits(PzpConnectHub, PzpOtherManager);
module.exports = PzpConnectHub;