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
    var pzhReconnectCount = 0;
    var pzhReconnectTimeout;
    var pzhReconnectTimer = null;
    var pzhPingSocket = null;
    var pzhConnected = false;
    var pzhPingTimer = null;

    //This function will be called when PZH is disconnected and retries connection
    function retryPZHConnection (reset) {
      pzhConnected = false;
 
      // Kill ping socket if pending.
      if (pzhPingSocket !== null) {
        logger.log("killing pending pzh ping socket");
        pzhPingSocket.destroy();
        pzhPingSocket = null;
      }
 
      if (pzhReconnectTimer === null) {
        var retryHelper = function() {
          pzhReconnectTimer = null;
          pzhReconnectCount++;
          pzhReconnectTimeout *= 2;
          process.nextTick(PzpObject.connectOwnPzh);
        };
 
        if (PzpObject.getEnrolledStatus()) {
          if (reset || pzhReconnectCount === 3 || typeof pzhReconnectTimeout === "undefined") {
            pzhReconnectTimeout = PzpObject.getMetaData("retryConnection");
            pzhReconnectCount = 0;
          }
          pzhReconnectTimer = setTimeout (retryHelper, pzhReconnectTimeout);
          logger.log("waiting " + pzhReconnectTimeout/1000 + "secs before reconnect attempt");
        }
      } else {
        logger.error("reconnection timer already running");
      }
    }

    this.cancelPzhConnectorTimer = function(){
        if(pzhReconnectTimer) {
          clearTimeout(pzhReconnectTimer);
          pzhReconnectTimer = null;
        }
    };

    //This function will be called periodically when PZH is connected
    function pingPzh() {
      var pingHelper = function() {
        pzhPingTimer = null;
        if (pzhConnected) {
          pzhPingSocket = PzpCommon.net.createConnection(PzpObject.getWebinosPorts("provider"),  PzpObject.getMetaData("serverName"));
          pzhPingSocket.setTimeout(10);
          pzhPingSocket.on('connect', function() {
            pzhPingSocket.end();
            pzhPingSocket = null;
            process.nextTick(pingPzh);
            });
          pzhPingSocket.on('error', function() { // Assuming this will happen as internet is not reachable
            logger.log("pzh ping failed - connection with pzh has been lost");
            pzhPingSocket = null;
                pzpClient.socket.destroy();
            retryPZHConnection(true);
            });
        } else {
          logger.log("skipping scheduled PZH ping since connection no longer active");
    }
      };
 
      if (pzhPingTimer !== null) {
        logger.error("pingPzh - timer already running");
      } else {
        pzhPingTimer = setTimeout(pingHelper, PzpObject.getMetaData("retryConnection"));
      }
    }
    /**
     *
     *
     */
    this.connectOwnPzh = function () {
      if (pzhConnected) {
        logger.error("connectOwnPzh - connection active or pending");
        return;
      }
        try {
        logger.log("attempting connection to pzh "+ PzpObject.getPzhId());
            var socket = PzpCommon.net.createConnection(PzpObject.getWebinosPorts("provider"),  PzpObject.getMetaData("serverName")); //Check if we are online..
            pzhConnected = true;
            socket.setTimeout(10);
            socket.on('connect', function() {
                    socket.end();
                    logger.log("internet connection ok, trying to connect to PZH");
                    var options = PzpObject.setConnectionParameters();
                    options.ca = (PzpObject.getEnrolledStatus()) ? PzpObject.getCertificate("pzh"): PzpObject.getCertificate("master");
                    pzpClient = PzpCommon.tls.connect(PzpObject.getWebinosPorts("provider"),
                        PzpObject.getMetaData("serverName"),
                        options, function() {
                            if (pzpClient.authorized) {
                                PzpObject.handleAuthorization(pzpClient);
                                pingPzh();
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
                        retryPZHConnection(true);
                    });

                    pzpClient.on ("error", function(err) {
                        PzpObject.emit("PZP_CONNECTION_FAILED", err);
                        if (pzpClient.id) {
                            logger.log("connection ERROR for "+ pzpClient.id);
                            PzpObject.socketCleanUp(pzpClient.id);
                        }
                        retryPZHConnection(true);
                    });
            });
            socket.on('error', function() { // Assuming this will happen as internet is not reachable
               logger.log("pzh server unreachable");
               retryPZHConnection();
            });
        } catch (err) {
            PzpObject.emit("EXCEPTION", "Connecting Personal Zone Hub Failed - " + err)
            retryPZHConnection();
        }
    }
};

//require("util").inherits(PzpConnectHub, PzpOtherManager);
module.exports = PzpConnectHub;
