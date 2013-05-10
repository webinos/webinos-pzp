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

var PzpServer = require("./pzp_tlsServer.js");
var PzpOtherManager = function () {
    console.log("pzp other");
    PzpServer.call(this);
    var PzpCommon = require("./pzp.js");
    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var serviceListener;   // For a single callback to be registered via addRemoteServiceListener.
    this.messageHandler ={};
    var registry;
    var rpcHandler;
    var discovery;
    var peerDiscovery;
    var PzpObject = this;

    function initialize_PolicyManager() {
        try {
            if (require.resolve("webinos-policy")) {
                var pm = require(PzpCommon.path.join(require.resolve("webinos-policy"), "../../lib/rpcInterception.js"));
                pm.setRPCHandler(rpcHandler);
            }
        } catch(err){
            logger.log("Webinos Policy Manager is not present. It is unSecure to run PZP without policy");
            return;
        }
    }

    /**
     * Any entity connecting to PZP has to register its address with other end point
     */
    this.messageHandlerRegistration = function(id) {
        rpcHandler.setSessionId(PzpObject.getSessionId());
        PzpObject.messageHandler.setOwnSessionId(PzpObject.getSessionId());
        if (PzpObject.checkConnectedPzh(id) && PzpObject.getEnrolledStatus()) {
            var msg = PzpObject.messageHandler.createRegisterMessage(id, PzpObject.getSessionId());
            PzpObject.messageHandler.onMessageReceived (msg, msg.to);
        }
    };

    /**
     * Initializes Webinos Other Components that interact with the session manager
     */
    this.initializeRPC_Message = function () {
        // Initialize RPC
        registry   = new PzpCommon.rpc.Registry(PzpObject);
        rpcHandler = new PzpCommon.rpc.RPCHandler (PzpObject, registry); // Handler for remote method calls.
        discovery  = new PzpCommon.discovery(rpcHandler, [registry]);
        registry.registerObject (discovery);
        // Initialize messaging
        PzpObject.messageHandler = new PzpCommon.messageHandler (rpcHandler); // handler for all things message
        // Initialize Policy Manager - rpc interception
        initialize_PolicyManager();
        //require(PzpCommon.dependency.global.manager.context_manager.location);//initializes context manager
    };

    /**
     * Setups message rpc handler, this is tied to sessionId, should be called when sessionId changes
     */
    this.setupMessage_RPCHandler = function () {
        var send = function (message, address, object) {
            "use strict";
            PzpObject.sendMessage (message, address);
        };
        rpcHandler.setSessionId (PzpObject.getSessionId());
        PzpObject.messageHandler.setOwnSessionId (PzpObject.getSessionId());
        PzpObject.messageHandler.setSendMessage (send);
        PzpObject.messageHandler.setSeparator ("/");
    };

    /**
     * Called when PZP is connected to Hub or in case if error occurs in PZP connecting
     */
    this.startOtherManagers = function (){
        PzpObject.initializeRPC_Message(); // Initializes RPC & load default module
        PzpObject.loadModules();
        PzpObject.setupMessage_RPCHandler();
        startPeerDiscovery();
    };

    function startPeerDiscovery() {
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


};

require("util").inherits(PzpOtherManager, PzpServer);
module.exports = PzpOtherManager;
