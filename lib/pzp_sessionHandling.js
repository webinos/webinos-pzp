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
var PzpCommon = require("./pzp.js");

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
    PzpCommon.wUtil.webinosActions.ActionHandler.call(this);
    PzpReceiveMessage.call(this);

    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var PzpObject = this;
    var pzpState = {}, config = {}, pzpHost;

    /**
     * Return the list of CA certificates.
     * CA certificates in non enrolled state will be own CA certificate in enrolled state will be
     * Personal Zone's certificate. It also loads same zone certificates signed certificate by
     * Personal Zone Hub to allow P2P connection to work
     * @returns {Array} CA List
     */
    function getCAList(){
        var caList = [];
        if (pzpState.enrolled) {
            caList.push(PzpObject.getCertificate("pzh"));
        } else {
            caList.push(PzpObject.getCertificate("master"));
        }
        var otherCert = PzpObject.getSignedCert();
        for (var i = 0; i < otherCert.length; i++){
            caList.push(otherCert[i]);
        }
        return caList;
    }
    /**
     * Returns own Personal Zone's CRL and also CRL of connected PZHs
     * @returns {Array} CRL List
     */
    function getCRLList(){
        var  crlList = [];
        crlList.push(PzpObject.getCRL());
        var keys = Object.keys(PzpObject.getExternalCertificateObj());
        keys.forEach(function(name){
            crlList.push(PzpObject.getExternalCertificateObj()[name].crl);
        });
        return crlList;
    }
    /**
     * Returns the PZH Id of Personal Zone
     * @returns {string} pzhId - Returns pzhId
     */
    this.getPzhId = function()   {
        return config.metaData.pzhId;
    };
    /**
     * Returns own ID of the PZP
     * @returns {string} sessionId - Own Id of form in enrolled state pzhid/deviceid and in
     * non-enrolled state of form deviceid
     */
    this.getSessionId = function()   {
        return pzpState.sessionId;
    };
    /**
     * Returns enrolled to a hub status
     * @returns {Boolean} enrolled - status of the enrollment
     */
    this.getEnrolledStatus = function()   {
        return pzpState.enrolled;
    };
    /**
     * Returns the state of the PZP
     * @param {string} [id] - PZH or PZP state
     * @returns {string|Object} state - returns the whole state or particular entity in state list
     */
    this.getState = function(id) {
        return (id? pzpState.state[id] : pzpState.state);
    };
    /**
     * @param {string} [id] - optional param id to get particular PZP details
     * @returns {Object|Array} connected PZP - in case id is provided Object including details about
     * connected PZP is returned else array with names of connected PZP is returned
     */
    this.getConnectedPzp = function(id) {
        return (id? pzpState.connectedPzp[id]: Object.keys(pzpState.connectedPzp));
    };
    /**
     * @param {string} [id] - optional param id to get particular PZH details
     * @returns {Object|Array} connected PZH - in case id is provided Object including details about
     * connected PZH is returned else array with names of connected PZH is returned
     */
    this.getConnectedPzh = function(id) {
        return (id? pzpState.connectedPzh[id]: Object.keys(pzpState.connectedPzh));
    };
    // PZP metaData information retrieved by other PZP components
    /**
     * @param {string} [type] - pzh or pzp
     * @returns {Object} trustedList - In case type is provided trusted list of PZH or PZP is
     * returned or else list containing both PZH and PZP is returned
     */
    this.getTrustedList = function(type) {
        return (type==="pzh"? config.trustedList.pzh:
               (type=== "pzp" ? config.trustedList.pzp :config.trustedList));
    };
    /**
     * @param {string} [id] - Entity of the
     * @returns {string} friendlyName - friendly name of the own or else connected
     * entities friendly name
     */
    this.getFriendlyName = function(id) {
        if (!pzpState.enrolled) {
            return config.metaData.friendlyName;
        } else {
            if (!id) {
                id = pzpState.sessionId;
            }
            return ((config.trustedList.pzh[id] && config.trustedList.pzh[id].friendlyName) ||
                (config.trustedList.pzp[id] && config.trustedList.pzp[id].friendlyName));
        }
    };
    /**
     * @param {string} [id] - particular parameter value we are looking in metadata object
     * @returns {Object|string} metaData - A particular element in metaData structure or
     * whole metaData object if no id is provided
     */
    this.getMetaData = function(id) {
        return (id ? config.metaData[id]: config.metaData);
    };
    /**
     * @returns {Array} fileList - file location of the loaded services
     */
    this.getFileList = function()   {
        return config.fileList;
    };
    /**
     * Used while initializing file API
     * @returns {string} pzpHost - IP address of the current device
     */
    this.getPzpHost = function()   {
        return pzpHost
    };
    // Other configuration data
    /**
     * Webinos ports to initialize local servers and connect to PZH
     * @param {string} [id] -Id as defined in config.json ports section
     * @returns {string|Object} ports - returns particular id port or whole port object
     */
    this.getWebinosPorts = function(id) {
        return (id? config.userPref.ports[id]: config.userPref.ports);
    };
    /**
     * Returns the serviceCache of both local and remote PZP and PZPs
     * When PZP connects first time to PZH, this function is way sync manager sends local services
     * information to the PZH. Some steps might look replicated to updateServiceCache, but it is due
     * to different scenarios
     * @returns {Array} serviceCache - Includes service description in form of
     */
    this.getServiceCache = function()   {
        function contains(localArr, lname) {
            for (var i = 0 ; i < localArr.length; i = i + 1) {
                if (localArr[i].id === lname.id &&
                    localArr[i].serviceAddress === lname.serviceAddress) {
                    return true;
                }
            }
            return false;
        }
        var ownServices = PzpObject.getServices();
        var serviceCache = config.serviceCache;
        for (var i = 0; i < ownServices.length; i = i + 1){
            if (!contains(serviceCache, ownServices[i])) {
                serviceCache.push(ownServices[i]);
            }
        }
        serviceCache.sort(function(a,b) {return ((a.displayName)> ( b.displayName) ? 1 :
            ((b.displayName) > (a.displayName)) ? -1 : 0);} );
        return serviceCache;
    };
    /**
     * @param {string} id - Id of the PZH or connected PZP
     * @returns {string} cert - Returns cert of entity specified in id
     */
    this.getCertificate = function(id) {
        return (id ? config.cert.internal[id].cert : "")
    };
    /**
     * @param {string} [id] - Id of particular element in userData structure
     * @returns {string|Object} - returns property value if id is present or else whole user object
     */
    this.getUserData = function(id) {
        return (id? config.cert.userData[id]: config.cert.userData);
    };
    /**
     * @returns {string} crl - string containing Personal Zone CRL
     */
    this.getCRL = function()   {
        return config.cert.crl.value;
    };
    /**
     * @returns {string} csr - string containing csr to be signed by PZH
     */
    this.getCertificateToBeSignedByPzh = function()   {
        return config.cert.internal.master.csr;
    };
    /**
     * @returns {Object} external - Object containing external certificates
     */
    this.getExternalCertificateObj = function() {
        return config.cert.external;
    };
    /**
     * @returns {*|string} signedCert - returns signed cert if present
     */
    this.getSignedCertificateObj = function(){
        return (config.cert.internal.signedCert || "{}");
    };
    /**
     * @param {string} [id] - signed cert of the
     * @returns {Object|Array} signedCert - Array of the names of signedCert or Object containing
     * id of the
     */
    this.getSignedCert = function(id){
        return (config.cert.internal.signedCert[id] ||config.cert.internal.signedCert);
    };
    /**
     * @returns {Object} connectedDevicesToPzh - Devices connected list
     */
    this.getConnectedDevices = function() {
//        pzpState.connectedDevicesToPzh.pzp.sort(function(a,b) {return ((a.id)> ( b.id) ? 1 :
//                                                                      ((b.id) > (a.id)) ? -1 : 0);});
//        pzpState.connectedDevicesToPzh.pzh.sort(function(a,b) {return ((a.id)> ( b.id) ? 1 :
//                                                                      ((b.id) > (a.id)) ? -1 : 0);});
        return pzpState.connectedDevicesToPzh;
    };
    /**
     * Checks if PZP is currently connected to PZH  and external PZH to PZH
     * @param {string} from - id of entity to be checked
     * @returns {Boolean} connectedPzh - true or false if PZH is connected
     */
    this.checkConnectedPzh = function(from) {
        return (pzpState.connectedPzh.hasOwnProperty(from) ||
                pzpState.connectedDevicesToPzh.pzh.hasOwnProperty(from));
    };
    /**
     * Checks if PZP is connected to PZH or connected to PZH
     * @param {string} from - id of entity to be checked
     * @returns {Boolean} connectedPzp -  true or false if PZP is connected
     */
    this.checkConnectedPzp = function(from) {
        return (pzpState.connectedPzp.hasOwnProperty(from) ||
                pzpState.connectedDevicesToPzh.pzp.hasOwnProperty(from));
    };
    /**
     * Checks if id looked for is in the trusted list
     * @param {string} from - id of the entity to be checked
     * @returns {Boolean} trustedList - returns true or false
     */
    this.checkTrustedList = function(from) {
        var list = from.split("/"), fromTrustedPzh, fromTrustedPzp;
        // From App
        if(list.length === 3) { fromTrustedPzp = list[0]+ "/"+ list[1]; fromTrustedPzh = list[0];}
        // From PZP
        if(list.length === 2) { fromTrustedPzp = list[0]+ "/"+ list[1]; fromTrustedPzh = list[0];}
        // From trusted PZH
        if(list.length === 1) { fromTrustedPzh = list[0];}
        return (config && config.trustedList &&
               (config.trustedList.pzh.hasOwnProperty(fromTrustedPzh) ||
                config.trustedList.pzp.hasOwnProperty(fromTrustedPzp)));
    };
    /**
     * Used by sync manager to update trusted list of the personal zone
     * @param {Object} value - updated trusted list
     */
    this.updateTrustedList = function(value) {
        config.trustedList = value;
        config.storeDetails("trustedList", config.trustedList);
        var pm = null;
        try {
            pm = require("webinos-policy");
        } catch (e) {
            logger.log("Policy Manager was not found");
        }
        if (pm) {
            pm.policyEvent.emit("updateFriends");
        }
    };
    /**
     * Update CRL by sync manager
     * @param value - a new CRLof the personal zone
     */
    this.updateCRL = function(value) {
        config.cert.crl.value = value;
        config.storeDetails("crl", config.cert.crl);
    };
    /**
     * Update external certificate, this object is replica of the object on the PZH
     * @param value - A new certificate value
     */
    this.updateExternalCertificates = function(value) {
        config.cert.external = value;
        config.storeDetails(PzpCommon.path.join("certificates","external"),
                                                "certificates",config.cert.external);
    };
    /**
     * Update signed certificate structure
     * @param {Object} value - a new structure of the signed cert
     */
    this.updateSignedCertificates = function(value) {
        config.cert.internal.signedCert = value;
        config.storeDetails(PzpCommon.path.join("certificates","internal"),
                                               "signedCertificates",config.cert.internal.signedCert);
    };
    /**
     * Update connected devices information structure
     * @param {Object} details - Object containing details about the connected devices
     */
    this.updateConnectedDevices = function(details){
        pzpState.connectedDevicesToPzh = details;
//        pzpState.connectedDevicesToPzh.pzh.sort(function(a,b) {return ((a.id)> ( b.id) ? 1 :
//                                                                ((b.id) > (a.id)) ? -1 : 0);});
//        pzpState.connectedDevicesToPzh.pzp.sort(function(a,b) {return ((a.id)> ( b.id) ? 1 :
//                                                            ((b.id) > (a.id)) ? -1 : 0);} );
        PzpObject.registerBrowser();
    };
    /**
     * Store service cache information  and update discovery about remote object
     * @param {Object} serviceCache - Object containing both local and remote objects
     */
    this.updateStoreServiceCache = function(serviceCache) {
        config.serviceCache = serviceCache;
        config.storeDetails("userData", "serviceCache", serviceCache);
        var ownServices = PzpObject.getServices();
        var extServ = [];
        var notPresentServices = [];
        serviceCache.forEach(function(service){
            if (service.serviceAddress && service.serviceAddress!== pzpState.sessionId) {
                extServ.push(service);
                // External service but not locally present
                var found = false;
                ownServices.forEach(function(ownService){
                    if (ownService.api && ownService.api === service.api) {
                        found = true;
                    }
                });
                if (found !== true){
                    found = false;
                    var fileNames =
                        PzpCommon.fs.readdirSync(PzpCommon.path.join(__dirname, "../", "wrt"));
                    fileNames.sort();
                    var serviceName = service.api.split("/");
                    serviceName = serviceName[serviceName.length-1]+".js";
                    for (var j=0; j < fileNames.length; j = j + 1) {
                        if (fileNames[j] === serviceName){
                            found = true;
                        }
                    }
                   if (found === false)
                        notPresentServices.push(service);
                }
            }
        });

        if (notPresentServices.length > 0){
            for (var i = 0; i < notPresentServices.length; i++ ){
                PzpObject.prepMsg(notPresentServices[i].serviceAddress, "fetchJS", notPresentServices[i].api);
            }
        }
        PzpObject.addRemoteServices(extServ);

    };
    /**
     * Update webinos port, this is used when port is blocked
     * @param {string} key - server whole value is incremented
     * @param {string} value - a new port number
     */
    this.updateWebinosPort = function(key, value) {
        config.userPref.ports[key] = value;
    };
    /**
     * Used by App2App API
     * @param {string} type - pzh or pzp
     * @param {string} status - connected or not connected
     */
    this.updateState = function(type, status) {
        pzpState.state[type] = status;
    };
    /**
     * Updates PZH connected devices when an entity is disconnected
     * @param type - PZH or PZP
     * @param value - a new value of connected devices
     */
    this.updatePzhConnectedDevices = function(type, value) {
        pzpState.connectedDevicesToPzh[type] = value;
    };
