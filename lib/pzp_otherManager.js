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
    var notificationSyncInterval = 5000;

    function initialize_PolicyManager(rpcHandler) {
        try {
            if (require.resolve("webinos-policy")) {
                var rpcInterception = require(PzpCommon.path.join(require.resolve("webinos-policy"), "../../lib/rpcInterception.js"));
                rpcInterception.initialize(rpcHandler, PzpObject.getMetaData("webinosRoot"), PzpObject.notificationManager);
            }
        } catch(err){
            logger.error("Webinos Policy Manager is not present. It is insecure to run webinos without policy enforcement.");
            logger.error(err);
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
                    peerDiscovery.advertPzp('zeroconf', PzpObject.getWebinosPorts("pzp_zeroConf"));
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
        PzpObject.messageHandler = new PzpCommon.wUtil.webinosMessaging.MessageHandler (rpcHandler); // handler for all things message
        var send = function (message, address) {
            "use strict";
            PzpObject.sendMessage (message, address);
        };
        PzpObject.messageHandler.setOwnSessionId (PzpObject.getSessionId());
        PzpObject.messageHandler.setSendMessage (send);
        PzpObject.messageHandler.setSeparator ("/");
    }

    function scheduleNotificationSync() {
      if (!PzpObject.notificationSyncPending) {
        PzpObject.notificationSyncPending = true;
        setTimeout(function() {
          PzpObject.synchronizationStart();
          PzpObject.notificationSyncPending = false;
        }, notificationSyncInterval);
      }
    }

    function initialize_Notifications() {
      PzpObject.notificationManager = new PzpCommon.wUtil.webinosNotifications.NotificationManager();
      PzpObject.notificationSyncPending = false;
      PzpObject.notificationManager.on(PzpObject.notificationManager.notifyType.all, function() {
        scheduleNotificationSync();
      });
    }

    /**
     * Called when PZP is connected to Hub or in case if error occurs in PZP connecting
     */
    this.startOtherManagers = function (){
        var rpcHandler = PzpObject.setupRPC_ServiceDiscovery(); // Initializes RPC & load default module
        initialize_MessageHandler(rpcHandler);
        initialize_Notifications();
        initialize_PolicyManager(rpcHandler);
        PzpObject.initialize_SyncManager();
        initialize_PeerDiscovery();
        //require(PzpCommon.dependency.global.manager.context_manager.location);//initializes context manager
    };
};
require("util").inherits(PzpOtherManager, PzpServiceHandler);
module.exports = PzpOtherManager;
