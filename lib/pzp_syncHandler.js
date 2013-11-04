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
var PzpSync = function () {
    "use strict";
    var PzpObject = this;
    var PzpCommon = require("./pzp.js");
    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var syncInstance;
    var pzhCache = {};

    function prepareSyncList() {
        var list = {};
        if (syncInstance) {
           //var policyFile = PzpCommon.fs.readFileSync(PzpCommon.path.join(PzpObject.getMetaData("webinosRoot"), "policies", "policy.xml"));
            list = {
                trustedList : PzpObject.getTrustedList(),
                crl         : PzpObject.getCRL(),
                externalCertificates: PzpObject.getExternalCertificateObj(),
                signedCertificates  : PzpObject.getSignedCertificateObj(),
                /*policy      : policyFile.toString(),*/
                serviceCache:PzpObject.getServiceCache(),
                connectedDevices: PzpObject.getConnectedDevices()
            };
        }
        return list;
    }

    PzpObject.initialize_SyncManager = function(){
        var syncManager = PzpCommon.wUtil.webinosSync;
        if (syncManager) {
            syncInstance = new syncManager.sync();
            logger.addId(PzpObject.getSessionId());
        }
    };

    // Triggered after PZP connection
    // @toby call this function when you want sync to start...
    PzpObject.synchronizationStart = function(){
        if (syncInstance) {
            PzpObject.prepMsg("syncHash", syncInstance.getObjectHash(prepareSyncList()));
        }
    };
    // On receipt of SyncHash, PZP will find diff of hash that are missing...
    PzpObject.synchronization_compareHash = function(receivedMsg) {
        try{
            if (syncInstance &&  receivedMsg.payload.message) {
                var ownList = prepareSyncList();
                pzhCache = receivedMsg.payload.message;
                var list_ = syncInstance.compareObjectHash(ownList, receivedMsg.payload.message);
                if (list_.length !== 0) {
                    PzpObject.prepMsg(receivedMsg.from, "syncCompare", list_);
                } else {
                    logger.log("Nothing to sync with the PZH");
                    PzpObject.decideToKeepConnectionAliveOrClose(receivedMsg.from);
                }
            }
        } catch(err) {
            PzpObject.emit("EXCEPTION", err);
        }
    };
    // This is PZH sending the new additions it has to the PZP, received in syncCompare
    PzpObject.synchronization_update = function(receivedMsg, id) {
        try {
            if(syncInstance) {
                if (receivedMsg && receivedMsg.payload && receivedMsg.payload.message){
                    id = receivedMsg.from;
                    receivedMsg = receivedMsg.payload.message;
                }
                var list = prepareSyncList();
                //list.connectedDevices={pzh:[],pzp:[]};
//                var beforeApply = syncInstance.getObjectHash(list);
//                var pzhCache = syncInstance.getObjectHash(receivedMsg);
                var inNeedOfSync = 0;
                var newList={};
                var text = "";
                if (receivedMsg !== {}) {
                    syncInstance.applyObjectContents(list, receivedMsg); // After this step list is combined copy of local and remote copy
                    for (var key in list){
                        if (list.hasOwnProperty(key)){
                            if (key === "trustedList"&& JSON.stringify(PzpObject.getTrustedList()) !== JSON.stringify(list[key])) {
                                PzpObject.updateTrustedList(list[key]);
                                text += " Trusted List,";
                            } else if (key === "externalCertificates" && JSON.stringify(PzpObject.getExternalCertificateObj()) !== JSON.stringify(list[key])) {
                                PzpObject.updateExternalCertificates(list[key]);
                                text += " External Certificates,";
                            } else if (key === "signedCertificates" && JSON.stringify(PzpObject.getSignedCertificateObj()) !== JSON.stringify(list[key])) {
                                PzpObject.updateSignedCertificates(list[key]);
                                text += " Signed Certificates,";
                            } else if (key === "policy") {
                                // TODO:Update policy file, Will  it require reloading policies, etc
                            } else if (key === "crl" && JSON.stringify(PzpObject.getCRL()) !== JSON.stringify(list[key])) {
                                PzpObject.updateCRL(list[key]);
                                text += " CRL,";
                            } else if (key === "serviceCache" && JSON.stringify(PzpObject.getServiceCache()) !== JSON.stringify(list[key])) {
                                PzpObject.updateStoreServiceCache(list[key]);
                                text += " Service Cache,";
                            } else if (key === "connectedDevices" && JSON.stringify(PzpObject.getConnectedDevices()) !== JSON.stringify(list[key])) {
                                PzpObject.updateConnectedDevices(list[key]);
                                text += " Connected Devices,";
                            } else if (key === "notificationConfig" && JSON.stringify(PzpObject.notificationManager.getConfig()) !== JSON.stringify(list[key])) {
                                PzpObject.notificationManager.setConfig(list[key]);
                                text += " Notification Manager";
                             }
                            // NO Cert and CRL Sync up, as PZH is the one that
                        }
                    }
                    logger.log("Synced with PZH, updated following items : "+text);
                }
                // At this moment everything is synced, send sync to PZH. If there is anything that;s not synced could be synced with PZH
                var checkChanges =  syncInstance.getObjectHash(list);
                for ( key in checkChanges ){
                    if (checkChanges.hasOwnProperty(key)){
                        if ((key === "serviceCache" || key ==="trustedList") && checkChanges[key]!== pzhCache[key]) {
                            newList[key] = list[key];
                            inNeedOfSync = 1;
                        }
                    }
                }
                if (inNeedOfSync === 1){
                   logger.log("PZP is in need of sync ");
                   PzpObject.prepMsg (id, "syncPzh", newList);
                }
                PzpObject.decideToKeepConnectionAliveOrClose(id);
            }
        } catch(err){
            logger.error(err);
            logger.error(new Error().stack);
        }
    };
    this.removeItems = function(msg){
        if (msg.from === PzpObject.getPzhId()) {
            msg = msg.payload.message;
            console.log(msg);
            if (msg["connectedDevices"]) {
                var connDevices = PzpObject.getConnectedDevices();
                if (msg["connectedDevices"].pzp)
                    connDevices.pzp = msg["connectedDevices"].pzp;
                if (msg["connectedDevices"].pzh)
                    connDevices.pzh = msg["connectedDevices"].pzh;
                PzpObject.updateConnectedDevices(connDevices);
            }
            if (msg["trustedList"]){
                var trustedList = PzpObject.getTrustedList();
                if (msg["trustedList"].pzp)
                    trustedList.pzp = msg["trustedList"].pzp;
                if (msg["trustedList"].pzh)
                    trustedList.pzh = msg["trustedList"].pzh;
                PzpObject.updateTrustedList(trustedList);
            }
            if (msg["externalCertificates"]){
                PzpObject.updateExternalCertificates(msg["externalCertificates"]);
            }
            if (msg["signedCertificates"]){
                PzpObject.updateSignedCertificates(msg["signedCertificates"]);
            }
            if (msg["serviceCache"]){
                PzpObject.updateStoreServiceCache(msg["serviceCache"]);
            }
        }
        console.log(prepareSyncList())
        PzpObject.registerBrowser();
    }
};

module.exports = PzpSync;
