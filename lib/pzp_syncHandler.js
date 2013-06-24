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

    function prepareSyncList(callback) {
        if (syncInstance) {
            var policyFile = PzpCommon.fs.readFileSync(PzpCommon.path.join(PzpObject.getMetaData("webinosRoot"), "policies", "policy.xml"));
            require("webinos-synchronization").parseXML (policyFile.toString(), function (JSONPolicies) {
                var list = {
                    trustedList : PzpObject.getTrustedList(),
                    crl         : PzpObject.getCRL(),
                    certificates: PzpObject.getExternalCertificateObj(),
                    policy      : JSONPolicies["policy"],
                    serviceCache:PzpObject.getServiceCache()
                    // @toby add your notification here...
                };
                callback(list);
            });
        }
    }

    PzpObject.initialize_SyncManager = function(){
        var syncManager = require("webinos-synchronization");
        if (syncManager) {
            syncInstance = new syncManager.sync();
        }
    };

    // Triggered after PZP connection
    // @toby call this function when you want sync to start...
    PzpObject.synchronizationStart = function(){
        if (syncInstance) {
            prepareSyncList(function(list){
                PzpObject.prepMsg("syncHash", syncInstance.getObjectHash(list));
            });
        }
    };
    // On receipt of SyncHash, PZP will find diff of hash that are missing...
    PzpObject.synchronization_compareHash = function(receivedMsg) {
        try{
            if (syncInstance){
                prepareSyncList(function(list){
                    var list_ = syncInstance.compareObjectHash(list, receivedMsg.payload.message);
                    PzpObject.prepMsg(receivedMsg.from, "syncCompare", list_);
                });
            }
        } catch(err) {
            logger.error(err);
        }
    };
    // On response of syncCompare, PZP checks the difference at its end and send missing contents to the PZH...
    PzpObject.synchronization_findDifference = function(receivedMsg) {
        if (syncInstance && receivedMsg) {
            prepareSyncList(function(list) { // Get your own list
                PzpObject.prepMsg (receivedMsg.from, "syncUpdate", syncInstance.sendObjectContents(list, receivedMsg.payload.message));
                PzpObject.synchronization_update(list);// List is not just having our local changes but accumulated changes received from the PZH
            });
        }
    };
    // This is PZH sending the new additions it has to the PZP, received in syncCompare
    PzpObject.synchronization_update = function(receivedMsg) {
        if(syncInstance) {
            prepareSyncList(function(list) { // Please note this list is different
                if (receivedMsg && receivedMsg.payload && receivedMsg.payload.message) receivedMsg = receivedMsg.payload.message;
                syncInstance.applyObjectContents(list, receivedMsg);
                for (var key in list){
                    if (list.hasOwnProperty(key)){
                        if (key === "trustedList"&& PzpObject.getTrustedList() !== list[key]) {
                            logger.log("During Sync with PZH, trustedList  updated");
                            PzpObject.updateTrustedList(list[key]);
                        } else if (key === "certificates" && PzpObject.getExternalCertificates() !== list[key]) {
                            logger.log("During Sync with PZH, certificates is updated");
                            PzpObject.updateExternalCertificates(list[key]);
                        } else if (key === "policy") {
                            // TODO:Update policy file, Will  it require reloading policies, etc
                        } else if (key === "crl" && PzpObject.getCRL() !== list[key]) {
                            logger.log("During Sync with PZH, crl is updated");
                            PzpObject.updateCRL(list[key]);
                        } else if (key === "serviceCache" && PzpObject.getServiceCache() !== list[key]) {
                            logger.log("During Sync with PZH, serviceCache is updated");
                            PzpObject.updateStoreServiceCache(list[key]);
                            //PzpObject.addRemoteServices(list[key]);
                        }
                        // NO Cert and CRL Sync up, as PZH is the one that
                    }
                }
                logger.log ("Files Synchronised with the PZH");

            });
        }
    };
};

module.exports = PzpSync;