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

    var sync;
    try {
        if (require.resolve("webinos-synchronization")) {
            sync = require("webinos-synchronization");
        }
    } catch(err){
        logger.error("webinos synchronization module is missing");
    }

        /**
     * Any entity connecting to PZP has to register its address with other end point
     */
    function registerMessaging (pzhId) {
        if (PzpObject.getConnectedPzh().hasOwnProperty(pzhId) && PzpObject.getEnrolledStatus()) {
            var msg = PzpObject.messageHandler.registerSender(PzpObject.getSessionId(), pzhId);
            PzpObject.sendMessage(msg, pzhId);
        }
    }

    function syncHash (receivedMsg) {
        if (sync) {
            var policyPath = PzpCommon.path.join(PzpObject.getWebinosPath(), "policies", "policy.xml");
            var sync = require("webinos-synchronization");
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

    function updateServiceCache (validMsgObj, remove) {
        var name, url, list;
        url = PzpCommon.url.parse (validMsgObj.payload.message.svAPI);
        if (url.slashes) {
            if (url.host === "webinos.org") {
                name = url.pathname.split ("/")[2];
            } else if (url.host === "www.w3.org") {
                name = url.pathname.split ("/")[3];
            } else {
                name = validMsgObj.payload.message.svAPI;
            }
        }
        var sCache = PzpObject.getServiceCache();
        for (var i = 0; i < sCache.length; i = i + 1) {
            if (sCache[i].name === name) {
                if (remove) {
                    sCache.splice (i, 1);
                }
                PzpObject.storeDetails(PzpCommon.path("userData", "serviceCache"), sCache);
                return;
            }
        }

        if (!remove) {
            PzpObject.sCache.splice (i, 0, {"name":name, "params":{}});
            PzpObject.storeDetails(PzpCommon.path("userData", "serviceCache"), sCache);
        }
    }

    function unRegisterService (validMsgObj) {
        registry.unregisterObject ({
            "id" :validMsgObj.payload.message.svId,
            "api":validMsgObj.payload.message.svAPI
        });
        updateServiceCache (validMsgObj, true);
    }

    function registerService (validMsgObj) {
        PzpCommon.wUtil.webinosService.loadServiceModule ({
            "name"  :validMsgObj.payload.message.name,
            "params":validMsgObj.payload.message.params
        }, registry, rpcHandler);
        updateServiceCache (validMsgObj, false);
    }

    function listUnRegServices (validMsgObj) {
        var data = require ("fs").readFileSync ("./webinos_config.json");
        var c = JSON.parse (data.toString ());
        PzpObject.prepMsg ("unregServicesReply", {
                "services":c.pzpDefaultServices,
                "id"      :validMsgObj.payload.message.listenerId
            });
    }

    function updateDeviceInfo(validMsgObj) {
        var i;
        if (PzpObject.getConnectedPzh().hasOwnProperty(validMsgObj.from)) {
            PzpObject.getConnectedPzh()[validMsgObj.from].friendlyName = validMsgObj.payload.message.friendlyName;
            if (PzpObject.getFriendlyName().indexOf(validMsgObj.payload.message.friendlyName) === -1) {
                PzpObject.setFriendlyName(validMsgObj.payload.message.friendlyName + "'s " + PzpObject.getFriendlyName());
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
    this.loadModules = function() {
        var newModules = PzpCommon.wUtil.webinosService.checkForNewWebinosModules(PzpObject.getServiceCache());
        PzpObject.setServiceCache(newModules); // Add new Modules in serviceCache
        PzpCommon.wUtil.webinosService.loadServiceModules(PzpObject.getServiceCache(), registry, rpcHandler); // load specified modules
        PzpCommon.wUtil.webinosService.createWebinosJS(); //Creates initial webinosJSPzp
    };
    /**
     * Initializes Webinos Other Components that interact with the session manager
     */
    this.initializeRPC_Message = function () {
        // Initialize RPC
        registry = new PzpCommon.rpc.Registry(PzpObject);
        rpcHandler = new PzpCommon.rpc.RPCHandler (PzpObject, registry); // Handler for remote method calls.
        discovery = new PzpCommon.discovery(rpcHandler, [registry]);
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
        PzpObject.messageHandler.setGetOwnId (PzpObject.getSessionId());
        PzpObject.messageHandler.setObjectRef (PzpObject);
        PzpObject.messageHandler.setSendMessage (send);
        PzpObject.messageHandler.setSeparator ("/");
        registerMessaging (PzpObject.getPzhId());    //message handler
    };

    /**
     * Used by RPC to register and update services to the PZH
     */
    this.registerServicesWithPzh = function () {
        var pzhId = PzpObject.getPzhId();
        if (PzpObject.getConnectedPzh().hasOwnProperty(pzhId) && PzpObject.getEnrolledStatus()) {
            var localServices = discovery.getRegisteredServices ();
            var msg = {"type":"prop",
                "from"       :pzhId,
                "to"         :pzhId,
                "payload"    :{"status":"registerServices",
                    "message":{services:localServices,
                       "from":PzpObject.getSessionId()}}};
            PzpObject.sendMessage (msg, pzhId);
            logger.log ("sent msg to register local services with pzh");
        }

    };

    /**
     * Called when PZP is connected to Hub or in case if error occurs in PZP connecting
     */
    this.startOtherManagers = function (){
        PzpObject.initializeRPC_Message(); // Initializes RPC & load default module
        PzpObject.loadModules();
        PzpObject.setupMessage_RPCHandler();
        PzpObject.registerServicesWithPzh (); //rpc
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
    };

    /**
     * Add callback to be used when PZH sends message about other remote
     * services being available. This is used by the RPCHandler to receive
     * other found services. A privilege function used by RPC
     * @param callback the listener that gets called.
     */
    this.addRemoteServiceListener = function (callback) {
        serviceListener = callback;
    };

    /**
     * Processes message received from the PZP
     * @param msgObj - the buffer array received from other webinos end point
     */
    this.processMsg = function (msgObj) {
        try {
            PzpCommon.wUtil.webinosMsgProcessing.processedMsg (PzpObject, msgObj, function (validMsgObj) {
                logger.log ("msg received " + JSON.stringify (validMsgObj));
                if (PzpObject.checkConnectedPzh(validMsgObj.from) || PzpObject.checkConnectedPzp(validMsgObj.from) ||
                    PzpObject.checkConnectedWebApp(validMsgObj.from)){
                    if (validMsgObj.type === 'prop') {
                        switch (validMsgObj.payload.status) {
                            case'foundServices':
                                serviceListener && serviceListener (validMsgObj.payload);
                                break;
                            case "findServices":
                                setFoundService (validMsgObj);
                                break;
                            case 'listUnregServices':
                                listUnRegServices (validMsgObj);
                                break;
                            case 'registerService':
                                registerService (validMsgObj);
                                break;
                            case'unregisterService':
                                unRegisterService (validMsgObj);
                                break;
                            case "sync_hash":
                                syncHash (validMsgObj.payload.message);
                                break;
                            case "update_hash":
                                updateHash (validMsgObj.payload.message);
                                break;
                            case "update":
                                updateDeviceInfo(validMsgObj);
                                break;
                            case "changeFriendlyName":
                                PzpObject.changeFriendlyName(validMsgObj.payload.message);
                                break;
                        }
                    } else {
                        PzpObject.messageHandler.onMessageReceived (validMsgObj, validMsgObj.to);
                    }
                } else {
                    logger.log("Message from "+validMsgObj.from+" unconnected entity");
                }
            });
        } catch(err){
            logger.error("Error in processing message" + err);
        }
    }
};

require("util").inherits(PzpOtherManager, PzpServer);
module.exports = PzpOtherManager;
