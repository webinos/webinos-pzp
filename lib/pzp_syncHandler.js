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
//                trustedList : PzpObject.getTrustedList(), // FIXME: before enrollment this is empty, therefor don't sync this to PZH
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

    PzpObject.syncPending = false;

    PzpObject.initialize_SyncManager = function(){
        var syncManager = PzpCommon.wUtil.webinosSync;
        if (syncManager) {
            syncInstance = new syncManager.sync();
            logger.addId(PzpObject.getSessionId());
        }
    };

    // Triggered after PZP connection
    PzpObject.synchronizationStart = function(){
        // If there is a pzh available
        if (syncInstance && PzpObject.getPzhId()) {
          if (PzpObject.syncPending === false) {
            PzpObject.syncPending = true;
            process.nextTick(function() {
            PzpObject.prepMsg("syncHash", syncInstance.getObjectHash(prepareSyncList()));
              PzpObject.syncPending = false;
            });
          }
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

  // On response of syncCompare, PZP checks the difference at its end and send missing contents to the PZH...
    PzpObject.synchronization_findDifference = function(receivedMsg) {
        if (syncInstance && receivedMsg) {
            var list = prepareSyncList();
            var msg = syncInstance.sendObjectContents(list, receivedMsg.payload.message);
            if (Object.keys(msg).length !== 0) {
               PzpObject.prepMsg (receivedMsg.from, "syncPzh", msg);
            }
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

                if (receivedMsg.hasOwnProperty("serviceCache")){
                  // This PZP owns the local list of services, so remove all local services from the remote list.
                  receivedMsg["serviceCache"] = receivedMsg["serviceCache"].filter(function(svc) { return svc.serviceAddress !== PzpObject.getSessionId(); });

                  // Remove all remote services from local list, this will ensure a complete sync of remote services,
                  // including removal of obsolete services.
                  if (list.hasOwnProperty("serviceCache")) {
                    list["serviceCache"] = list["serviceCache"].filter(function(svc) { return svc.serviceAddress === PzpObject.getSessionId(); });
                  }
                }

                var inNeedOfSync = 0;
                var newList={};
                var text = "";
                    syncInstance.applyObjectContents(list, receivedMsg, PzpObject.getSessionId()); // After this step list is combined copy of local and remote copy
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
                    if (text!="") {
                    logger.log("Synced with PZH, updated following items : "+text);
                    } else {
                        logger.log("Nothing synced with PZH");
                    }
                // At this moment everything is synced, send sync to PZH. If there is anything that;s not synced could be synced with PZH
                var checkChanges =  syncInstance.getObjectHash(list);
                for ( key in checkChanges ){
                    if (checkChanges.hasOwnProperty(key)){
                            if ((key === "serviceCache" || key ==="trustedList") && pzhCache[key] && checkChanges[key]!== pzhCache[key]) {
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
                pzhCache = {};
            }
        } catch(err){
            logger.error(err);
            logger.error(new Error().stack);
        }
    };
    this.removeItems = function(msg){
        if (msg.from === PzpObject.getPzhId()) {
            msg = msg.payload.message;
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
        PzpObject.registerBrowser();
    }
};

module.exports = PzpSync;
