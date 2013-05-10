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
var PzpServiceHandler = require("./pzp_serviceHandler.js");

var PzpReceiveMessage = function () {
    "use strict";
    console.log("receiveMessage");

    PzpServiceHandler.call(this);
    var PzpCommon = require("./pzp.js");
    var PzpObject = this;
    var logger    = PzpCommon.wUtil.webinosLogging(__filename) || console;

    function syncHash (receivedMsg) {
        if (sync) {
            var policyPath = PzpCommon.path.join(PzpObject.getWebinosPath(), "policies", "policy.xml");
            sync.parseXMLFile (policyPath, function (policies) {
                var list = {trustedList:PzpObject.getTrustedList(),
                    crl                :PzpObject.getCrl(),
                    cert               :PzpObject.getExternalCertificates(),
                    exCertList         :PzpObject.getExternal,
                    policy             :policies};
                var result = sync.compareFileHash (list, receivedMsg);
                if (Object.keys(result).length >= 1) {
                    PzpObject.prepSendMsg("sync_compare", result);
                }
                else {
                    logger.log ("All Files are already synchronized");
                }
            });
        }

    }

    function updateHash (receivedMsg) {
        var msg;
        for (msg in receivedMsg) {
            if (msg === "trustedList") {
                PzpObject.storeDetails("trustedList", receivedMsg[msg]);
            } else if (msg === "crl") {
                PzpObject.storeDetails("crl", receivedMsg[msg]);
            } else if (msg === "cert") {
                PzpObject.storeDetails(PzpCommon.path.join("certificates", "external","certificates"), receivedMsg[msg]);
            }
        }
        logger.log ("Files Synchronised with the PZH");
    }

    function updateDeviceInfo(validMsgObj) {
        var i;
        if (PzpObject.getConnectedPzh().hasOwnProperty(validMsgObj.from)) {
            PzpObject.getConnectedPzh()[validMsgObj.from].friendlyName = validMsgObj.payload.message.friendlyName;
            if (PzpObject.getFriendlyName().indexOf(validMsgObj.payload.message.friendlyName) === -1) {
                //PzpObject.setFriendlyName(validMsgObj.payload.message.friendlyName + "'s " + PzpObject.getFriendlyName());
            }
        } else if (PzpObject.getConnectedPzp().hasOwnProperty(validMsgObj.from)) {
            PzpObject.getConnectedPzp()[validMsgObj.from].friendlyName = validMsgObj.payload.message.friendlyName;
        }
        // These are friendlyName... Just for display purpose
        for (i = 0; i < validMsgObj.payload.message.connectedPzp.length; i = i + 1) {
            if(!PzpObject.getConnectedPzp().hasOwnProperty(validMsgObj.payload.message.connectedPzp[i].key) &&
                validMsgObj.payload.message.connectedPzp[i].key !== PzpObject.getSessionId())
            {
                PzpObject.getPzhConnectedDevices().pzp[validMsgObj.payload.message.connectedPzp[i].key] =
                    validMsgObj.payload.message.connectedPzp[i] &&
                    validMsgObj.payload.message.connectedPzp[i].friendlyName;
            }
        }

        for (i = 0; i < validMsgObj.payload.message.connectedPzh.length; i = i + 1) {
            if(!PzpObject.getConnectedPzh().hasOwnProperty(validMsgObj.payload.message.connectedPzh[i].key)) {
                PzpObject.getPzhConnectedDevices().pzh[validMsgObj.payload.message.connectedPzh[i].key]=
                    validMsgObj.payload.message.connectedPzh[i] &&
                    validMsgObj.payload.message.connectedPzh[i].friendlyName;
            }
        }
        PzpObject.connectedApp();
    }

    function registerBrowser(connection, msg) {
      PzpObject.connectedApp(connection, msg.payload.value);
    }

    function beginPzpEnrollment(connection, msg) {
        if (expectedPzhAddress === msg.payload.providerDetails) {
            connection.sendUTF (JSON.stringify ({"from":PzpObject.getDeviceName(),
                "payload":{
                  "status":"csrAuthCodeByPzp",
                  "csr":PzpObject.getCertificateToBeSignedByPzh(),
                  "friendlyName": PzpObject.getFriendlyName()
                }
            }));
        }
    }

    function endPzpEnrollment(connection, msg) {
        if (expectedPzhAddress === (msg.from && msg.from.split("_") && msg.from.split("_")[0])) {
            PzpObject.registerDevice (msg.from, msg.to, msg.payload.message);
            PzpObject.connectHub();
        }
    }

    function changePzpCertificate(connection, msg) {
        if (expectedPzhAddress === (msg.from && msg.from.split("_") && msg.from.split("_")[0])) {
            // Re-Generate Master CSR and send it to PZH..
            PzpObject.setDeviceName(msg.payload.message);
            PzpObject.createPzpCertificates(); // New PZP ID
            PzpObject.setSessionId();
            PzpObject.setupMessage_RPCHandler();
            beginPzpEnrollment(connection, msg);
        }
    }

    function gatherTestPageLinks(connection, msg) {
        var serviceCache = PzpObject.getServiceCache(), testLink=[];
        for (var key = 0 ; key < serviceCache.length; key = key + 1){
            testLink.push({name: serviceCache[key].name, link:serviceCache[key].testFile});
        }
        PzpObject.prepMsg (msg.from, "gatherTestPageLinks", testLink);
    }

    function getConfigData(connection, from){
        var configData, accData = [];
        PzpCommon.mandatoryModule.forEach(function(name){
            if(PzpCommon.path.resolve(require.resolve(name),"config.json")) {
                configData = require(PzpCommon.path.join(require.resolve(name), "config.json"))
                accData.push({name:name, config: configData});
            }
        });
        PzpObject.prepMsg(from, "configData", accData);
    }

    function getWebinosLog (connection, msg) {
        logger.fetchLog (msg.payload.type, "Pzp", PzpObject.getDeviceName(), function (data) {
            PzpObject.prepMsg(msg.from, msg.payload.type + "Log", data);
        });
    }

    function setPzhAddress(connection, msg) {
        expectedPzhAddress = msg.payload.message;
    }

    var methods= {
        "registeredBrowser"    :registerBrowser,
        "getConnectedInfo"     :getConnectedInfo,
        "authCodeByPzh"        :beginPzpEnrollment,
        "signedCertByPzh"      :endPzpEnrollment,
        "pzpId_Update"         :changePzpCertificate,
        "resetDevice"          :PzpObject.unRegisterDevice,
        "gatherTestPageLinks"  :gatherTestPageLinks(),
        "configData"           :getConfigData,
        "logs"                 :getWebinosLog,
        "setPzhProviderAddress":setPzhAddress
    };

    /**
     * WebSocket message handler
     */
    function wsMessage (connection, origin, utf8Data) {
        //schema validation
        var key, msg = JSON.parse (utf8Data), invalidSchemaCheck = true;
        if (msg && msg.payload && msg.payload.status === "registerBrowser") {
            // skip schema check as this is first message
        } else {
            try {
                invalidSchemaCheck = PzpCommon.wUtil.webinosSchema.checkSchema (msg);
            } catch (err) {
                logger.error (err);
            }
            if (invalidSchemaCheck) {
                // For debug purposes, we only print a message about unrecognized packet,
                // in the final version we should throw an error.
                // Currently there is no a formal list of allowed packages and throw errors
                // would prevent the PZP from working
                logger.error ("msg schema is not valid " + JSON.stringify (msg));
            }
        }
        msg.to = setOriginalId(msg.to);
        msg.from = setOriginalId(msg.from);
        msg.resp_to = setOriginalId(msg.resp_to);

        if (msg.type === "prop") {
            methods[msg.payload.status].apply(PzpObject,[connection, msg.payload]);
        } else {
            PzpObject.processMsg (msg, msg.to);
        }
    }
    /**
     *
     * @param conn
     * @param buffer
     */
    this.handleMsg=function (conn, buffer) {
        try {
            conn.pause (); // This pauses socket, cannot receive messages
            PzpCommon.wUtil.webinosMsgProcessing.readJson(PzpObject, buffer, function (obj) {
                PzpObject.processMsg(obj);
            });
        } catch (err) {
            PzpObject.emit("EXCEPTION", "failed in processing message received", err);
        } finally {
            conn.resume ();// unlocks socket.
        }
    };
     /**
     * Processes message received from the PZP
     * @param msgObj - the buffer array received from other webinos end point
     */
    this.processMsg = function (msgObj) {
        try {
            PzpCommon.wUtil.webinosMsgProcessing.processedMsg (PzpObject, msgObj, function (validMsgObj) {
                logger.log ("msg received " + JSON.stringify (validMsgObj));
                if (PzpObject.checkConnectedPzh(validMsgObj.from) || PzpObject.checkConnectedPzp(validMsgObj.from) ||
                    PzpObject.checkConnectedWebApp(validMsgObj.from)){
                    if (validMsgObj.type === 'prop') {
                        switch (validMsgObj.payload.status) {
                            case'foundServices':
                                serviceListener && serviceListener (validMsgObj.payload);
                                break;
                            case "findServices":
                                setFoundService (validMsgObj);
                                break;
                            case 'listUnregServices':
                                listUnRegServices (validMsgObj);
                                break;
                            case 'registerService':
                                registerService (validMsgObj);
                                break;
                            case'unregisterService':
                                unRegisterService (validMsgObj);
                                break;
                            case "sync_hash":
                                syncHash (validMsgObj.payload.message);
                                break;
                            case "update_hash":
                                updateHash (validMsgObj.payload.message);
                                break;
                            case "update":
                                updateDeviceInfo(validMsgObj);
                                break;
                            case "changeFriendlyName":
                                PzpObject.changeFriendlyName(validMsgObj.payload.message);
                                break;
                        }
                    } else {
                        PzpObject.messageHandler.onMessageReceived (validMsgObj, validMsgObj.to);
                    }
                } else {
                    logger.log("Message from "+validMsgObj.from+" unconnected entity");
                }
            });
        } catch(err){
            logger.error("Error in processing message" + err);
        }
    }
};
require("util").inherits(PzpReceiveMessage, PzpServiceHandler);
module.exports = PzpReceiveMessage;
