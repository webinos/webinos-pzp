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
            connection.sendUTF (JSON.stringify ({"from":PzpObject.getMetaData("webinosName"),
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
                configData = require(PzpCommon.path.join(require.resolve(name), "config.json"));
                accData.push({name:name, config: configData});
            }
        });
        PzpObject.prepMsg(msg.from, "configData", accData);
    }

    function getWebinosLog (msg) {
        logger.fetchLog (msg.payload.type, "Pzp", PzpObject.getMetaData("webinosName"), function (data) {
            PzpObject.prepMsg(msg.from, msg.payload.type + "Log", data);
        });
    }

    function setPzhAddress(msg) {
        expectedPzhAddress = msg.payload.message;
    }

    function foundServices(msg){
        PzpObject.getServiceListener(msg);
    }
    function listUnRegServices(msg){
        PzpObject.listUnRegServices(msg);
    }
    function registerService(msg){
        PzpObject.registerService(msg);
    }

    function unRegisterService(msg){
        PzpObject.unRegisterService(msg);
    }

    function applyContents(receivedMsg){
        for (var key in receivedMsg){
            if (receivedMsg.hasOwnProperty(key)){
                if (key === "trustedList"&& PzpObject.getTrustedList() !== receivedMsg[key]) {
                    logger.log("During Sync with PZH, trustedList  updated");
                    PzpObject.updateTrustedList(receivedMsg[key]);
                } else if (key === "certificates" && PzpObject.getExternalCertificates() !== receivedMsg[key]) {
                    logger.log("During Sync with PZH, certificates is updated");
                    PzpObject.updateExternalCertificates(receivedMsg[key]);
                } else if (key === "policy") {
                    // TODO:Update policy file, Will  it require reloading policies, etc
                } else if (key === "crl" && PzpObject.getCRL() !== receivedMsg[key]) {
                    logger.log("During Sync with PZH, crl is updated");
                    PzpObject.updateCRL(receivedMsg[key]);
                } else if (key === "serviceCache" && PzpObject.getServiceCache() !== list[key]) {
                    logger.log("During Sync with PZH, serviceCache is updated");
                    PzpObject.updateStoreServiceCache(list[key]);
                    PzpObject.addRemoteServices(receivedMsg[key]);
                }
                // NO Cert and CRL Sync up, as PZH is the one that
            }
        }

    }
    // On response of syncCompare, PZP checks the difference at its end and send missing contents to the PZH...
    function synchronization_findDifference(receivedMsg) {
        if (PzpObject.syncInstance && receivedMsg) {
            PzpObject.prepareSyncList(function(list) { // Get your own list
                PzpObject.prepMsg (receivedMsg.from, "syncUpdate", PzpObject.syncInstance.sendObjectContents(list, receivedMsg.payload.message));
                synchronization_UpdateHash(list);// List is not just having our local changes but accumulated changes received from the PZH
            });
        }
    }
    // This is PZH sending the new additions it has to the PZP, received in syncCompare
    function synchronization_UpdateHash(receivedMsg) {
        if(PzpObject.syncInstance) {
            PzpObject.prepareSyncList(function(list) { // Please note this list is different
                var result = PzpObject.syncInstance.applyObjectContents(list, receivedMsg);
                if (result){
                    applyContents(receivedMsg);
                    logger.log ("Files Synchronised with the PZH");
                }
            });
        }
    }

    // On receipt of SyncHash, PZP will find diff of hash that are missing...
    function syncHash (receivedMsg) {
        try{
        if (PzpObject.syncInstance){
            PzpObject.prepareSyncList(function(list){
                var list_ = PzpObject.syncInstance.compareObjectHash(list, receivedMsg.payload.message);
                PzpObject.prepMsg(receivedMsg.from, "syncCompare", list_);
            });
        }
        } catch(err) {
            logger.error(err);
        }
    }

    // Apply updates of the components that are different from the PZH
    function syncUpdate (receivedMsg) {
        if (PzpObject.syncInstance){
            PzpObject.prepareSyncList(function(list){
                PzpObject.syncInstance.applyObjectContents(list, receivedMsg.payload.message);
                // after this step, list is changed with changes received from the PZH.
                applyContents(list);
                logger.log ("Files Synchronised with the PZH");
            });
        }
    }

    function connectedDevices(receivedMsg){
        console.log(receivedMsg.payload.message.connectedPzh);
        console.log(receivedMsg.payload.message.connectedPzp);
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
        "listUnregServices"    :listUnRegServices,
        "registerService"      :registerService,
        "unregisterService"    :unRegisterService,
        "syncHash"             :syncHash,
        "syncUpdate"           :syncUpdate,
        "syncCompare"          :synchronization_findDifference, // PZH Sends this on receipt of syncHash
        "changeFriendlyName"   :PzpObject.changeFriendlyName,
        "connectedDevices"     :connectedDevices
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
            expectedPzhAddress                               || // Enrollment message comes from this address
            PzpObject.checkTrustedList(validMsgObj.from)   // Entities that are trusted might in same zone or outside zone
            ){
            if (validMsgObj.type === "prop") {
                if(methods[validMsgObj.payload.status]){
                    methods[validMsgObj.payload.status].apply(PzpObject,[validMsgObj, conn]);
                } else {
                    logger.error("Invalid message type - message discarded");
                }
            } else {
                PzpObject.messageHandler.onMessageReceived (validMsgObj, validMsgObj.to);
            }
        } else {
            logger.log("Message from "+validMsgObj.from+" unconnected entity");
        }
    }

};
module.exports = PzpReceiveMessage;
