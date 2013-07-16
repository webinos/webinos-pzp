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

    function prepareSyncList() {
        var list = {};
        if (syncInstance) {
            var policyFile = PzpCommon.fs.readFileSync(PzpCommon.path.join(PzpObject.getMetaData("webinosRoot"), "policies", "policy.xml"));
            list = {
                trustedList : PzpObject.getTrustedList(),
                crl         : PzpObject.getCRL(),
                externalCertificates: PzpObject.getExternalCertificateObj(),
                signedCertificates  : PzpObject.getSignedCertificateObj(),
                policy      : policyFile.toString(),
                serviceCache:PzpObject.getServiceCache()
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
        if (syncInstance) PzpObject.prepMsg("syncHash", syncInstance.getObjectHash(prepareSyncList()));
    };
    // On receipt of SyncHash, PZP will find diff of hash that are missing...
    PzpObject.synchronization_compareHash = function(receivedMsg) {
        try{
            if (syncInstance) {
                var ownList = prepareSyncList();
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
            if (Object.keys(msg).length !== 0)PzpObject.prepMsg (receivedMsg.from, "syncUpdate", msg);
            PzpObject.synchronization_update(list,receivedMsg.from);// List is not just having our local changes but accumulated changes received from the PZH
        }
    };
    // This is PZH sending the new additions it has to the PZP, received in syncCompare
    PzpObject.synchronization_update = function(receivedMsg, id) {
        try {
            if(syncInstance) {
                if (receivedMsg && receivedMsg.payload && receivedMsg.payload.message){
                    receivedMsg = receivedMsg.payload.message;
                    id = receivedMsg.from;
                }
                var list = prepareSyncList();
                if (receivedMsg !== {}) {
                    syncInstance.applyObjectContents(list, receivedMsg);
                    for (var key in list){
                        if (list.hasOwnProperty(key)){
                            if (key === "trustedList"&& JSON.stringify(PzpObject.getTrustedList()) !== JSON.stringify(list[key])) {
                                logger.log("During Sync with PZH, trustedList  updated");
                                PzpObject.updateTrustedList(list[key]);
                            } else if (key === "externalCertificates" && JSON.stringify(PzpObject.getExternalCertificates()) !== JSON.stringify(list[key])) {
                                logger.log("During Sync with PZH, external certificates are updated");
                                PzpObject.updateExternalCertificates(list[key]);
                            } else if (key === "signedCertificates" && JSON.stringify(PzpObject.getSignedCertificateObj()) !== JSON.stringify(list[key])) {
                                logger.log("During Sync with PZH, signed certificates are updated");
                                PzpObject.updateSignedCertificates(list[key]);
                            } else if (key === "policy") {
                                // TODO:Update policy file, Will  it require reloading policies, etc
                            } else if (key === "crl" && JSON.stringify(PzpObject.getCRL()) !== JSON.stringify(list[key])) {
                                logger.log("During Sync with PZH, crl is updated");
                                PzpObject.updateCRL(list[key]);
                            } else if (key === "serviceCache" && JSON.stringify(PzpObject.getServiceCache()) !== JSON.stringify(list[key])) {
                                logger.log("During Sync with PZH, serviceCache is updated");
                                PzpObject.updateStoreServiceCache(list[key]);
                            }
                            // NO Cert and CRL Sync up, as PZH is the one that
                        }
                    }
                    logger.log ("Files Synchronised with the PZH");
                }
                PzpObject.decideToKeepConnectionAliveOrClose(id);
            }
        } catch(err){
            logger.error(new Error().stack);
        }
    };
};

module.exports = PzpSync;