//    /**
//     * Change  device name used by PZP, this is called when
//     * @param name
//     */
//    this.setDeviceName = function(name) {
//        config.metaData.webinosName = name;
//    };
    /**
     * Sets device type of the PZP using dashboard
     * @param {string} msg - a new device type
     */
    this.setDeviceType = function(msg) {
        if (pzpState.enrolled && PzpObject.checkTrustedList(pzpState.sessionId)) {
            config.trustedList.pzp[pzpState.sessionId].deviceType = msg.payload.message;
            config.storeDetails("trustedList", config.trustedList);
        } else {
            config.metaData.deviceType = msg.payload.message;
            config.storeDetails("metaData",config.metaData);
        }
    };
    /**
     * Changes friendly name of the PZP, this function is called during enrollment by the PZH or
     * if user changes name using dashboard
     * @param {string} msg - a new friendly name as set by the user
     */
    this.setFriendlyName = function(msg) {
       if (pzpState.enrolled && PzpObject.checkTrustedList(pzpState.sessionId)) {
          config.trustedList.pzp[pzpState.sessionId].friendlyName = msg.payload.message;
          config.storeDetails("trustedList", config.trustedList);
       } else {
         config.metaData.friendlyName = msg.payload.message;
         config.storeDetails("metaData", config.metaData);
       }
    };
    /**
     * Sets TLS connection parameters along with mutual authentication
     * @return {Object} - containing private key and certificates with mutual authentication set
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
     * Deletes element from the
     * @param _id
     */
    this.deleteConnectedDevice = function(_id){
        var socket = pzpState.connectedPzh[_id] || pzpState.connectedPzp[_id];
        socket.socket.end();
        if (pzpState.connectedPzh[_id]) delete pzpState.connectedPzh[_id];
        if (pzpState.connectedPzp[_id]) delete pzpState.connectedPzp[_id];
    };
     /**
     * Handles authentication and finds it is PZP or PZH that's connected
     * @param conn - socket connection
     */
    this.handleAuthorization = function(conn) {
        var cert = conn.getPeerCertificate();
        if (cert && conn.authorized /*&& (config.cert.validateConnection(cert.issuer.CN, getCAList()))*/) {
            var name = decodeURIComponent(cert.subject.CN);
            var typeConn = name.split(":");
            var type = typeConn[0];
            var id = (type === "Pzh")? cert.subjectaltname && cert.subjectaltname.split(":")[1]:
                                       PzpObject.getPzhId()+"/"+typeConn[1];
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
              PzpObject.sendPendingActions({ from: PzpObject.getPzhId() });
              PzpObject.setConnectState(type, true);
            }
        } else {
            PzpObject.unAuthorized(conn);
        }

    };
    /**
     * If certificates are not satisfied, disconnects the connection
     * @param conn - Socket connection object of the PZH
     */
    this.unAuthorized = function(conn, type) {
        logger.error("not authenticated " + conn && conn.authorizationError);
        conn.socket.end();
        if (type) {
            PzpObject.emit(type.toUpperCase()+"_CONNECT_FAILED");
        }
        if (conn.authorizationError === 'CERT_NOT_YET_VALID') {
            throw "possible clock difference between PZH and your PZP, try updating time and try again";
        }
    };
    /**
     * Sign a PZP certificate, this step is to aid micro PZP enrollment
     * @param pzpId - A PZP id being enrolled
     * @param csr - csr of the connecting PZP
     * @param friendlyName - connecting PZP friendly name
     */
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
     * Enroll PZP stores signed certificate information from the PZH and then triggers connectHub
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
             // At command line use following command to see file contents.
             // Contents to look in certificate are subject name and subject alt name...
             openssl x509 -in pzp_conn -noout -text
             */

            if (from.indexOf (":") !== -1) {
                config.metaData.serverName = config.metaData.serverName.split (":")[0];
            }

            PzpObject.updateWebinosPort("provider", payload.serverPort);

            if (!config.trustedList.pzh.hasOwnProperty (config.metaData.pzhId)) {
                config.trustedList.pzh[config.metaData.pzhId] = {
                    "email": "", "photoUrl": "",
                    "friendlyName": payload.friendlyName,
                    "nickname": "",
                    "authenticator": "",
                    "identifier": ""};
            }
            pzpState.enrolled = true;
            PzpObject.setSessionId(pzpState); // IMP during enrollment sessionId changes..
            config.trustedList.pzp[pzpState.sessionId]= {friendlyName: payload.pzpFriendlyName,
                                                         deviceType: config.metaData.deviceType,
                                                         pzhId: config.metaData.pzhId
                                                        };
            config.serviceCache = [];
            PzpObject.startTLSServer();
            config.storeDetails("userData", "serviceCache", config.serviceCache);
            config.storeDetails("metaData", config.metaData);
            config.storeDetails("crl", config.crl);
            config.storeDetails("trustedList", config.trustedList);
            config.storeDetails(require("path").join("certificates", "internal"),
                                                     "certificates", config.cert.internal);
            PzpObject.connectOwnPzh();
        }
        var pm = null;
        try {
            pm = require("webinos-policy");
        }
        catch (e) {
            logger.log("Policy Manager was not found");
        }
        if (pm) {
            pm.policyEvent.emit("updateEnrollmentStatus");
        }
    };
    /**
     *  This is a bootstrap function that initializes initial value for the PZP and set the
     *  required structures
     */
    function virginPzpInitialization(){
        /**
         * Creates PZP certificates
         * @returns {boolean} - updates
         */
        function createPzpCertificates(){
            try {
                var signedCert, csr;
                var cn = config.metaData.webinosType + "CA:" + config.metaData.webinosName;
                if(config.cert.generateSelfSignedCertificate(config.metaData.webinosType+"CA", cn)) {
                    logger.log ("*****"+config.metaData.webinosType+" Master Certificate Generated*****");
                    cn = config.metaData.webinosType + ":" + config.metaData.webinosName;
                    if( (csr=config.cert.generateSelfSignedCertificate(config.metaData.webinosType,cn))){
                        logger.log ("*****"+config.metaData.webinosType+
                            " Connection Certificate Generated*****");
                        signedCert = config.cert.generateSignedCertificate(csr);
                        if(signedCert) {
                            logger.log ("*****"+config.metaData.webinosType+
                                " Connection Certificate Signed by Master Certificate*****");
                            config.cert.internal.conn.cert = signedCert;
                            config.storeDetails(PzpCommon.path.join("certificates", "internal"),
                                "certificates", config.cert.internal);
                            config.storeDetails("crl", config.cert.crl);
                            return true;
                        }
                    }
                }
                return false;
            } catch(err){
                PzpObject.emit("FUNC_ERROR", "PZP create certificate failed");
            }
            return false;
        }
        if(config.createDefaultDirectories()) {
            var PzpDefaultConfig;
            PzpDefaultConfig = require("../config.json");
            config.userPref.ports = PzpDefaultConfig.ports;
            config.metaData.webinos_version = PzpDefaultConfig.webinos_version;
            config.metaData.retryConnection = PzpDefaultConfig.retryConnection;
            config.metaData.friendlyName =
                PzpObject.setDefaultFriendlyName(inputConfig.friendlyName ||
                                                 PzpDefaultConfig.friendlyName);
            config.storeDetails("metaData", config.metaData);
            if (createPzpCertificates()) {
                logger.log("created default set of PZP certificates");
            } // If PZP certificate will fail, it will generate error on its own
        }
    }

    /**
     * Initializes PZP WebSocket Server and then tries connecting with the PZH hub
     * Starting PZP means starting web socket server
     */
    PzpObject.initializePzp = function() {
        try {
            pzpState= {enrolled    :false,
                state       :{"Pzh":"not_connected", "Pzp":"not_connected"}, // State is applicable for hub mode but for peer mode, we need to check individually
                connectedPzp:{}, // Stores PZH server details
                connectedPzh:{}, // Stores connected PZP information directly to PZP
                sessionId   :"", // In virgin mode it is device name, if enrolled it is of from pzhId/deviceName
                connectedDevicesToPzh: {pzp:[], pzh: [] } }; //Stores information about device connected to PZH but not to PZP.
            PzpCommon.wUtil.webinosHostname.getHostName(inputConfig.pzpHost, function (hostAddress) {
                config = new PzpCommon.wUtil.webinosConfiguration("Pzp", inputConfig);// sets configuration
                config.cert = new PzpCommon.wCertificate(config.metaData);
                pzpHost = hostAddress;
                if(!config.loadWebinosConfiguration()){
                   virginPzpInitialization();
                }else {
                    config.userPref.ports = require("../config.json").ports;
                }
                config.loadCertificates(config.cert);
                if(config.metaData.pzhId) pzpState.enrolled = true;
                PzpObject.setSessionId(pzpState);
                logger.addId(pzpState.sessionId);
                PzpObject.startWebSocketServer();
                PzpObject.startOtherManagers();
                if (pzpState.enrolled) {
                    PzpObject.connectOwnPzh();
                    PzpObject.startTLSServer();
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
require("util").inherits(Pzp, PzpCommon.wUtil.webinosActions.ActionHandler);
Pzp.prototype.__proto__ = require("events").EventEmitter.prototype;

var PzpAPI = exports;
PzpAPI.otherPzpInstance = {};
/**
 * Sets the initial input configuration for the PZP.
 * @param inputConfig - Set of default or user set value while starting PZP
 */
PzpAPI.setInputConfig = function(inputConfig) {
    PzpAPI.inputConfig = inputConfig;
};
/**
 * Returns instance of the PZP. If forced device name is used, it returns other initialized instance.
 * If no instance is present, it create a new PZP instance
 * @returns {Object} PZP - PZP instance
 */
PzpAPI.getInstance = function() {
    if (!PzpAPI.inputConfig) {
        console.log("Missing inputConfig parameters");
        return null;
    }
    if (PzpAPI.inputConfig.forcedDeviceName){
        if (!PzpAPI.otherPzpInstance[PzpAPI.inputConfig.forcedDeviceName])
            PzpAPI.otherPzpInstance[PzpAPI.inputConfig.forcedDeviceName] = new Pzp(PzpAPI.inputConfig);
        return PzpAPI.otherPzpInstance[PzpAPI.inputConfig.forcedDeviceName];
    }
    if (!PzpAPI.pzpInstance) {
        PzpAPI.pzpInstance = new Pzp(PzpAPI.inputConfig);
    }
    return PzpAPI.pzpInstance;
};
/**
 * Retrieves PZP session identity
 * @returns {string} pzpId - Current PZP ID
 */
PzpAPI.getSessionId = function() {
    return (PzpAPI.getInstance()).getSessionId();
};
/**
 * Device name of the PZP
 * @returns {Object|string} deviceId - Current device name of the PZP
 */
PzpAPI.getDeviceName = function() {
    return (PzpAPI.getInstance()).getMetaData("webinosName");
};
/**
 * Path used to store webinos details
 * @returns {Object|string} webinosPath - Device path where webinos configuration is stored
 */
PzpAPI.getWebinosPath = function() {
    return (PzpAPI.getInstance()).getMetaData("webinosRoot");
};
/**
 * Retrieves structure of webinos port
 * @returns {Object} webinosPorts - Webinos ports structure
 */
PzpAPI.getWebinosPorts = function() {
    return (PzpAPI.getInstance()).getWebinosPorts();
};
/**
 * Sets service configuration
 * @param serviceName -
 * @returns {Object} service - all service information
 */
PzpAPI.getServiceConfiguration = function(serviceName) {
    var services = (PzpAPI.getInstance()).getServices();
    for (var i = 0; i < services.length; i = i + 1) {
        if(services[i].displayName === serviceName) {
            return services[i];
        }
    }
   return [];
};
/**
 * Sets service id of the configuration
 * @param serviceID
 * @param apiURI
 * @param params
 * @returns {*}
 */
PzpAPI.setServiceConfiguration = function(serviceID, apiURI, params) {
    return (PzpAPI.getInstance()).setServiceConfiguration(serviceID, apiURI, params);
};
