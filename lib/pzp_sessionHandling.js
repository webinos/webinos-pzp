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
var PzpTLSServer      = require("./pzp_tlsServer.js");
var PzpPeerClient     = require("./pzp_connectPeer.js");
var PzpSyncHandler      = require("./pzp_syncHandler.js");

function Pzp(inputConfig) {
    "use strict";
    PzpSendMessage.call(this);
    PzpEventHandler.call(this);
    PzpID.call(this);
    PzpCleanup.call(this);
    PzpOtherManager.call(this);
    PzpWebSocketServer.call(this);
    PzpConnectHub.call(this);
    PzpTLSServer.call(this);
    PzpPeerClient.call(this);
    PzpSyncHandler.call(this);
    PzpReceiveMessage.call(this);
    var PzpCommon = require("./pzp.js");
    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var PzpObject = this, hub, config = {}, cert = {};
    var pzpState = {  // Dynamic state of PZP
        enrolled    :false,
        state       :{"Pzh":"not_connected", "Pzp":"not_connected"}, // State is applicable for hub mode but for peer mode, we need to check individually
        connectedPzp:{}, // Stores PZH server details
        connectedPzh:{}, // Stores connected PZP information directly to PZP
        sessionId   :"", // In virgin mode it is device name, if enrolled it is of from pzhId/deviceName
        connectedDevicesToPzh: {pzp:[], pzh: [] } }; //Stores information about device connected to PZH but not to PZP.

    // PZP state query by other PZP components
    this.getPzhId               = function()   { return config.metaData.pzhId; };
    this.getSessionId           = function()   { return pzpState.sessionId; };
    this.getEnrolledStatus      = function()   { return pzpState.enrolled;   };
    this.getState               = function(id) { return (id? pzpState.state[id] : pzpState.state);  };
    this.setState               = function(type, status) { pzpState.state[type] = status; };
    this.getConnectedPzp        = function(id) { return (id? pzpState.connectedPzp[id]: Object.keys(pzpState.connectedPzp));  };
    this.getConnectedPzh        = function(id) { return (id? pzpState.connectedPzh[id]: Object.keys(pzpState.connectedPzh));  };
    this.getPzhConnectedDevices = function(id) { return (Object.keys(pzpState.connectedDevicesToPzh[id])); };
    this.setPzhConnectedDevices = function(type, value) { pzpState.connectedDevicesToPzh[type] = value; };

    // PZP metaData information retrieved by other PZP components
    this.getTrustedList         = function(id) { return (id==="pzh"? Object.keys(config.trustedList.pzh): (id=== "pzp"?Object.keys(config.trustedList.pzp):config.trustedList)); };
    this.getFriendlyName        = function(id) { return (id ? ((config.trustedList.pzh[id] && config.trustedList.pzh[id].friendlyName) || (config.trustedList.pzp[id] && config.trustedList.pzp[id].friendlyName)): config.metaData.friendlyName); };
    this.getMetaData            = function(id) { return (id ? config.metaData[id]: config.metaData); };
    this.getFileList            = function()   { return config.fileList; };
    this.getPzpHost             = function()   { return config.pzpHost };
    // Other configuration data
    this.getWebinosPorts        = function(id) { return (id? config.userPref.ports[id]: config.userPref.ports);};
    this.getServiceCache        = function()   {
        function contains(localArr, lname) {
            for (var i = 0 ; i < localArr.length; i = i + 1) {
                if (localArr[i].api == lname.api && localArr[i].serviceAddress == lname.serviceAddress) return false;
            }
            return true;
        }
        var remoteCache = config.serviceCache;
        var ownServices = PzpObject.getServices();
        for (var i = 0; i < ownServices.length; i = i + 1){
            if (contains(remoteCache, ownServices[i])) remoteCache.push(ownServices[i]);
        }
        remoteCache.sort(function(a,b) {return ((a.id)> ( b.id) ? 1 : ((b.id) > (a.id)) ? -1 : 0);} );
        return remoteCache;
    };
    this.getCertificate         = function(id) { return config.cert.internal[id].cert };
    this.getUserData            = function(id) { return (id? config.cert.userData[id]: config.cert.userData); };
    this.getCRL                 = function()   { return config.cert.crl.value; };
    this.getCertificateToBeSignedByPzh = function()   { return config.cert.internal.master.csr; };
    this.getExternalCertificates       = function(id) {
      if(config.cert.external) {
        return (id?config.cert.external[id]: Object.keys(config.cert.external));
      }
    };
    this.getExternalCertificateObj     = function() { return config.cert.external; };
    // Checks if component is currently connected to device directly or to the PZH
    this.checkConnectedPzh = function(from) { return (pzpState.connectedPzh.hasOwnProperty(from) || pzpState.connectedDevicesToPzh.pzh.hasOwnProperty(from)); };
    this.checkConnectedPzp = function(from) { return (pzpState.connectedPzp.hasOwnProperty(from) || pzpState.connectedDevicesToPzh.pzp.hasOwnProperty(from)); };
    // Change device name, this happens only when the name already exists in the zone, PZH instructs this name change.
    this.setDeviceName     = function(name) { config.metaData.webinosName = name; };
    this.updateTrustedList = function(value) {config.trustedList = value; config.storeDetails("trustedList", config.trustedList);};
    this.updateCRL         = function(value) {config.cert.crl.value = value; config.storeDetails("crl", config.cert.crl);};
    this.getSignedCertificateObj = function(){ return (config.cert.internal.signedCert || "{}"                  ); };
    this.getSignedCert = function(id){ return (config.cert.internal.signedCert[id] || config.cert.internal.signedCert); };
    this.updateExternalCertificates = function(value) {
        config.cert.external = value;
        config.storeDetails(PzpCommon.path.join("certificates","external"), "certificates",config.cert.external);
    };
    this.updateSignedCertificates = function(value) {config.cert.internal.signedCert = value; config.storeDetails(PzpCommon.path.join("certificates","internal"), "signedCertificates",config.cert.internal.signedCert);};
    this.getConnectedDevices = function() { return pzpState.connectedDevicesToPzh; };
    this.updateConnectedDevices = function(details){pzpState.connectedDevicesToPzh = details; };
    this.updateStoreServiceCache = function(serviceCache) {
        config.serviceCache = serviceCache;
        var extServ = [];
        config.storeDetails("userData", "serviceCache", serviceCache);
        serviceCache.forEach(function(service){
            if (service.serviceAddress && service.serviceAddress!== pzpState.sessionId) {
                extServ.push(service);
            }
        });
        PzpObject.addRemoteServices(extServ);
    };

    this.updateWebinosPort = function(key, value) {config.userPref.ports[key] = value; config.storeDetails("userData", "userPref", config.userPref) };
    this.checkTrustedList = function(from) {
        var list = from.split("/"), fromTrustedPzh, fromTrustedPzp;
        if(list.length === 3) { fromTrustedPzp = list[0]+ "/"+ list[1]; fromTrustedPzh = list[0];}   // From App
        if(list.length === 2) { fromTrustedPzp = list[0]+ "/"+ list[1]; fromTrustedPzh = list[0];} // From PZP
        if(list.length === 1) { fromTrustedPzh = list[0];} // From trusted PZH
        return (config && config.trustedList && (config.trustedList.pzh.hasOwnProperty(fromTrustedPzh) || config.trustedList.pzp.hasOwnProperty(fromTrustedPzp)));
    };

    this.deleteConnectedDevice = function(_id){
        var socket = pzpState.connectedPzh[_id] || pzpState.connectedPzp[_id];
        socket.socket.end();
        if (pzpState.connectedPzh[_id]) delete pzpState.connectedPzh[_id];
        if (pzpState.connectedPzp[_id]) delete pzpState.connectedPzp[_id];
    };

    function getCAList(){
        var caList = [];
        if (pzpState.enrolled) caList.push(PzpObject.getCertificate("pzh"));
        else caList.push(PzpObject.getCertificate("master"));
        var otherPzpCert = PzpObject.getSignedCertificateObj();
        for (var key in otherPzpCert) caList.push(otherPzpCert[key]);
        return caList;
    }

    function getCRLList(){
        var  crlList = [];
        crlList.push(PzpObject.getCRL());
        PzpObject.getExternalCertificates().forEach(function(name){
            crlList.push(PzpObject.getExternalCertificates(name).crl);
        });
        return crlList;
    }

    /**
     * Sets TLS connection parameters
     */
    this.setConnectionParameters = function () {
        try {
            var privateKey;
            if ((privateKey = config.cert.keyStore.fetchKey(config.cert.internal.conn.key_id))) {
                return  {
                    key : privateKey,
                    cert: PzpObject.getCertificate("conn"),
                    //crl : getCRLList(),
                    ca  : getCAList(),
                    servername: PzpObject.getPzhId() || PzpObject.getMetaData("serverName"),
                    rejectUnauthorized: true,
                    requestCert: true
                };
            }
        } catch(err) {
            PzpObject.emit("EXCEPTION", "Failed Setting TLS Connection Parameters - " + err);
        }
    };

     /**
     * Handles authentication
     * @param conn - socket connecton
     */
    this.handleAuthorization = function(conn) {
        var cert = conn.getPeerCertificate();
        if (cert && conn.authorized /*&& (config.cert.validateConnection(cert.issuer.CN, getCAList()))*/) {
            var name = decodeURIComponent(cert.subject.CN);
            var typeConn = name.split(":");
            var type = typeConn[0];
            var id = (type === "Pzh")? cert.subjectaltname && cert.subjectaltname.split(":")[1]: PzpObject.getPzhId()+"/"+typeConn[1];
            logger.log ("authorized & connected to : " + id);
            var store =  (type ==="Pzp") ? pzpState.connectedPzp: pzpState.connectedPzh;
                // If PZP with same id is already connected, disconnect socket
            if (store.hasOwnProperty(id)) store[id].socket.end();
            conn.id = id;
            store[id] = conn;
            pzpState.state[type] = "connected";
            PzpObject.onConnect(id);
            PzpObject.emit(type.toUpperCase()+"_CONNECTED");
            if (type === "Pzh") {
                PzpObject.setConnectState(type, true);
            }
        } else {
            PzpObject.unAuthorized(conn);
        }

    };

    /**
     * @param conn - Socket connection object of the PZH
     */
    this.unAuthorized = function(conn, type) {
        logger.error("not authenticated " + conn && conn.authorizationError);
        conn.socket.end();
        if (type) PzpObject.emit(type.toUpperCase()+"_CONNECT_FAILED");
        if (conn.authorizationError === 'CERT_NOT_YET_VALID') {
            throw "possible clock difference between PZH and your PZP, try updating time and try again";
        }
    };


    this.signCertificate = function(pzpId, csr, friendlyName) {
        if(config.cert.internal.signedCert[pzpId] = config.cert.generateSignedCertificate(csr)) {
            config.storeDetails(require("path").join("certificates", "internal"), "certificates", config.cert.internal);
            if (!config.trustedList.pzp.hasOwnProperty(id)) {// update configuration with signed certificate details ..
                config.trustedList.pzp[pzpId] = {"friendlyName": PzpObject.getFriendlyName(PzpObject.getPzhId())+ " " + friendlyName};
                config.storeDetails("trustedList", config.trustedList);
            }
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
        var url = require('url');
        logger.log ("PZP ENROLLED AT  " + from);    // This message come from PZH web server over websocket
        config.cert.internal.master.cert = payload.clientCert;
        config.cert.internal.pzh.cert    = payload.masterCert;
        config.cert.crl.value            = payload.masterCrl;
        config.metaData.pzhId            = from;
        config.metaData.serverName       = from && from.split ("@")[1];
        config.metaData.pzhWebAddress    = url.format(url.parse(payload.webAddress));
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

            config.userPref.ports.provider   = payload.serverPort;
            
            if (!config.trustedList.pzh.hasOwnProperty (config.metaData.pzhId)) {
                config.trustedList.pzh[config.metaData.pzhId] = {friendlyName: payload.friendlyName, remoteAddress: config.metaData.serverName };
            }
            pzpState.enrolled = true;
            pzpState.sessionId = PzpObject.setSessionId(); // IMP during enrollment sessionId changes..
            config.metaData.friendlyName = PzpObject.setFriendlyName(payload.pzpFriendlyName)
            config.serviceCache = [];
            PzpObject.startServer();
            config.storeDetails("userData", "serviceCache", config.serviceCache);
            config.storeDetails("userData", "userPref", config.userPref);
            config.storeDetails("metaData", config.metaData);
            config.storeDetails("crl", config.crl);
            config.storeDetails("trustedList", config.trustedList);
            config.storeDetails(require("path").join("certificates", "internal"), "certificates", config.cert.internal);
            PzpObject.connectOwnPzh();
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
                        config.storeDetails("crl", config.cert.crl);
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

        try {
            PzpCommon.wUtil.webinosHostname.getHostName(inputConfig.pzpHost, function (pzpHost) {
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
                    PzpObject.connectOwnPzh();
                    PzpObject.startServer();
                }
            });
        } catch (err) {
            PzpObject.emit("PZP_START_FAILED", err);
        }

    };

    PzpObject.initializePzp();
}
require("util").inherits(Pzp, PzpSendMessage);
require("util").inherits(Pzp, PzpEventHandler);
require("util").inherits(Pzp, PzpID);
require("util").inherits(Pzp, PzpCleanup);
require("util").inherits(Pzp, PzpOtherManager);
require("util").inherits(Pzp, PzpWebSocketServer);
require("util").inherits(Pzp, PzpConnectHub);
require("util").inherits(Pzp, PzpTLSServer);
require("util").inherits(Pzp, PzpSyncHandler);
require("util").inherits(Pzp, PzpPeerClient);
require("util").inherits(Pzp, PzpReceiveMessage);
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
    if (PzpAPI.inputConfig.forcedDeviceName){
        PzpAPI.otherPzpInstance = new Pzp(PzpAPI.inputConfig);
        return PzpAPI.otherPzpInstance;
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
    return (PzpAPI.getInstance()).getMetaData("webinosName");
};
PzpAPI.getWebinosPath = function() {
    return (PzpAPI.getInstance()).getMetaData("webinosRoot");
};
PzpAPI.getWebinosPorts = function() {
    return (PzpAPI.getInstance()).getWebinosPorts();
};
