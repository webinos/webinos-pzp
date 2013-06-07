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
 * Author: Habib Virji (habib.virji@samsung.com)
 *         Ziran Sun (ziran.sun@samsung.com)
 *******************************************************************************/
var PzpServiceHandler = require("./pzp_serviceHandler.js");
var PzpOtherManager = function () {
    "use strict";
    PzpServiceHandler.call(this);
    var PzpCommon = require("./pzp.js");
    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var peerDiscovery;
    var PzpObject = this;

    function initialize_PolicyManager(rpcHandler) {
        try {
            if (require.resolve("webinos-policy")) {
                var pm = require(PzpCommon.path.join(require.resolve("webinos-policy"), "../../lib/rpcInterception.js"));
                pm.setWebinosPath(PzpObject.getWebinosPath());
                var polPath = PzpCommon.path.join(
                    require.resolve("webinos-policy"), "..", "rpcInterception.js");
                pm = require(polPath);
                pm.setRPCHandler(rpcHandler);
            }
        } catch(err){
            logger.log("Webinos Policy Manager is not present. It is insecure to run webinos without policy enforcement.");
            logger.log(err);
        }
    }

    function initialize_SyncManager(){
        var syncManager = require("webinos-synchronization");
        if (syncManager) {
            PzpObject.syncInstance = new syncManager.sync();
        }
    }

    function initialize_PeerDiscovery() {
        if (!peerDiscovery) {// local discovery&& mode !== modes[0]
            if (PzpCommon.os.type ().toLowerCase () == "windows_nt") {
                //Do nothing until WinSockWatcher works
            }
            else {
                try {
                    var PzpDiscovery = require("./pzp_peerDiscovery.js");
                    peerDiscovery = new PzpDiscovery (PzpObject);
                    peerDiscovery.advertPzp('zeroconf', PzpObject.getPorts().pzp_zeroConf);
                } catch(err){
                    PzpObject.emit("MODULE_MISSING", "Pzp Local Discovery module is missing")
                }
            }
        }
    }

    /**
     * Setups message rpc handler, this is tied to sessionId, should be called when sessionId changes
     */
    function initialize_MessageHandler(rpcHandler) {
        // Initialize messaging
        PzpObject.messageHandler = new PzpCommon.messageHandler (rpcHandler); // handler for all things message
        var send = function (message, address) {
            "use strict";
            PzpObject.sendMessage (message, address);
        };
        PzpObject.messageHandler.setOwnSessionId (PzpObject.getSessionId());
        PzpObject.messageHandler.setSendMessage (send);
        PzpObject.messageHandler.setSeparator ("/");
    }

    /**
     * Called when PZP is connected to Hub or in case if error occurs in PZP connecting
     */
    this.startOtherManagers = function (){
        var rpcHandler = PzpObject.setupRPC_ServiceDiscovery(); // Initializes RPC & load default module
        initialize_MessageHandler(rpcHandler);
        initialize_PolicyManager(rpcHandler);
        initialize_SyncManager();
        initialize_PeerDiscovery();
        //require(PzpCommon.dependency.global.manager.context_manager.location);//initializes context manager
    };

    this.prepareSyncList = function(callback) {
        if (PzpObject.syncInstance) {
            var policyFile = PzpCommon.fs.readFileSync(PzpCommon.path.join(PzpObject.getWebinosPath(), "policies", "policy.xml"));
            require("webinos-synchronization").parseXML (policyFile.toString(), function (JSONPolicies) {
                var list = {
                    trustedList : PzpObject.getTrustedList(),
                    crl         : PzpObject.getCRL(),
                    certificates: PzpObject.getExternalCertificates(),
                    policy      : JSONPolicies["policy"]
                    // @toby add your notification here...
                };
                callback(list);
            });
        }
    };
    // Triggered after PZP connection
    // @toby call this function when you want sync to start...
    PzpObject.synchronizationStart = function(){
        if (PzpObject.syncInstance) {
            PzpObject.prepareSyncList(function(list){
                PzpObject.sendMessageAll("syncHash",list );
            });
        }
    };
};
require("util").inherits(PzpOtherManager, PzpServiceHandler);
module.exports = PzpOtherManager;
