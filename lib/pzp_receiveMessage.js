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

    function beginPzpEnrollment(msg, connection) {
        connection.sendUTF (JSON.stringify ({"from":PzpObject.getMetaData("webinosName"),
            "payload":{
              "status":"csrFromPzp",
              "csr":PzpObject.getCertificateToBeSignedByPzh(),
              "friendlyName": PzpObject.getFriendlyName(),
              "deviceType": PzpObject.getMetaData("deviceType")
            }
        }));
    }

    function endPzpEnrollment(msg, connection) {
        PzpObject.pzpEnrollment (msg.from, msg.to, msg.payload.message);
        expectedPzhAddress = "";
        connection.sendUTF (JSON.stringify ({
            "from":PzpObject.getMetaData("webinosName"),
            "payload":{"status":"enrolmentSuccess"}
        }));
    }

    /*function changePzpCertificate(msg, connection) {
        // Re-Generate Master CSR and send it to PZH..
        PzpObject.setDeviceName(msg.payload.message);
        PzpObject.createPzpCertificates(); // New PZP ID
        PzpObject.startOtherManagers();
        beginPzpEnrollment(msg, connection);

    }*/

    function gatherTestPageLinks(msg) {
        var serviceCache = PzpObject.getOwnModules(), testLink=[];
        for (var key in serviceCache){
            if( serviceCache.hasOwnProperty(key) && serviceCache[key].name) {
                testLink.push({name: serviceCache[key].name, link:serviceCache[key].testFile});
            }
        }
        PzpObject.prepMsg (msg.from, "gatherTestPageLinks", testLink);
    }

    function fetchJS(msg){
        var serviceCache = PzpObject.getOwnModules();
        for (var key in serviceCache){
            if (serviceCache.hasOwnProperty(key)) {
                var serviceLookup;
                if (serviceCache[key].apiURI && msg.payload && msg.payload.message && serviceCache[key].apiURI.length < msg.payload.message.length) {
                    serviceLookup = msg.payload.message.substr(0, serviceCache[key].apiURI.length);
                } else {
                    serviceLookup =  msg.payload.message;
                }
                if (serviceCache[key].apiURI === serviceLookup){
                    var fileName = PzpCommon.fs.readdirSync(PzpCommon.path.join(serviceCache[key].path, "wrt"));
                    fileName.sort();
                    var proxyJS = "";
                    for (var j=0; j < fileName.length; j = j + 1) {
                        var stat = PzpCommon.fs.statSync(PzpCommon.path.join(serviceCache[key].path, "wrt", fileName[j]));
                        if (!stat.isFile()) continue;
                        try {
                            var data = PzpCommon.fs.readFileSync(PzpCommon.path.join(serviceCache[key].path, "wrt", fileName[j]));
                            proxyJS = proxyJS + data.toString();
                        } catch(err) {
                            logger.log("Webinos module without client side code. ","Using Web RunTime you will not be able to access module " + serviceCache[key].name);
                            proxyJS = "";
                            break;
                        }
                    }

                    if (proxyJS.length > 0) {
                        var serviceName = serviceCache[key].apiURI.split("/");
                        serviceName = serviceName[serviceName.length-1];
                        PzpObject.prepMsg (msg.from, "clientJS", {name: serviceName, js: proxyJS });
                    }
                    return;
                }
            }
        }
    }

    function clientJS(msg){
        PzpCommon.fs.writeFileSync(PzpCommon.path.join(__dirname, "../wrt", msg.payload.message.name+".js"), msg.payload.message.js);
        var nodeModulesPath = PzpCommon.path.join(__dirname, "../node_modules");
        var ownModules = PzpObject.getOwnModules();
        PzpCommon.wUtil.webinosService.createWebinosJS(nodeModulesPath, ownModules);
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

    var  methods= {
        "registerBrowser"      :PzpObject.registerBrowser,
        "enrolRequestCSR"      :beginPzpEnrollment,
        "signedCertByPzh"      :endPzpEnrollment,
        //"pzpId_Update"         :changePzpCertificate,
        "resetDevice"          :PzpObject.unRegisterDevice,
        "gatherTestPageLinks"  :gatherTestPageLinks,
        "configData"           :getConfigData,
        "logs"                 :getWebinosLog,
        "setPzhProviderAddress":function(msg) { expectedPzhAddress="https://" + msg.payload.message;},
        "setDeviceType"        :function(msg) { PzpObject.setDeviceType(msg);},
        "foundServices"        :PzpObject.getServiceListener,
        "listUnregServices"    :PzpObject.listUnRegServices,
        "registerService"      :PzpObject.registerService,
        "unregisterService"    :PzpObject.unRegisterService,
        "syncHash"             :PzpObject.synchronization_compareHash,
        "syncCompare"          :PzpObject.synchronization_findDifference, // PZH Sends this on receipt of syncHash
        "syncPzp"              :PzpObject.synchronization_update,
        "setFriendlyName"      :function(msg) { PzpObject.setFriendlyName(msg);},
        "error"                :function(msg) { PzpObject.prepMsg(msg.to,"error", msg.payload.message);},
        "actionsReceivePending":PzpObject.receivePendingActions,
        "actionAck"            :PzpObject.actionsAcknowledged,
        "keepAlive"            :function(){},
        "syncRemove"           :PzpObject.removeItems,
        "fetchJS"              :fetchJS,
        "clientJS"             :clientJS

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
        handleProcessedMessage(msg, origin, connection);
    };

    /**
     *
     * @param conn
     * @param buffer
     */
    this.handleMsg=function (conn, buffer) {
        try {
            conn.pause (); // This pauses socket, cannot receive messages
            PzpCommon.wUtil.webinosMsgProcessing.readJson(PzpObject.getSessionId(), buffer, function (validMsgObj) {
                handleProcessedMessage(validMsgObj, "TLS", conn);
            });
        } catch (err) {
            PzpObject.emit("EXCEPTION", "failed in processing message received" + err);
        } finally {
            conn.resume ();// unlocks socket.
        }
    };

    function isSameOriginString(urlStringA, urlStringB) {
        var url = require('url');
        return isSameOrigin(url.parse(urlStringA), url.parse(urlStringB));
    }

    function isSameOrigin(urlA, urlB) {
        return  urlA.protocol === urlB.protocol && 
                urlA.port     === urlB.port &&
                urlA.hostname === urlB.hostname;  
    }
    function validEnrolment(msg, origin, expectedAddress) {
        return msg.payload.status === "setPzhProviderAddress" || // it's an initial message which can come from any origin
            (isSameOriginString(origin, expectedAddress) &&      // OR it's from the origin we expected
                (msg.payload.status === "enrolRequestCSR" ||     //   and it's an enrolment request
                    msg.payload.status === "signedCertByPzh" ||
                    msg.payload.status === "pzpId_Update" ));  //   or it's a set of signed certificates.
    }

    function handleProcessedMessage(validMsgObj, origin, conn) {
        if (!logger.id) logger.addId(PzpObject.getSessionId());
        logger.log ("msg received from " + validMsgObj. from + "msg: "+JSON.stringify (validMsgObj) );
        if (PzpObject.checkConnectedPzh(validMsgObj.from)    || // Currently Connected PZH
            PzpObject.checkConnectedPzp(validMsgObj.from)    || // Currently Connected PZPs
            PzpObject.checkConnectedWebApp(validMsgObj.from) || // Currently Connected PZH
            validMsgObj.payload.status === "registerBrowser" || // Special exception as this is first msg from browser
            PzpObject.checkTrustedList(validMsgObj.from)     ||// Entities that are trusted might in same zone or outside zone
            validEnrolment(validMsgObj, origin, expectedPzhAddress) // Enrollment message comes from this address
        ){
            if (validMsgObj.type === "prop") {
                if(methods[validMsgObj.payload.status]){
                    methods[validMsgObj.payload.status].apply(PzpObject,[validMsgObj, conn]);
                } else {
                    logger.error("Invalid message type -"+validMsgObj.payload.status+" message discarded");
                    console.log(new Error().stackTrace);
                }
            } else {
                PzpObject.messageHandler.onMessageReceived(validMsgObj, validMsgObj.to);
            }
        } else {
            logger.log("Message from "+validMsgObj.from+" invalid or disconnected entity");
        }
    }

};
module.exports = PzpReceiveMessage;
