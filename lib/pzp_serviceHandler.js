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
var PzpServiceHandler = function () {
    "use strict";
    var PzpObject = this;
    var PzpCommon = require("./pzp.js");
    var logger    = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var rpcHandler, registry, discovery;
    var serviceListener;

    /**
     * Initializes Webinos Other Components that interact with the session manager
     */
    this.setupRPC_ServiceDiscovery = function () {
        // Initialize RPC
        registry   = new PzpCommon.rpc.Registry(PzpObject);
        rpcHandler = new PzpCommon.rpc.RPCHandler (PzpObject, registry); // Handler for remote method calls.
        discovery  = new PzpCommon.discovery(rpcHandler, [registry]);
        registry.registerObject (discovery);
        rpcHandler.setSessionId (PzpObject.getSessionId());
        // Initialize dashboard
        var dashboard = null;
        try {dashboard = require("webinos-dashboard");}catch (e){logger.log("webinos Dashboard is not present.");}
        if (dashboard != null){
            var dashboardService = new dashboard.Service(rpcHandler, {registry:registry});
            registry.registerObject (dashboardService);
        }
        loadModules();
        return rpcHandler;
    };
    /**
     * Stores service cache
     */
    function setServiceCache(newModules) {
        var serviceCache = PzpObject.getServiceCache();
        var len = serviceCache.length;
        if (newModules.length !== serviceCache.length) {
            newModules.forEach(function(newService){
                var status = false, i =0;
                serviceCache.forEach(function(oldService){
                   if (oldService.name === newService.name)  status= true;
                   // TODO: If module is deleted in oldService list, delete it.
                });
                if(!status) serviceCache.push(newService);
            });
        }
        if (len !== serviceCache.length){
            PzpObject.updateStoreServiceCache(serviceCache);
        }
    }

    function loadModules() {
        var nodeModulesPath = PzpCommon.path.join(__dirname, "../node_modules");
        var newModules = PzpCommon.wUtil.webinosService.checkForWebinosModules(nodeModulesPath);
        setServiceCache(newModules); // Add new Modules in serviceCache
        PzpCommon.wUtil.webinosService.loadServiceModules(PzpObject.getServiceCache(), registry, rpcHandler); // load specified modules
        PzpCommon.wUtil.webinosService.createWebinosJS(nodeModulesPath, PzpObject.getServiceCache()); // Creates initial webinosJSPzp
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
                PzpObject.updateStoreServiceCache(sCache);
                return;
            }
        }

        if (!remove) {
            PzpObject.sCache.splice (i, 0, {"name":name, "params":{}});
            PzpObject.updateStoreServiceCache(sCache);
        }
    }

    PzpObject.unRegisterService = function(validMsgObj) {
        registry.unregisterObject ({
            "id" :validMsgObj.payload.message.svId,
            "api":validMsgObj.payload.message.svAPI
        });
        updateServiceCache (validMsgObj, true);
    };

    PzpObject.registerService = function(validMsgObj) {
        PzpCommon.wUtil.webinosService.loadServiceModule ({
            "name"  :validMsgObj.payload.message.name,
            "params":validMsgObj.payload.message.params
        }, registry, rpcHandler);
        updateServiceCache (validMsgObj, false);
    };

    PzpObject.listUnRegServices = function(validMsgObj) {
        PzpObject.prepMsg ("unregServicesReply", {
            "services":PzpObject.getServiceCache(),
            "id"      :validMsgObj.payload.message.listenerId
        });
    };

    /**
     * Used by RPC to register and update services to the PZH
     */
    PzpObject.onConnect = function() {
        var msg, pzhId;
        pzhId = PzpObject.getPzhId();
        rpcHandler.setSessionId(PzpObject.getSessionId());
        PzpObject.messageHandler.setOwnSessionId(PzpObject.getSessionId());
        if (PzpObject.checkConnectedPzh(pzhId) && PzpObject.getEnrolledStatus()) {
            msg = PzpObject.messageHandler.createRegisterMessage(pzhId, PzpObject.getSessionId());
            PzpObject.messageHandler.onMessageReceived (msg, msg.to);
        }
        PzpObject.prepMsg(pzhId, "registerServices",{services: discovery.getRegisteredServices(),
            "from":PzpObject.getSessionId()});
        if(PzpObject.syncInstance){
            // Here update PZH with PZP changes, comparison is based on the previous connect
            //PzpObject.prepMsg(pzhId, "updateHash", PzpObject.syncInstance.getObjectHash());//
        }
        logger.log ("sent msg to register local services with pzh");
    };

    /**
     * Add callback to be used when PZH sends message about other remote
     * services being available. This is used by the RPCHandler to receive
     * other found services. A privilege function used by RPC
     * @param callback the listener that gets called.
     */
    PzpObject.addRemoteServiceListener = function (callback) {
        serviceListener = callback;
    };

    PzpObject.getServiceListener = function(validMsgObj){
        serviceListener && serviceListener (validMsgObj.payload);
    };
};
module.exports = PzpServiceHandler;
