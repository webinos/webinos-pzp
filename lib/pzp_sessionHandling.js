/*******************************************************************************
 *  Code contributed to the webinos project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in  writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright 2012 - 2013 Samsung Electronics (UK) Ltd
 * Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
 * AUTHORS: Habib Virji (habib.virji@samsung.com), Alexander Futasz, Ziran Sun(ziran.sun@samsung.com)
 *******************************************************************************/
var PzpWebSocket = require("./pzp_websocket.js");
function Pzp(inputConfig) {
    "use strict";
    PzpWebSocket.call(this);
    var PzpCommon = require("./pzp.js");
    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var PzpObject = this, hub, stateListeners = [], config = {}, cert = {};
    var pzpState = {  // Dynamic state of PZP
        enrolled    :false,
        state       :{"hub":"not_connected", "peer":"not_connected"}, // State is applicable for hub mode but for peer mode, we need to check individually
        connectedPzp:{}, // Stores PZH server details
        connectedPzh:{}, // Stores connected PZP information directly to PZP
        sessionId   :"", // In virgin mode it is device name, if enrolled it is of from pzhId/deviceName
        connectedDevicesToPzh: {pzp:{}, pzh: {} } }; //Stores information about device connected to PZH but not to PZP.
  
    /**
     * Listener to update WRT about PZP state change
     * @param listener -
     */
    this.addStateListener = function (listener) {
        if (listener) {
            if (typeof listener.setHubConnected !== "function") {
                listener.setHubConnected = function(isConnected) {};
            }
            if (typeof listener.setPeerConnected !== "function") {
                listener.setPeerConnected = function(isConnected) {};
            }
            stateListeners.push(listener);

            // communicate current state
            listener.setHubConnected(pzpState.state["hub"] === "connected");
            listener.setPeerConnected(pzpState.state["peer"] === "connected");
        }
    };
    /**
     *  Triggers connected listeners about hub and peer state updates
     */
    this.setConnectState = function (mode, isConnected) {
        pzpState.state[mode] = (isConnected ? "connected" : "not_connected");
        stateListeners.forEach(function(listener) {
            if (mode === "hub") {
                listener.setHubConnected(isConnected);
            } else if (mode === "peer") {
                listener.setPeerConnected(isConnected);
            }
        });
    };
    /**
     * Change device name, this happens only when the name already exists in the zone, PZH instructs this name change.
     */
    this.setDeviceName = function(name) {
        config.metaData.webinosName = name;
        config.storeDetails(null,"metaData", config.metaData);
    };
    /**
     * Stores service cache
     */
    this.setServiceCache = function(newModules) {
        var len = config.serviceCache.length;
        newModules.forEach(function(name){
            config.serviceCache.push(name);
        });
        if (len !== config.serviceCache.length){
            config.storeDetails("userData", "serviceCache", config.serviceCache);
        }
    };

    /**
     * Changes friendly name of the PZP
     * @param {String} friendlyName - PZP friendly name intended to be changed
     */
    this.setFriendlyName = function(friendlyName) {
        if(friendlyName) {
            config.metaData.friendlyName = friendlyName;
        } else {
            var os = require("os");
            if (os.platform() && os.platform().toLowerCase() === "android" ){
                config.metaData.friendlyName = "Mobile";
            } else if (process.platform === "win32") {
                config.metaData.friendlyName = "Windows PC";
            } else if (process.platform === "darwin") {
                config.metaData.friendlyName = "MacBook";
            } else if (process.platform === "linux" || process.platform === "freebsd") {
                config.metaData.friendlyName = "Linux Device";
            } else {
                config.metaData.friendlyName = "Webinos Device";// Add manually
            }
        }
        config.storeDetails(null, "metaData", config.metaData);
        PzpObject.sendUpdateToAll();
    };

    /**
     * Sets webinos pzp sessionId
     */
    this.setSessionId = function () {
        if (config && (config.cert.internal.pzh.cert && config.metaData.pzhId)) {
            pzpState.enrolled = true; // Hub mode
        }
        pzpState.sessionId = config.metaData.webinosName;
        if (pzpState.enrolled) {
            if (config.metaData.pzhAssignedId) {
                pzpState.sessionId = config.metaData.pzhId + "/" + config.metaData.pzhAssignedId;
            } else {
                pzpState.sessionId = config.metaData.pzhId + "/" + config.metaData.webinosName;
            }
        }
        logger.addId (config.metaData.webinosName);
    };

    // PZP state query by other PZP components
    this.getSessionId           = function() { return pzpState && pzpState.sessionId;    };
    this.getState               = function() { return pzpState && pzpState.state;        };
    this.getConnectedPzp        = function() { return config && config.trustedList.pzp;  };
    this.getConnectedPzh        = function() { return config && config.trustedList.pzh;  };
    this.getPzhConnectedDevices = function() { return pzpState && pzpState.connectedDevicesToPzh; };
    this.getConnectPeerAddress  = function() { return pzpState && pzpState.connectingPeerAddr;  };
    this.getEnrolledStatus      = function() { return pzpState && pzpState.enrolled;   };
    // PZP metaData information retrieved by other PZP components
    this.getPzhId               = function() { return config && config.metaData && config.metaData.pzhId; };
    this.getServerAddress       = function() { return config && config.metaData && config.metaData.serverName;  };
    this.getWebinosVersion      = function() { return config && config.metaData && config.metaData.webinos_version; };
    this.getDeviceName          = function() { return config && config.metaData && config.metaData.webinosName; };
    this.getWebinosPath         = function() { return config && config.metaData && config.metaData.webinosRoot ; };
    this.getRetryConnectionValue= function() { return config && config.metaData && config.metaData.retryConnection; };
    this.getFriendlyName        = function() { return config && config.metaData && config.metaData.friendlyName; };
    // Other configuration data
    this.getWebinosPorts        = function() { return config && config.userPref && Object.freeze(config.userPref.ports);};
    this.getServiceCache        = function() { return config && config.serviceCache; };
    this.getMasterCertificate   = function() { return config && config.cert && config.cert.internal.master.cert; };
    this.getConnectionCertificate=function() { return config && config.cert && config.cert.internal.conn.cert; };
    this.getUserData            = function() { return config && config.cert && config.cert.userData; };
    this.getCRL                 = function() { return config && config.cert && config.cert.crl.value; };
    this.getCertificateToBeSignedByPzh = function() { return config && config.cert && config.cert.internal && config.cert.internal.master && config.cert.internal.master.csr; };
    this.getExternalCertificate = function() { return config && config.exCertList && config.exCertList.exPZP; };
    // Checks if component is currently connected to device directly or to the PZH
    this.checkConnectedPzh = function(from) { return (config.trustedList.pzh.hasOwnProperty(from) || pzpState.connectedDevicesToPzh.pzh.hasOwnProperty(from)); };
    this.checkConnectedPzp = function(from) { return (config.trustedList.pzp.hasOwnProperty(from) || pzpState.connectedDevicesToPzh.pzp.hasOwnProperty(from)); };

    /**
     * Sets TLS connection parameters
     */
    this.setConnectionParameters = function () {
        try {
            var privateKey;
            if ((privateKey = config.cert.keyStore.fetchKey(config.cert.internal.conn.key_id))) {
                var caList = [], crlList = [], key;
                if (pzpState.enrolled) caList.push(config.cert.internal.pzh.cert);
                else caList.push(config.cert.internal.master.cert);
                crlList.push(config.cert.crl.value );

                for ( key in config.cert.external) {
                    if(config.cert.external.hasOwnProperty(key)) {
                        caList.push(config.cert.external[key].cert);
                        crlList.push(config.cert.external[key].crl);
                    }
                }
                return  {
                    key : privateKey,
                    cert: config.cert.internal.conn.cert,
                    crl : crlList,
                    ca  : caList,
                    servername: config.metaData.pzhId || config.metaData.serverName,
                    rejectUnauthorized: true,
                    requestCert: true
                };
            }
        } catch(err) {
            PzpObject.emit("EXCEPTION", new Error("Failed Setting TLS Connection Parameters"), err);
        }
    };

     /**
     * Handles authentication
     * @param clientSessionId - PZP Id
     * @param conn - socket connecton
     */
    this.handleAuthorization = function(type, sessionId, conn) {
        logger.log ("authorized & connected to : " + sessionId);
        var store =  (type ==="peer") ? pzpState.connectedPzp: pzpState.connectedPzh;
        // If PZP with same id is already connected, disconnect socket
        if (store.hasOwnProperty(sessionId)) {
            store[sessionId].socket.end();
        }
        store[sessionId] = conn;
        conn.id = sessionId;
        PzpObject.sendUpdateToAll(sessionId);
        PzpObject.connectedApp();
        PzpObject.messageHandlerRegistration();
        PzpObject.setConnectState(type, true);
        PzpObject.emit(type.toUpperCase()+"_CONNECTED");
    };

    /**
     * @param conn - Socket connection object of the PZH
     */
    this.unAuthorized = function(type, conn) {
        logger.error("not authenticated " + conn.authorizationError);
        conn.socket.end();
        PzpObject.emit(type.toUpperCase()+"_CONNECT_FAILED");
        if (conn.authorizationError === 'CERT_NOT_YET_VALID') {
            throw "possible clock difference between PZH and your PZP, try updating time and try again";
        } else {
            throw conn.authorizationError;
        }
    };

    /**
     * EnrollPZP stores signed certificate information from the PZH and then triggers connectHub function
     * @param from - Contains PZH Id
     * @param to - Contains PZP Id
     * @param payload - Signed PZP certificate from the PZH, master certificate and CRL
     */
    this.registerDevice = function (from, to, payload) {
        var signedCert;
        logger.log ("PZP ENROLLED AT  " + from);    // This message come from PZH web server over websocket
        config.cert.internal.master.cert = payload.clientCert;
        config.cert.internal.pzh.cert    = payload.masterCert;
        config.cert.crl.value            = payload.masterCrl;
        config.metaData.pzhId            = from;
        config.metaData.serverName       = from && from.split ("_")[0];
        // Same PZP name existed in PZ, PZH has assigned a new id to the PZP.
        if ((to.split("/") && to.split("/")[1])!== config.metaData.webinosName) {
            config.metaData.pzhAssignedId = to.split("/")[1];
        }
        if((signedCert = config.cert.generateSignedCertificate(config.cert.internal.conn.csr))) {
            logger.log("connection signed certificate by PZP");
            config.cert.internal.conn.cert = signedCert;

            if (from.indexOf (":") !== -1) {
                config.metaData.serverName = config.metaData.serverName.split (":")[0];
            }

            if (!config.trustedList.pzh.hasOwnProperty (config.metaData.pzhId)) {
                config.trustedList.pzh[config.metaData.pzhId] = {friendlyName: payload.friendlyName};
            }
            PzpObject.setupMessage_RPCHandler();
            PzpObject.setSessionId(); // IMP during enrollment sessionId changes..
            config.storeDetails(null, "metaData", config.metaData);
            config.storeDetails(null, "crl", config.crl);
            config.storeDetails(null, "trustedList", config.trustedList);
            config.storeDetails(require("path").join("certificates", "internal"), "certificates", config.cert.internal);
        }
    };
 /**
     * Removes pzp or pzh from the connected list and then updatesApp to update status about connection status
     * @param_ id - identity of the PZP or PZH disconnected
     */
    this.cleanUp = function (_id) {
        var key;
        if (_id) {
            PzpObject.messageHandler.removeRoute (_id, pzpState.sessionId);
            for (key in pzpState.connectedPzp) {
                if (pzpState.connectedPzp.hasOwnProperty (key) && key === _id) {
                    logger.log ("pzp - " + key + " details removed");
                    if (Object.keys (pzpState.connectedPzp) <= 1) PzpObject.setConnectState("peer", false);
                    delete pzpState.connectedPzp[key];
                }
            }
            if ((Object.keys(pzpState.connectedPzh)).length > 1)  PzpObject.pzhDisconnected();
            for (key in pzpState.connectedPzh) {
                if (pzpState.connectedPzh.hasOwnProperty (key) && key === _id) {
                    logger.log ("pzh - " + key + " details removed");
                    PzpObject.setConnectState("hub", false);
                    delete pzpState.connectedPzh[key];
                }
            }
            PzpObject.sendUpdateToAll (_id);
            PzpObject.connectedApp();
        }
    };

    /**
     *
     */
    this.unRegisterDevice = function() {
        // Delete all important folders that makes it a PZP
        var filePath, key;
        // TODO: Revoke PZP certificate...
        logger.log("PZP configuration is being reset");
        config.fileList.forEach (function (name) {
            if (!name.fileName) name.fileName = config.metaData.webinosName;
            filePath = PzpCommon.path.join(config.metaData.webinosRoot, name.folderName, name.fileName+".json");
            logger.log("PZP Reset - " + filePath);
            PzpCommon.fs.unlink(filePath);
        });

        if ((Object.keys(pzpState.connectedPzh)).length > 1)  PzpObject.pzhDisconnected();
        // Disconnect existing connections
        for (key in pzpState.connectedPzp) {
            if (pzpState.connectedPzp.hasOwnProperty (key)) {
                delete pzpState.connectedPzp[key];
                PzpObject.messageHandler.removeRoute(key, pzpState.sessionId);
            }
        }
        for (key in pzpState.connectedPzh) {
            if (pzpState.connectedPzh.hasOwnProperty (key)) {
                delete pzpState.connectedPzh[key];
                PzpObject.setConnectState("hub", false);
            }
        }
        // Restart PZP configuration , not the PZP WebServer...
        var inputConfig = {
            sessionIdentity: '0.0.0.0'
        };
        config = new PzpCommon.wUtil.webinosConfiguration ("Pzp", inputConfig);// sets configuration
        config.setConfiguration (function (status) {
            if (status) {
                pzpState.enrolled  = false;
                pzpState.sessionId = config.metaData.webinosName;
                PzpObject.setupMessage_RPCHandler();
                PzpObject.connectedApp();
            }
        });
    };
    this.createPzpCertificates = function() {
        try {
            var signedCert, csr;
            var cn = config.metaData.webinosType + "CA:" + config.metaData.webinosName;
			console.log(cn);
            if(config.cert.generateSelfSignedCertificate(config.metaData.webinosType+"CA", cn)) {
                logger.log ("*****"+config.metaData.webinosType+" Master Certificate Generated*****");
                cn = config.metaData.webinosType + ":" + config.metaData.webinosName;
                if( (csr=config.cert.generateSelfSignedCertificate(config.metaData.webinosType,cn))) {
                    logger.log ("*****"+config.metaData.webinosType+" Connection Certificate Generated*****");
                    signedCert = config.cert.generateSignedCertificate(csr);
                    if(signedCert) {
                        logger.log ("*****"+config.metaData.webinosType+" Connection Certificate Signed by Master Certificate*****");
                        config.cert.internal.conn.cert = signedCert;
                        config.storeDetails(PzpCommon.path.join("certificates", "internal"),"certificates", config.cert.internal);
                        config.storeDetails(null, "crl", config.cert.crl);
                        return true;
                    }
                }
            }
            return false;
        } catch(err){
            PzpObject.emit("FUNC_ERROR", "PZP create certificate failed");
        }
    };

    function virginPzpInitialization(){
        if(config.createDefaultDirectories()) {
            var PzpDefaultConfig = require("../config.json");
			config.userPref.ports = PzpDefaultConfig.ports;
            config.metaData.webinos_version = PzpDefaultConfig.webinos_version;
            config.metaData.retryConnection = PzpDefaultConfig.retryConnection;
			PzpObject.setFriendlyName(inputConfig.friendlyName || PzpDefaultConfig.friendlyName);
			console.log(config.userPref);
			config.storeDetails("userData", "userPref", config.userPref);
			console.log("2");
            if (PzpObject.createPzpCertificates()) {
                logger.log("created default set of PZP certificates");
                config.storeDetails("userData", "userDetails", config.cert.userData);
            } // If PZP certificate will fail, it will generate error on its own
        }
    }

    /**
     * Initializes PZP WebSocket Server and then tries connecting with the PZH hub
     * Starting PZP means starting web socket server
     */
    function initializePzp() {
        try {
            config = new PzpCommon.wUtil.webinosConfiguration("Pzp", inputConfig);// sets configuration
            config.cert = new PzpCommon.wCertificate(config.metaData);
			
            if(!config.loadWebinosConfiguration()){
               virginPzpInitialization();
            }
            config.loadCertificates(config.cert);

            PzpObject.setSessionId();
			
            PzpObject.startWebSocketServer();

            if (pzpState.enrolled) {
                PzpObject.startServer();
            }

            PzpObject.startOtherManagers();

        } catch (err) {
            PzpObject.emit("PZP_START_FAILED", err);
        }
    }


    initializePzp();
}

require("util").inherits(Pzp, PzpWebSocket);
Pzp.prototype.__proto__ = require("events").EventEmitter.prototype;
var PzpAPI = exports;
PzpAPI.setInputConfig = function(inputConfig) {
    PzpAPI.inputConfig = inputConfig;
};
PzpAPI.getInstance = function() {
    if (!PzpAPI.inputConfig) {
        console.log("Missing inputConfig parameters");
        return null;
    }
    if (!PzpAPI.pzpInstance) {
        PzpAPI.pzpInstance = new Pzp(PzpAPI.inputConfig);
    }
    return PzpAPI.pzpInstance;
};

PzpAPI.getSessionId = function() {
    return (PzpAPI.getInstance()).getSessionId();
};
PzpAPI.getDeviceName = function() {
    return (PzpAPI.getInstance()).getDeviceName();
};
PzpAPI.getWebinosPath = function() {
    return (PzpAPI.getInstance()).getWebinosPath();
};
PzpAPI.getWebinosPorts = function() {
    return (PzpAPI.getInstance()).getWebinosPorts();
};
