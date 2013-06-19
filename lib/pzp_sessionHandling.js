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

var PzpReceiveMessage = require("./pzp_receiveMessage.js");
var PzpSendMessage = require("./pzp_sendMessage.js");
var PzpEventHandler = require("./pzp_eventHandler.js");
var PzpID = require("./pzp_id.js");
var PzpCleanup = require("./pzp_cleanup.js");
var PzpOtherManager = require("./pzp_otherManager.js");
var PzpWebSocketServer = require("./pzp_websocket.js");
var PzpConnectHub      = require("./pzp_connectPzh.js");

function Pzp(inputConfig) {
    "use strict";
    PzpReceiveMessage.call(this);
    PzpSendMessage.call(this);
    PzpEventHandler.call(this);
    PzpID.call(this);
    PzpCleanup.call(this);
    PzpOtherManager.call(this);
    PzpWebSocketServer.call(this);
    PzpConnectHub.call(this);
    var PzpCommon = require("./pzp.js");
    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var PzpObject = this, hub, config = {}, cert = {};
    var pzpState = {  // Dynamic state of PZP
        enrolled    :false,
        state       :{"hub":"not_connected", "peer":"not_connected"}, // State is applicable for hub mode but for peer mode, we need to check individually
        connectedPzp:{}, // Stores PZH server details
        connectedPzh:{}, // Stores connected PZP information directly to PZP
        sessionId   :"", // In virgin mode it is device name, if enrolled it is of from pzhId/deviceName
        connectedDevicesToPzh: {pzp:{}, pzh: {} } }; //Stores information about device connected to PZH but not to PZP.

    // PZP state query by other PZP components
    this.getSessionId           = function() { return pzpState && pzpState.sessionId;    };
    this.getState               = function() { return pzpState && pzpState.state;        };
    this.getTrustedList         = function() { return config   && config.trustedList };
    this.getConnectedPzp        = function() { return pzpState && pzpState.connectedPzp;  };
    this.getConnectedPzh        = function() { return pzpState && pzpState.connectedPzh;  };
    this.getPzhConnectedDevices = function() { return pzpState && pzpState.connectedDevicesToPzh; };
    this.getEnrolledStatus      = function() { return pzpState && pzpState.enrolled;   };
    // PZP metaData information retrieved by other PZP components
    this.getPzpHost             = function() { return config && config.pzpHost };
    this.getPzhId               = function() { return config && config.metaData && config.metaData.pzhId; };
    this.getPzhFriendlyName     = function() { return (config && config.trustedList && config.trustedList.pzh &&
                                               config.trustedList.pzh[config.metaData.pzhId] &&
                                               config.trustedList.pzh[config.metaData.pzhId].friendlyName) || config.metaData.pzhId || ""};
    this.getServerAddress       = function() { return config && config.metaData && config.metaData.serverName;  };
    this.getWebinosVersion      = function() { return config && config.metaData && config.metaData.webinos_version; };
    this.getDeviceName          = function() { return config && config.metaData && config.metaData.webinosName; };
    this.getWebinosPath         = function() { return config && config.metaData && config.metaData.webinosRoot ; };
    this.getRetryConnectionValue= function() { return config && config.metaData && config.metaData.retryConnection; };
    this.getFriendlyName        = function() { return config && config.metaData && config.metaData.friendlyName; };
    // Other configuration data
    this.getWebinosPorts        = function() { return config && config.userPref && config.userPref.ports;};
    this.getServiceCache        = function() { return config && config.serviceCache; };
    this.getMasterCertificate   = function() { return config && config.cert && config.cert.internal.master.cert; };
    this.getConnectionCertificate=function() { return config && config.cert && config.cert.internal.conn.cert; };
    this.getUserData            = function() { return config && config.cert && config.cert.userData; };
    this.getCRL                 = function() { return config && config.cert && config.cert.crl.value; };
    this.getCertificateToBeSignedByPzh = function() { return config && config.cert && config.cert.internal && config.cert.internal.master && config.cert.internal.master.csr; };
    this.getExternalCertificates = function() { return config && config.cert && config.cert.external};
    // Checks if component is currently connected to device directly or to the PZH
    this.checkConnectedPzh = function(from) { return (pzpState.connectedPzh.hasOwnProperty(from) || pzpState.connectedDevicesToPzh.pzh.hasOwnProperty(from)); };
    this.checkConnectedPzp = function(from) { return (pzpState.connectedPzp.hasOwnProperty(from) || pzpState.connectedDevicesToPzh.pzp.hasOwnProperty(from)); };
    // Change device name, this happens only when the name already exists in the zone, PZH instructs this name change.
    this.setDeviceName = function(name) { config.metaData.webinosName = name; };
    this.updateTrustedList = function(value) {config.trustedList = value; config.storeDetails("trustedList", config.trustedList);};
    this.updateCRL = function(value) {config.cert.crl.value = value; config.storeDetails("crl", config.cert.crl);};
    this.updateExternalCertificates = function(value) {config.cert.external = value; config.storeDetails(PzpCommon.path.join("certificates","external"), config.cert.external);};
    this.updateStoreServiceCache = function(serviceCache) {config.serviceCache = serviceCache; config.storeDetails("userData", "serviceCache", serviceCache)};
    this.updateWebinosPort = function(key, value) {config.userPref.ports[key] = value; config.storeDetails("userData", "userPref", config.userPref) };
    this.checkTrustedList = function(from) {
        var list = from.split("/"), fromTrustedPzh, fromTrustedPzp;
        if(list.length === 3) { fromTrustedPzp = list[0]+ "/"+ list[1]; fromTrustedPzh = list[0];}   // From App
        if(list.length === 2) { fromTrustedPzp = list[0]+ "/"+ list[1]; fromTrustedPzh = list[0];} // From PZP
        if(list.length === 1) { fromTrustedPzh = list[0];} // From trusted PZH
        return (config && config.trustedList && (config.trustedList.pzh.hasOwnProperty(fromTrustedPzh) || config.trustedList.pzp.hasOwnProperty(fromTrustedPzp)));
    };

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
                    //crl : crlList,
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
        pzpState.state[type] = "connected";
        PzpObject.onConnect();
        PzpObject.connectedApp();
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
    this.pzpEnrollment = function (from, to, payload) {
        var signedCert;
        logger.log ("PZP ENROLLED AT  " + from);    // This message come from PZH web server over websocket
        config.cert.internal.master.cert = payload.clientCert;
        config.cert.internal.pzh.cert    = payload.masterCert;
        config.cert.crl.value            = payload.masterCrl;
        config.metaData.pzhId            = from;
        config.metaData.serverName       = from && from.split ("@")[1];
        if((signedCert = config.cert.generateSignedCertificate(config.cert.internal.conn.csr))) {
            logger.log("connection signed certificate by PZP");
            config.cert.internal.conn.cert = signedCert;
            /*
             // Uncomment below lines to see contents of the certificates
             require("fs").writeFileSync("pzp_conn",config.cert.internal.conn.cert);
             require("fs").writeFileSync("pzp_master",config.cert.internal.master.cert);
             require("fs").writeFileSync("pzh_cert",config.cert.internal.pzh.cert);
             // At command line use following command to see file contents. Contents to look in certificate are subject name and subject alt name...
             openssl x509 -in pzp_conn -noout -text
             */

            if (from.indexOf (":") !== -1) {
                config.metaData.serverName = config.metaData.serverName.split (":")[0];
            }

            if (!config.trustedList.pzh.hasOwnProperty (config.metaData.pzhId)) {
                config.trustedList.pzh[config.metaData.pzhId] = {friendlyName: payload.friendlyName};
            }
            pzpState.enrolled = true;
            pzpState.sessionId = PzpObject.setSessionId(); // IMP during enrollment sessionId changes..
            PzpObject.setFriendlyName(config.metaData.friendlyName);
            config.storeDetails("metaData", config.metaData);
            config.storeDetails("crl", config.crl);
            config.storeDetails("trustedList", config.trustedList);
            config.storeDetails(require("path").join("certificates", "internal"), "certificates", config.cert.internal);
        }
    };

    this.createPzpCertificates = function() {
        try {
            var signedCert, csr;
            var cn = config.metaData.webinosType + "CA:" + config.metaData.webinosName;
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
            config.metaData.friendlyName = PzpObject.setFriendlyName(inputConfig.friendlyName || PzpDefaultConfig.friendlyName);
            config.storeDetails("metaData", config.metaData);
            config.storeDetails("userData", "userPref", config.userPref);
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
    PzpObject.initializePzp = function() {
        PzpCommon.wUtil.webinosHostname.getHostName(inputConfig.pzpHost, function (pzpHost) {
            try {
                config = new PzpCommon.wUtil.webinosConfiguration("Pzp", inputConfig);// sets configuration
                config.pzpHost = pzpHost;
                config.cert = new PzpCommon.wCertificate(config.metaData);
                if(!config.loadWebinosConfiguration()){
                   virginPzpInitialization();
                }
                config.loadCertificates(config.cert);
                if(config.metaData.pzhId) pzpState.enrolled = true;
                pzpState.sessionId = PzpObject.setSessionId();
                logger.addId(pzpState.sessionId);
                PzpObject.startWebSocketServer();
                PzpObject.startOtherManagers();
                if (pzpState.enrolled) {
                    PzpObject.startServer();
                }
            } catch (err) {
                PzpObject.emit("PZP_START_FAILED", err);
            }
        });
    };

    PzpObject.initializePzp();
}
require("util").inherits(Pzp, PzpReceiveMessage);
require("util").inherits(Pzp, PzpSendMessage);
require("util").inherits(Pzp, PzpEventHandler);
require("util").inherits(Pzp, PzpID);
require("util").inherits(Pzp, PzpCleanup);
require("util").inherits(Pzp, PzpOtherManager);
require("util").inherits(Pzp, PzpWebSocketServer);
require("util").inherits(Pzp, PzpConnectHub);
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
    if (PzpAPI.inputConfig.forcedDeviceName){
        PzpAPI.otherPzpInstance = new Pzp(PzpAPI.inputConfig);
        return PzpAPI.otherPzpInstance;
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
