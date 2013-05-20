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
        "authCodeByPzh"        :beginPzpEnrollment,
        "signedCertByPzh"      :endPzpEnrollment,
        "pzpId_Update"         :changePzpCertificate,
        "resetDevice"          :PzpObject.unRegisterDevice,
        "gatherTestPageLinks"  :gatherTestPageLinks,
        "configData"           :getConfigData,
        "logs"                 :getWebinosLog,
        "setPzhProviderAddress":setPzhAddress,
		"foundServices"        :PzpObject.getRemoveServiceListener ,
        "listUnregServices"    :PzpObject.listUnRegServices,
		"registerService"      :PzpObject.registerService,
	    "unregisterService"    :PzpObject.unRegisterService,
		"syncHash"             :syncHash,
		"updateHash"           :updateHash,
		"update"               :updateDeviceInfo,
		"changeFriendlyName"   :PzpObject.changeFriendlyName
    };
	
	this.wsMessage = function (connection, origin, utf8Data) {
        //schema validation
        var key, msg = JSON.parse (utf8Data), invalidSchemaCheck = true;
        if (msg && msg.payload && msg.payload.status === "registerBrowser") {
            // skip schema check as this is first message
        } else {
           PzpCommon.wUtil.webinosMsgProcessing.processedMsg(PzpObject, msg, function() {
		   });
        }
        msg.to = PzpObject.setOriginalId(msg.to);
        msg.from = PzpObject.setOriginalId(msg.from);
        msg.resp_to = PzpObject.setOriginalId(msg.resp_to);
		PzpObject.handleProcessedMessage(msg, connection);        
    }
    
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
            PzpObject.emit("EXCEPTION", "failed in processing message received", err);
        } finally {
            conn.resume ();// unlocks socket.
        }
    };     
	
	this.handleProcessedMessage = function(validMsgObj, conn) {
		logger.log ("msg received " + JSON.stringify (validMsgObj));
		if (PzpObject.checkConnectedPzh(validMsgObj.from) || PzpObject.checkConnectedPzp(validMsgObj.from) ||
			PzpObject.checkConnectedWebApp(validMsgObj.from)){
			if (validMsgObj.type === "prop") {
				methods[validMsgObj.payload.status].apply(PzpObject,[conn, validMsgObj.payload]);
			} else {
				PzpObject.messageHandler.onMessageReceived (validMsgObj, validMsgObj.to);
			}
		} else {
			logger.log("Message from "+validMsgObj.from+" unconnected entity");
		}
	}
	
};
require("util").inherits(PzpReceiveMessage, PzpServiceHandler);
module.exports = PzpReceiveMessage;
