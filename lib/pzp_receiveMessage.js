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
var PzpReceiveMessage = function () {
    "use strict";
    var PzpCommon = require("./pzp.js");
    var PzpObject = this;
    var logger    = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var expectedPzhAddress;

    function registerBrowser(msg, connection) {
      PzpObject.connectedApp(connection, msg.payload.value);
    }

    function beginPzpEnrollment(msg, connection) {
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

    function endPzpEnrollment(msg) {
        if (expectedPzhAddress === (msg.from && msg.from.split("_") && msg.from.split("_")[0])) {
            PzpObject.pzpEnrollment (msg.from, msg.to, msg.payload.message);
            PzpObject.connectHub();
            expectedPzhAddress = "";
        }
    }

    function changePzpCertificate(msg, connection) {
        if (expectedPzhAddress === (msg.from && msg.from.split("_") && msg.from.split("_")[0])) {
            // Re-Generate Master CSR and send it to PZH..
            PzpObject.setDeviceName(msg.payload.message);
            PzpObject.createPzpCertificates(); // New PZP ID
            PzpObject.setSessionId();
            PzpObject.setupMessage_RPCHandler();
            beginPzpEnrollment(connection, msg);
        }
    }

    function unRegisterDevice(){
        PzpObject.unRegisterDevice();
    }

    function gatherTestPageLinks(msg) {
        var serviceCache = PzpObject.getServiceCache(), testLink=[];
        for (var key = 0 ; key < serviceCache.length; key = key + 1){
            testLink.push({name: serviceCache[key].name, link:serviceCache[key].testFile});
        }
        PzpObject.prepMsg (msg.from, "gatherTestPageLinks", testLink);
    }

    function getConfigData(msg){
        var configData, accData = [];
        PzpCommon.mandatoryModule.forEach(function(name){
            if(PzpCommon.path.resolve(require.resolve(name),"config.json")) {
                configData = require(PzpCommon.path.join(require.resolve(name), "config.json"))
                accData.push({name:name, config: configData});
            }
        });
        PzpObject.prepMsg(msg.from, "configData", accData);
    }

    function getWebinosLog (msg) {
        logger.fetchLog (msg.payload.type, "Pzp", PzpObject.getDeviceName(), function (data) {
            PzpObject.prepMsg(msg.from, msg.payload.type + "Log", data);
        });
    }

    function setPzhAddress(msg) {
        expectedPzhAddress = msg.payload.message;
    }

    function foundServices(msg){
        PzpObject.getServiceListener(msg);
    }

    // On receipt of SyncHash, PZP will find diff of hash that are missing...
    function syncHash (receivedMsg) {
        if (PzpObject.syncInstance){
            PzpObject.prepareSyncList(function(list){
                var list_ = PzpObject.syncInstance.compareObjectHash(list, receivedMsg.payload.message);
                PzpObject.prepMsg(receivedMsg.from, "syncCompare", list_);
            });
        }
    }

    // Apply updates of the components that are different from the PZH
    function updateHash (receivedMsg) {
        if (PzpObject.syncInstance){
            PzpObject.prepareSyncList(function(list){
                PzpObject.syncInstance.applyObjectContents(list, receivedMsg.payload.message);
                for (var key in list){
                    if (list.hasOwnProperty(key)){
                        if (key === "trustedList"&& PzpObject.getTrustedList() !== list[key]) {
                            logger.log("During Sync with PZH, trustedList  updated");
                            PzpObject.updateTrustedList(list[key]);
                        } else if (key === "certificates" && PzpObject.getExternalCertificates() !== list[key]) {
                            logger.log("During Sync with PZH, certificates is updated");
                            PzpObject.updateExternalCertificates(list[key]);
                        } else if (key === "policy") {

                        } else if (key === "crl" && PzpObject.getCRL() !== list[key]) {
                            logger.log("During Sync with PZH, crl is updated");
                            PzpObject.updateCRL(list[key]);
                        }
                    }
                }
                logger.log ("Files Synchronised with the PZH");
            });
        }
    }

    var methods= {
        "registerBrowser"      :registerBrowser,
        "authCodeByPzh"        :beginPzpEnrollment,
        "signedCertByPzh"      :endPzpEnrollment,
        "pzpId_Update"         :changePzpCertificate,
        "resetDevice"          :unRegisterDevice,
        "gatherTestPageLinks"  :gatherTestPageLinks,
        "configData"           :getConfigData,
        "logs"                 :getWebinosLog,
        "setPzhProviderAddress":setPzhAddress,
        "foundServices"        :foundServices,
        "listUnregServices"    :PzpObject.listUnRegServices,
        "registerService"      :PzpObject.registerService,
        "unregisterService"    :PzpObject.unRegisterService,
        "syncHash"             :syncHash,
        "updateHash"           :updateHash,
        "changeFriendlyName"   :PzpObject.changeFriendlyName
    };

    this.wsMessage = function (connection, origin, utf8Data) {
        //schema validation
        var msg = JSON.parse (utf8Data);
        if (msg && msg.payload && msg.payload.status === "registerBrowser") {
            // skip schema check as this is first message
        } else {
           PzpCommon.wUtil.webinosMsgProcessing.processedMsg(PzpObject, msg, function() {
           });
        }
        PzpObject.handleProcessedMessage(msg, connection);
    };

    /**
     *
     * @param conn
     * @param buffer
     */
    this.handleMsg=function (conn, buffer) {
        try {
            conn.pause (); // This pauses socket, cannot receive messages
            PzpCommon.wUtil.webinosMsgProcessing.readJson(PzpObject, buffer, function (validMsgObj) {
                PzpObject.handleProcessedMessage(validMsgObj, conn);
            });
        } catch (err) {
            PzpObject.emit("EXCEPTION", new Error("failed in processing message received" + err));
        } finally {
            conn.resume ();// unlocks socket.
        }
    };

    this.handleProcessedMessage = function(validMsgObj, conn) {
        logger.log ("msg received " + JSON.stringify (validMsgObj));
        if (PzpObject.checkConnectedPzh(validMsgObj.from)    || // Currently Connected PZH
            PzpObject.checkConnectedPzp(validMsgObj.from)    || // Currently Connected PZPs
            PzpObject.checkConnectedWebApp(validMsgObj.from) || // Currently Connected PZH
            validMsgObj.payload.status === "registerBrowser" || // Special exception as this is first msg from browser
//            expectedPzhAddress                               || // Enrollment message comes from this address
            PzpObject.checkTrustedList(validMsgObj.from)   // Entities that are trusted might in same zone or outside zone
            ){
            if (validMsgObj.type === "prop") {
                methods[validMsgObj.payload.status].apply(PzpObject,[validMsgObj, conn]);
            } else {
                PzpObject.messageHandler.onMessageReceived (validMsgObj, validMsgObj.to);
            }
        } else {
            logger.log("Message from "+validMsgObj.from+" unconnected entity");
        }
    }

};
module.exports = PzpReceiveMessage;
