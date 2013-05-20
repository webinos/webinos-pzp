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
    console.log("serviceHandler");
    var PzpCommon = require("./pzp.js");
    var PzpObject = this; 
    var logger    = PzpCommon.wUtil.webinosLogging(__filename) || console;
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

    PzpObject.unRegisterService = function(validMsgObj) {
        registry.unregisterObject ({
            "id" :validMsgObj.payload.message.svId,
            "api":validMsgObj.payload.message.svAPI
        });
        updateServiceCache (validMsgObj, true);
    }

    PzpObject.registerService = function(validMsgObj) {
        PzpCommon.wUtil.webinosService.loadServiceModule ({
            "name"  :validMsgObj.payload.message.name,
            "params":validMsgObj.payload.message.params
        }, registry, rpcHandler);
        updateServiceCache (validMsgObj, false);
    }

    PzpObject.listUnRegServices = function(validMsgObj) {
        PzpObject.prepMsg ("unregServicesReply", {
                "services":PzpObject.getServiceCache(),
                "id"      :validMsgObj.payload.message.listenerId
            });
    }
	
    PzpObject.loadModules = function() {
        var newModules = PzpCommon.wUtil.webinosService.checkForNewWebinosModules(PzpObject.getServiceCache());
        PzpObject.setServiceCache(newModules); // Add new Modules in serviceCache
        PzpCommon.wUtil.webinosService.loadServiceModules(PzpObject.getServiceCache(), registry, rpcHandler); // load specified modules
        PzpCommon.wUtil.webinosService.createWebinosJS(); //Creates initial webinosJSPzp
    };
    /**
     * Used by RPC to register and update services to the PZH
     */
    PzpObject.on("HUB_CONNECTED", function() {
        console.log("HUB CONNECTED");
        rpcHandler.setSessionId(PzpObject.getSessionId());
        PzpObject.messageHandler.setOwnSessionId(PzpObject.getSessionId());
        var pzhId = PzpObject.getPzhId();
        var msg = PzpObject.prepMsg(pzhId, "registerServices",{services:discovery.getRegisteredServices(),
            "from":PzpObject.getSessionId()});
        PzpObject.sendMessage (msg, pzhId);
        logger.log ("sent msg to register local services with pzh");
    });
    /**
     * Add callback to be used when PZH sends message about other remote
     * services being available. This is used by the RPCHandler to receive
     * other found services. A privilege function used by RPC
     * @param callback the listener that gets called.
     */
    PzpObject.addRemoteServiceListener = function (callback) {
        serviceListener = callback;
    };
	PzpObject.getRemoveServiceListener = function(){
		return serviceListener;
	};
};
module.exports = PzpServiceHandler;
