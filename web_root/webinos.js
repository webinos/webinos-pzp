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
 * Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
 ******************************************************************************/
(function () {
    if (typeof webinos === "undefined") webinos = {};
    var channel = null;

    /**
     * Creates the socket communication channel
     * for a locally hosted websocket server at port 8080
     * for now this channel is used for sending RPC, later the webinos
     * messaging/eventing system will be used
     */
    function createCommChannel (successCB) {
        var channel = null;
        if (typeof WebinosSocket !== 'undefined') { // Check if we are inside Android widget renderer.
            channel = new WebinosSocket ();
        } else { // We are not in Android widget renderer so we can use a browser websocket.
            var port, hostname;
            var defaultHost = "localhost";
            var defaultPort = "8080";
            var isWebServer = true;
            var useDefaultHost = false;
            var useDefaultPort = false;

            // Get web server info.

            // Get web server port.
            port = window.location.port - 0 || 80;
            // Find web server hostname.
            hostname = window.location.hostname;
            if (hostname == "") isWebServer = false; // We are inside a local file.

            // Find out the communication socket info.

            // Set the communication channel's port.
            if (isWebServer) {
                try {
                    var xmlhttp = new XMLHttpRequest ();
                    xmlhttp.open ("GET", "/webinosConfig.json", false);
                    xmlhttp.send ();
                    if (xmlhttp.status == 200) {
                        var resp = JSON.parse (xmlhttp.responseText);
                        port = resp.websocketPort;
                    } else { // We are not inside a pzp or widget server.
                        console.log ("CAUTION: webinosConfig.json failed to load. Are you on a pzp/widget server or older version of webinos? Trying the guess  communication channel's port.");
                        port = port + 1; // Guessing that the port is +1 to the webserver's. This was the way to detect it on old versions of pzp.
                    }
                } catch (err) { // XMLHttpRequest is not supported or something went wrong with it.
                    console.log ("CAUTION: The pzp communication host and port are unknown. Trying the default communication channel.");
                    useDefaultHost = true;
                    useDefaultPort = true;
                }
            } else { // Let's try the default pzp hostname and port.
                console.log ("CAUTION: No web server detected. Using a local file? Trying the default communication channel.");
                useDefaultHost = true;
                useDefaultPort = true;
            }
            // Change the hostname to the default if required.
            if (useDefaultHost) hostname = defaultHost;
            // Change the port to the default if required.
            if (useDefaultPort) port = defaultPort;

            // We are ready to make the connection.

            // Get the correct websocket object.
            var ws = window.WebSocket || window.MozWebSocket;
            try {
                channel = new ws ("ws://" + hostname + ":" + port);
            } catch (err) { // Websockets are not available for this browser. We need to investigate in order to support it.
                throw new Error ("Your browser does not support websockets. Please report your browser on webinos.org.");
            }
        }
        webinos.session.setChannel (channel);
        webinos.session.setPzpPort (port);

        channel.onmessage = function (ev) {
            console.log ('WebSocket Client: Message Received : ' + JSON.stringify (ev.data));
            var data = JSON.parse (ev.data);
            if (data.type === "prop") {
                webinos.session.handleMsg (data);
            } else {
                webinos.messageHandler.setGetOwnId (webinos.session.getSessionId ());
                webinos.messageHandler.setObjectRef (this);
                webinos.messageHandler.setSendMessage (webinos.session.message_send_messaging);
                webinos.messageHandler.onMessageReceived (data, data.to);
            }
        };
        channel.onopen = function() {
          var url = window.location.pathname;
          webinos.session.message_send({type: 'prop', payload: {status:'registerBrowser', value: url}});
        };
    }

    createCommChannel ();

    webinos.rpcHandler = new RPCHandler (undefined, new Registry ());
    webinos.messageHandler = new MessageHandler (webinos.rpcHandler);
    webinos.discovery = new ServiceDiscovery (webinos.rpcHandler);
    webinos.ServiceDiscovery = webinos.discovery; // for backward compat

} ());
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
* Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
* Copyright 2012 - 2013 Samsung Electronics (UK) Ltd
* Authors: Habib Virji
******************************************************************************/

