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

    /**
     * If PZP fails to connect to PZH, this tries to connect back to PZH
     */
    function retryConnecting () {
        if (PzpObject.getEnrolledStatus()) {
            setTimeout (function () {
                logger.log ("Retrying to connect back to the PZH ");
                PzpObject.connectHub();
            }, PzpObject.getRetryConnectionValue());//increase time limit to suggest when it should retry connecting back to the PZH
        }
    }
    /**
     *
     *
     */
    this.connectHub = function () {
        var pzpClient;
        try {
            logger.log("connection towards pzh "+ PzpObject.getPzhId() +" initiated");
            pzpClient = PzpCommon.tls.connect(PzpObject.getPorts().provider,
                PzpObject.getServerAddress(),
                PzpObject.setConnectionParameters(), function() {
                    logger.log ("connection to pzh status: " + pzpClient.authorized);
                    if (pzpClient.authorized) {
                        PzpObject.handlePzhAuthentication(pzpClient);
                    } else {
                        PzpObject.unAuthentication(pzpClient);
                    }
                });

            pzpClient.setTimeout(120);
            pzpClient.on("timeout", function(){
               logger.log("connection timeout");
                pzpClient.end();
            });
            pzpClient.on ("data", function (buffer) {
                PzpObject.handleMsg(pzpClient, buffer);
            });

            pzpClient.on ("close", function (had_errors) {
                if(had_errors) logger.log("socket connection failed due to transmission error");
                logger.log("closed call")
            });

            pzpClient.on ("end", function() {
                if (pzpClient.id) PzpObject.cleanUp(pzpClient.id);
                retryConnecting();
            });

            pzpClient.on ("error", function(err) {
                PzpObject.emit("CONNECTION_FAILED", err);
            });
        } catch (err) {
            PzpObject.emit("EXCEPTION", new Error("Connecting Personal Zone Hub Failed - " + err))
        }
    }
};

require("util").inherits(PzpConnectHub, PzpOtherManager);
module.exports = PzpConnectHub;