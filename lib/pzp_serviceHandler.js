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
    var existsSync = PzpCommon.path.existsSync || PzpCommon.fs.existsSync;
    var logger    = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var rpcHandler, registry, discovery, configuration;
    var serviceListener, ownModules;
    PzpObject.deletedItem = {} ;
    /**
     * Initializes Webinos Other Components that interact with the session manager
     */
    this.setupRPC_ServiceDiscovery = function () {
        // Initialize RPC
        logger.addId(PzpObject.getSessionId());
        registry   = new PzpCommon.rpc.Registry(PzpObject);
        rpcHandler = new PzpCommon.rpc.RPCHandler (PzpObject, registry); // Handler for remote method calls.
        discovery  = new PzpCommon.wUtil.webinosServiceDisco.Service(rpcHandler, [registry]);
        registry.registerObject (discovery);
        configuration = new PzpCommon.wUtil.webinosServiceConfig.Service(rpcHandler);
        registry.registerObject (configuration);
        rpcHandler.setSessionId (PzpObject.getSessionId());
        // Initialize dashboard
        var dashboard = null;
        try {dashboard = require("webinos-dashboard");}catch (e){logger.log("webinos Dashboard is not present.");}
        if (dashboard != null){
            var dashboardService = new dashboard.Service(rpcHandler, {registry:registry});
            registry.registerObject (dashboardService);
        }

        // Initialise zone notifications service
        var zoneNotificationsService = new PzpCommon.wUtil.webinosNotifications.NotificationService(rpcHandler, { pzpObject: this });
        registry.registerObject (zoneNotificationsService);

        loadModules();
        return rpcHandler;
    };
    this.getOwnModules = function() {
        return ownModules;
    };
    this.getServices= function() {
        return discovery.getRegisteredServices();
    };
    PzpObject.searchInsideOwnModules = function(id){
        id = PzpCommon.path.normalize(id);
        id = id.substring(1);
        for (var i =0; i < ownModules.length; i = i + 1) {
            if (ownModules[i].testFile === id){
                return true;
            }else if (id.search(ownModules[i].name) >= 0){
                return true;
            }
        }
        return false;
    };

    function loadModules() {
        var nodeModulesPath = PzpCommon.path.join(__dirname, "../node_modules"),
            userDataPath = PzpCommon.path.join(PzpObject.getMetaData("webinosRoot"), "userData");
        ownModules = PzpCommon.wUtil.webinosService.checkForWebinosModules(nodeModulesPath, userDataPath);
        PzpCommon.wUtil.webinosService.loadServiceModules(ownModules, registry, rpcHandler,
          { http :
            { port : PzpObject.getWebinosPorts("pzp_webSocket")
            , hostname : PzpObject.getPzpHost()
            }
          }, PzpObject.moduleHttpHandlers); // load specified modules
        var ownMod = PzpObject.getServiceCache();
        var len = ownMod.length;
        var ownServices = PzpObject.getServices();
        for (var i = 0; i < len; ){
            if (ownMod[i].serviceAddress === PzpObject.getSessionId()){
                var found = false;
                for (var j =0 ; j < ownServices.length; j++) {
                    if (ownServices[j].api === ownMod[i].api) {
                        found = true;
                    }
                }
                if (found === false) {
                    logger.log("Removing service "+ ownMod[i].api);
                    PzpObject.deletedItem[ownMod[i].id] = ownMod[i];
                    ownMod.splice(i, 1);
                    len--;
                } else {
                    i++;
                }
            } else {
                i++;
            }
        }
        //if (ownMod.length !== PzpObject.getServiceCache().length)
        PzpObject.updateStoreServiceCache(ownMod);
        PzpCommon.wUtil.webinosService.createWebinosJS(nodeModulesPath, ownModules); // Creates initial webinosJSPzp
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

    PzpObject.setServiceConfiguration = function(serviceID, apiURI, params){
        var foundModule, services;
        for (var i = 0; i < ownModules.length; i++) {
            if(ownModules[i].apiURI === apiURI) {
                foundModule = ownModules[i];
                break;
            }
        }

        if(foundModule){
            services = PzpObject.getServices();

            if (serviceID) {
                for (i = 0 ; i < services.length; i++) {
                    if (services[i].id === serviceID && services[i].api === apiURI) {
                        registry.unregisterObject({"id": serviceID, "api": apiURI});
                    }
                }
                foundModule.params.instances = foundModule.params.instances.concat(params);
            } else { // Unregister all the services of the same API type
                for (i = 0 ; i < services.length; i++) {
                    if (services[i].api === apiURI) {
                        registry.unregisterObject({"id":services[i].id, "api": apiURI});
                    }
                }
                foundModule.params.instances = params;
            }

            //TODO: difference between service/API
            PzpCommon.wUtil.webinosService.loadServiceModule(foundModule, registry, rpcHandler,
                { http :
                    { port : PzpObject.getWebinosPorts("pzp_webSocket")
                    , hostname : PzpObject.getPzpHost()
                    }
                }, PzpObject.moduleHttpHandlers, true); // load specified modules
            return true;
        }

        return false;
    };

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

    PzpObject.addRemoteServices = function(validMsgObj){
        discovery.addRemoteServiceObjects(validMsgObj);
        //PzpObject.updateStoreServiceCache(validMsgObj);
    };
    /**
     * Used by RPC to register and update services to the PZH
     */
    PzpObject.onConnect = function(id) {
        var msg, pzhId;
        rpcHandler.setSessionId(PzpObject.getSessionId());
        PzpObject.messageHandler.setOwnSessionId(PzpObject.getSessionId());
        msg = PzpObject.messageHandler.createRegisterMessage(id, PzpObject.getSessionId());
        PzpObject.messageHandler.onMessageReceived (msg, msg.to);
        PzpObject.registerBrowser();
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