(function() {
  "use strict";
  webinos.session = {};
  var sessionId = null, pzpId, pzhId, otherPzp = [], otherPzh = [], isConnected = false, enrolled = false, mode, port = 8080;
  var serviceLocation;
  var listenerMap = {};
  var channel;
  webinos.session.setChannel = function(_channel) {
    channel = _channel;
  };
  webinos.session.setPzpPort = function (port_) {
    port = port_;
  };
  webinos.session.getPzpPort = function () {
    return port;
 };
  webinos.session.message_send_messaging = function(msg, to) {
    msg.resp_to = webinos.session.getSessionId();
    channel.send(JSON.stringify(msg));
  };
  webinos.session.message_send = function(rpc, to) {
    var type, id = Math.floor(Math.random() * 101);
    if(rpc.type !== undefined && rpc.type === "prop") {
      type = "prop";
      rpc = rpc.payload;
    }else {
      type = "JSONRPC";
    }
    if (typeof rpc.method !== undefined && rpc.method === "ServiceDiscovery.findServices") {
        id = rpc.params[2];
    }
    if (typeof to === "undefined") {
        to = pzpId;
    }
      var message = {"type":type,
          "id":id,
          "from":webinos.session.getSessionId(),
          "to":to,
          "resp_to":webinos.session.getSessionId(),
          "payload":rpc};
      if(rpc.register !== "undefined" && rpc.register === true) {
          console.log(rpc);
          channel.send(JSON.stringify(rpc));
      }else {
          console.log("creating callback");
          console.log("WebSocket Client: Message Sent");
          console.log(message);
          channel.send(JSON.stringify(message));
    }
  };
    webinos.session.setServiceLocation = function (loc) {
        serviceLocation = loc;
    };
    webinos.session.getServiceLocation = function () {
        if (typeof serviceLocation !== "undefined") {
            return serviceLocation;
        } else {
            return pzpId;
        }
    };
    webinos.session.getSessionId = function () {
        return sessionId;
    };
    webinos.session.getPZPId = function () {
        return pzpId;
    };
    webinos.session.getPZHId = function () {
        return ( pzhId || "");
    };
    webinos.session.getOtherPZP = function () {
        return (otherPzp || []);
    };
    webinos.session.getOtherPZH = function () {
        return (otherPzh || []);
    };
    webinos.session.addListener = function (statusType, listener) {
        var listeners = listenerMap[statusType] || [];
        listeners.push (listener);
        listenerMap[statusType] = listeners;
        return listeners.length;
    };
    webinos.session.removeListener = function (statusType, id) {
        var listeners = listenerMap[statusType] || [];
        try {
            listeners[id - 1] = undefined;
        } catch (e) {
        }
    };
    webinos.session.isConnected = function () {
        return isConnected;
    };

  webinos.session.getSessionId = function() {
    return sessionId;
  };
  webinos.session.getPZPId = function() {
    return pzpId;
  };
  webinos.session.getPZHId = function() {
    return ( pzhId || "");
  };
  webinos.session.getOtherPZP = function() {
    return (otherPzp || []);
  };
  webinos.session.getOtherPZH = function() {
    return (otherPzh || []);
  };
  webinos.session.getPzpModeState = function (mode_name) {
    if (enrolled && mode[mode_name] === "connected") {
      return true;
    } else {
      return false;
    }
  };
  webinos.session.addListener = function(statusType, listener) {
    var listeners = listenerMap[statusType] || [];
    listeners.push(listener);
    listenerMap[statusType] = listeners;
    return listeners.length;
  };
  webinos.session.removeListener = function(statusType, id) {
    var listeners = listenerMap[statusType] || [];
    try {
      listeners[id - 1] = undefined;
    }catch(e) {
    }
  };
  webinos.session.isConnected = function(){
    return isConnected;
  };
  function callListenerForMsg(data) {
    var listeners = listenerMap[data.payload.status] || [];
    for(var i = 0;i < listeners.length;i++) {
      listeners[i](data) ;
    }
  }
  function setWebinosMessaging() {
    webinos.messageHandler.setGetOwnId(sessionId);
    var msg = webinos.messageHandler.registerSender(sessionId, pzpId);
    webinos.session.message_send(msg, pzpId);
  }
  function updateConnected(message){
    otherPzh = message.connectedPzh;
    otherPzp = message.connectedPzp;
    isConnected = !!(otherPzh.indexOf(pzhId) !== -1);
    enrolled = message.enrolled;
    mode = message.mode;
  }
  function setWebinosSession(data){
    sessionId = data.to;
    pzpId = data.from;
    if(data.payload.message) {
      pzhId = data.payload.message.pzhId;
      updateConnected(data.payload.message);
    }
    setWebinosMessaging();
  }
  webinos.session.handleMsg = function(data) {
    if(data.type === "prop") {
      switch(data.payload.status) {
        case "registeredBrowser":
          setWebinosSession(data);
          callListenerForMsg(data);
          break;
        case "pzpFindPeers":
          callListenerForMsg(data);
          break;
        case "pubCert":
          callListenerForMsg(data);
          break;
        case "showHashQR":
          callListenerForMsg(data);
          break;
        case "addPzpQR":
          callListenerForMsg(data);
          break;	
        case "requestRemoteScanner":
            callListenerForMsg(data);
          break;	
        case "checkHashQR":
          callListenerForMsg(data);
          break;	  
        case "sendCert":
          callListenerForMsg(data);
          break;
        case "connectPeers":
          callListenerForMsg(data);
          break;
        case "intraPeer":
          callListenerForMsg(data);
          break;   
        case "update":
          setWebinosSession(data);
          callListenerForMsg(data);
          break;
        case "infoLog":
          callListenerForMsg(data);
          break;
        case "errorLog":
          callListenerForMsg(data);
          break;
        case "error":
          callListenerForMsg(data);
          break;
        case "friendlyName":
          callListenerForMsg(data);
          break;
        case "webinosVersion":
          callListenerForMsg(data);
          break;
        case "pzhDisconnected":
          isConnected = false;
          callListenerForMsg(data);
          break;
      }
    }
  }
}());
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
* Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
******************************************************************************/
(function() {

/**
 * Webinos Geolocation service constructor (client side).
 * @constructor
 * @param obj Object containing displayName, api, etc.
 */
WebinosGeolocation = function (obj) {
	this.base = WebinosService;
	this.base(obj);
};

WebinosGeolocation.prototype = new WebinosService;

/**
 * To bind the service.
 * @param bindCB BindCallback object.
 */
WebinosGeolocation.prototype.bindService = function (bindCB, serviceId) {
	// actually there should be an auth check here or whatever, but we just always bind
	this.getCurrentPosition = getCurrentPosition;
	this.watchPosition = watchPosition;
	this.clearWatch = clearWatch;
	
	if (typeof bindCB.onBind === 'function') {
		bindCB.onBind(this);
	};
}

/**
 * Retrieve the current position.
 * @param positionCB Success callback.
 * @param positionErrorCB Error callback.
 * @param positionOptions Optional options.
 */
function getCurrentPosition(positionCB, positionErrorCB, positionOptions) { 
	var rpc = webinos.rpcHandler.createRPC(this, "getCurrentPosition", positionOptions); // RPC service name, function, position options
	webinos.rpcHandler.executeRPC(rpc, function (position) {
		positionCB(position);
	},
	function (error) {
		positionErrorCB(error);
	});
};

var watchIdTable = {};

/**
 * Register a listener for position updates.
 * @param positionCB Callback for position updates.
 * @param positionErrorCB Error callback.
 * @param positionOptions Optional options.
 * @returns Registered listener id.
 */
function watchPosition(positionCB, positionErrorCB, positionOptions) {
	var rpc = webinos.rpcHandler.createRPC(this, "watchPosition", [positionOptions]);

	rpc.onEvent = function (position) {
		positionCB(position);
	};

	rpc.onError = function (err) {
		positionErrorCB(err);
	};

	webinos.rpcHandler.registerCallbackObject(rpc);
	webinos.rpcHandler.executeRPC(rpc);

	var watchId = parseInt(rpc.id, 16);
	watchIdTable[watchId] = rpc.id;

	return watchId;
};

/**
 * Clear a listener.
 * @param watchId The id as returned by watchPosition to clear.
 */
function clearWatch(watchId) {
	var _watchId = watchIdTable[watchId];
	if (!_watchId) return;

	var rpc = webinos.rpcHandler.createRPC(this, "clearWatch", [_watchId]);
	webinos.rpcHandler.executeRPC(rpc);

	delete watchIdTable[watchId];
	webinos.rpcHandler.unregisterCallbackObject({api:_watchId});
};

})();
//
// Webinos-Platform/webinos/core/wrt/lib/webinos.servicedisco.js
//
// Maintenance records:
// These inline comments should be incorporated in release notes and removed
// from here when releasing new versions.
//
// Modification implements
// -- Interface DiscoveryInterface method
//      PendingOperation findServices(ServiceType serviceType, FindCallBack findCallBack, Options options, Filter filter)
// -- Interface FindCallBack method
//      void onError(DOMError error)
// -- Interface PendingOperation method
//      void cancel()
//
(function () {
    function isOnNode() {
        return typeof module === "object" ? true : false;
    };
    
    /**
     * Interface DiscoveryInterface
     */
    var ServiceDiscovery = function (rpcHandler) {
        this.registeredServices = 0;
        
        var _webinosReady = false;
        var callerCache = [];

        /**
         * Search for registered services.
         * @param {ServiceType} serviceType ServiceType object to search for.
         * @param {FindCallBack} callback Callback to call with results.
         * @param {Options} options Timeout, optional.
         * @param {Filter} filter Filters based on location, name, description, optional.
         */
        this.findServices = function (serviceType, callback, options, filter) {
            var that = this;
            var findOp;
            
            var rpc = rpcHandler.createRPC('ServiceDiscovery', 'findServices',
                    [serviceType, options, filter]);
            
            var timer = setTimeout(function () {
                rpcHandler.unregisterCallbackObject(rpc);
                // If no results return TimeoutError.
                if (!findOp.found && typeof callback.onError === 'function') {
                    callback.onError(new DOMError('TimeoutError', ''));
                }
            }, options && typeof options.timeout !== 'undefined' ?
                        options.timeout : 120000 // default timeout 120 secs
            );
            
            findOp = new PendingOperation(function() {
                // remove waiting requests from callerCache
                var index = callerCache.indexOf(rpc);
                if (index >= 0) {
                    callerCache.splice(index, 1);
                }
                rpcHandler.unregisterCallbackObject(rpc);
                if (typeof callback.onError === 'function') {
                    callback.onError(new DOMError('AbortError', ''));
                }
            }, timer);
            
            var success = function (params) {
                var baseServiceObj = params;
                
                console.log("servicedisco: service found.");
                
                // TODO The typeMap is hard-coded here so only these APIs are
                // supported. In the future this should be improved to support
                // dynamic APIs.
                //
                // APIs should be classified as intrinsic ones and webinos
                // services. Intrinsic APIs, like Discovery, App2App, should be
                // provided directly in WRT. webinos service APIs, like Actuator,
                // Vehicle, which are supposed to be provided with a PZP, should be
                // found with Discovery implemented in this file.
                //
                // That means, intrinsic APIs are released along with WRT and not
                // acquired with Discovery. Users can invoke them directly just
                // like using a library. While webinos service APIs will still be
                // acquired with Discovery.
                //
                var typeMap = {};
                if (typeof webinos.file !== 'undefined' && typeof webinos.file.Service !== 'undefined')
                    typeMap['http://webinos.org/api/file'] = webinos.file.Service;
                if (typeof TestModule !== 'undefined') typeMap['http://webinos.org/api/test'] = TestModule;
                if (typeof ActuatorModule !== 'undefined') {
                    typeMap['http://webinos.org/api/actuators'] = ActuatorModule;
                    typeMap['http://webinos.org/api/actuators.linearmotor'] = ActuatorModule;
                    typeMap['http://webinos.org/api/actuators.switch'] = ActuatorModule;
                    typeMap['http://webinos.org/api/actuators.rotationalmotor'] = ActuatorModule;
                    typeMap['http://webinos.org/api/actuators.vibratingmotor'] = ActuatorModule;
                    typeMap['http://webinos.org/api/actuators.servomotor'] = ActuatorModule;
                    typeMap['http://webinos.org/api/actuators.swivelmotor'] = ActuatorModule;
                    typeMap['http://webinos.org/api/actuators.thermostat'] = ActuatorModule;
                }
                if (typeof WebNotificationModule !== 'undefined') typeMap['http://webinos.org/api/notifications'] = WebNotificationModule;
                if (typeof ZoneNotificationModule !== 'undefined') typeMap['http://webinos.org/api/internal/zonenotification'] = ZoneNotificationModule;
                if (typeof oAuthModule!== 'undefined') typeMap['http://webinos.org/mwc/oauth'] = oAuthModule;
                if (typeof WebinosGeolocation !== 'undefined') typeMap['http://www.w3.org/ns/api-perms/geolocation'] = WebinosGeolocation;
                if (typeof WebinosDeviceOrientation !== 'undefined') typeMap['http://webinos.org/api/deviceorientation'] = WebinosDeviceOrientation;
                if (typeof Vehicle !== 'undefined') typeMap['http://webinos.org/api/vehicle'] = Vehicle;
                if (typeof EventsModule !== 'undefined') typeMap['http://webinos.org/api/events'] = EventsModule;
                if (typeof App2AppModule !== 'undefined') typeMap['http://webinos.org/api/app2app'] = App2AppModule;
                if (typeof AppLauncherModule !== 'undefined') typeMap['http://webinos.org/api/applauncher'] = AppLauncherModule;
                if (typeof Sensor !== 'undefined') {
                    typeMap['http://webinos.org/api/sensors'] = Sensor;
                    typeMap['http://webinos.org/api/sensors.temperature'] = Sensor;
                    typeMap['http://webinos.org/api/sensors.light'] = Sensor;
                    typeMap['http://webinos.org/api/sensors.proximity'] = Sensor;
                    typeMap['http://webinos.org/api/sensors.noise'] = Sensor;
                    typeMap['http://webinos.org/api/sensors.pressure'] = Sensor;
                    typeMap['http://webinos.org/api/sensors.humidity'] = Sensor;
                    typeMap['http://webinos.org/api/sensors.heartratemonitor'] = Sensor;
                }
                if (typeof PaymentModule !== 'undefined') typeMap['http://webinos.org/api/payment'] = PaymentModule;
                if (typeof UserProfileIntModule !== 'undefined') typeMap['UserProfileInt'] = UserProfileIntModule;
                if (typeof TVManager !== 'undefined') typeMap['http://webinos.org/api/tv'] = TVManager;
                if (typeof DeviceStatusManager !== 'undefined') typeMap['http://wacapps.net/api/devicestatus'] = DeviceStatusManager;
                if (typeof Contacts !== 'undefined') typeMap['http://www.w3.org/ns/api-perms/contacts'] = Contacts;
                if (typeof webinos.Context !== 'undefined') typeMap['http://webinos.org/api/context'] = webinos.Context;
                //if (typeof DiscoveryModule !== 'undefined') typeMap['http://webinos.org/manager/discovery/bluetooth'] = DiscoveryModule;
                if (typeof DiscoveryModule !== 'undefined') typeMap['http://webinos.org/api/discovery'] = DiscoveryModule;
                if (typeof AuthenticationModule !== 'undefined') typeMap['http://webinos.org/api/authentication'] = AuthenticationModule;
                if (typeof MediaContentModule !== 'undefined') typeMap['http://webinos.org/api/mediacontent'] = MediaContentModule;
                if (typeof corePZinformationModule !== 'undefined') typeMap['http://webinos.org/api/corePZinformation'] = corePZinformationModule;
                if (typeof NfcModule !== 'undefined') typeMap['http://webinos.org/api/nfc'] = NfcModule;

                if (isOnNode()) {
                    var path = require('path');
                    var moduleRoot = path.resolve(__dirname, '../') + '/';
                    var moduleDependencies = require(moduleRoot + '/dependencies.json');
                    var webinosRoot = path.resolve(moduleRoot + moduleDependencies.root.location) + '/';
                    var dependencies = require(path.resolve(webinosRoot + '/dependencies.json'));

                    var Context = require(path.join(webinosRoot, dependencies.wrt.location, 'lib/webinos.context.js')).Context;
                    typeMap['http://webinos.org/api/context'] = Context;
                }

                var ServiceConstructor = typeMap[baseServiceObj.api];
                if (typeof ServiceConstructor !== 'undefined') {
                    // elevate baseServiceObj to usable local WebinosService object
                    var service = new ServiceConstructor(baseServiceObj, rpcHandler);
                    this.registeredServices++;
                    findOp.found = true;
                    callback.onFound(service);
                } else {
                    var serviceErrorMsg = 'Cannot instantiate webinos service.';
                    console.log(serviceErrorMsg);
                    if (typeof callback.onError === 'function') {
                        callback.onError(new DiscoveryError(102, serviceErrorMsg));
                    }
                }
            }; // End of function success
            
            // The core of findService.
            rpc.onservicefound = function (params) {
                // params is the parameters needed by the API method.
                success(params);
            };
            
            // Refer to the call in
            // Webinos-Platform/webinos/core/api/servicedisco/lib/rpc_servicediso.js.
            rpc.onSecurityError = function (params) {
                if (typeof findOp !== 'undefined' && typeof callback.onError === 'function') {
                    callback.onError(new DOMError('SecurityError', ''));
                }
            };
            
            // Add this pending operation.
            rpcHandler.registerCallbackObject(rpc);
            
            if (typeof rpcHandler.parent !== 'undefined') {
                rpc.serviceAddress = rpcHandler.parent.config.pzhId;
            } else {
                rpc.serviceAddress = webinos.session.getServiceLocation();
            }
            
            // TODO Need to check how to handle it. The serviceType BlobBuilder is
            // not in the API spec.
            // Pure local services.
            if (serviceType == "BlobBuilder") {
                this.found =true;
                var tmp = new BlobBuilder();
                this.registeredServices++;
                callback.onFound(tmp);
                return findOp;
            }
            
            if (!isOnNode() && !_webinosReady) {
                callerCache.push(rpc);
            } else {
                // Only do it when _webinosReady is true.
                rpcHandler.executeRPC(rpc);
            }
            
            return findOp;
        };  // End of findServices.
        
        if (isOnNode()) {
            return;
        }
        
        // further code only runs in the browser
        
        webinos.session.addListener('registeredBrowser', function () {
            _webinosReady = true;
            for (var i = 0; i < callerCache.length; i++) {
                var req = callerCache[i];
                rpcHandler.executeRPC(req);
            }
            callerCache = [];
        });
    };
    
    /**
     * Export definitions for node.js
     */
    if (isOnNode()) {
        exports.ServiceDiscovery = ServiceDiscovery;
    } else {
        // this adds ServiceDiscovery to the window object in the browser
        window.ServiceDiscovery = ServiceDiscovery;
    }
    
    /**
     * Interface PendingOperation
     */
    function PendingOperation(cancelFunc, timer) {
        this.found = false;
        
        this.cancel = function () {
            clearTimeout(timer);
            cancelFunc();
        };
    }
    
    function DOMError(name, message) {
        return {
            name: name,
            message: message
        };
    }
    
    
    ///////////////////// WEBINOS SERVICE INTERFACE ///////////////////////////

    // TODO decide what to do with this class.
    WebinosService = function (obj) {
        this.base = RPCWebinosService;
        this.base(obj);

//        this.id = Math.floor(Math.random()*101);
    };
    WebinosService.prototype = new RPCWebinosService;

    WebinosService.prototype.state = "";

//    WebinosService.prototype.api = "";

//    WebinosService.prototype.id = "";

//    WebinosService.prototype.displayName = "";

//    WebinosService.prototype.description = "";

    WebinosService.prototype.icon = "";

    // stub implementation in case a service module doesn't provide its own bindService
    WebinosService.prototype.bindService = function(bindCB) {
        if (typeof bindCB === 'undefined') return;

        if (typeof bindCB.onBind === 'function') {
            bindCB.onBind(this);
        }
    };

    WebinosService.prototype.unbind = function() {
        webinos.discovery.registeredServices--;
        if (channel != null && webinos.discovery.registeredServices > 0) {
            channel.close();
            channel = null;
        }
    };
}());
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
* Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
******************************************************************************/
(function() {

	/**
	 * Webinos Get42 service constructor (client side).
	 * @constructor
	 * @param obj Object containing displayName, api, etc.
	 */
	TestModule = function(obj) {
		this.base = WebinosService;
		this.base(obj);
		
		this._testAttr = "HelloWorld";
		this.__defineGetter__("testAttr", function (){
			return this._testAttr + " Success";
		});
	};
	
	TestModule.prototype = new WebinosService;
	
	/**
	 * To bind the service.
	 * @param bindCB BindCallback object.
	 */
	TestModule.prototype.bindService = function (bindCB, serviceId) {
		// actually there should be an auth check here or whatever, but we just always bind
		this.get42 = get42;
		this.listenAttr = {};
		this.listenerFor42 = listenerFor42.bind(this);
		
		if (typeof bindCB.onBind === 'function') {
			bindCB.onBind(this);
		};
	}
	
	/**
	 * Get 42.
	 * An example function which does a remote procedure call to retrieve a number.
	 * @param attr Some attribute.
	 * @param successCB Success callback.
	 * @param errorCB Error callback. 
	 */
	function get42(attr, successCB, errorCB) {
		console.log(this.id);
		var rpc = webinos.rpcHandler.createRPC(this, "get42", [attr]);
		webinos.rpcHandler.executeRPC(rpc,
				function (params){
					successCB(params);
				},
				function (error){
					errorCB(error);
				}
		);
	}
	
	/**
	 * Listen for 42.
	 * An exmaple function to register a listener which is then called more than
	 * once via RPC from the server side.
	 * @param listener Listener function that gets called.
	 * @param options Optional options.
	 */
	function listenerFor42(listener, options) {
		var rpc = webinos.rpcHandler.createRPC(this, "listenAttr.listenFor42", [options]);

		// add one listener, could add more later
		rpc.onEvent = function(obj) {
			// we were called back, now invoke the given listener
			listener(obj);
			webinos.rpcHandler.unregisterCallbackObject(rpc);
		};

		webinos.rpcHandler.registerCallbackObject(rpc);
		webinos.rpcHandler.executeRPC(rpc);
	}
	
}());