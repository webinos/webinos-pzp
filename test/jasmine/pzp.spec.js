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
 *******************************************************************************/
var pzp_api = require("../../lib/pzp_sessionHandling.js");
var fs = require("fs");
var os = require("os");
var path = require("path");
var webinosPath = require("webinos-utilities").webinosPath.webinosPath();
var webSocketClient = require('websocket').client
var wUtil = require("webinos-utilities");
var certificateHandler = require("webinos-certificateHandler");
var providerPort = require("../../config.json").ports.provider;
var providerWebServer = require("../../config.json").ports.provider_webServer;
var pzpInstance, pzhWebCertificates, pzhAddress;
var started = false;
var webinos;
var numberOfPZP,numberOfPZH;
numberOfPZH= 2; // Change this value if you do not like 100 PZPs to be created
numberOfPZP = 2;
var USER_DOMAIN = "localhost";
__EnablePolicyEditor = false;

var RSA_START       = "-----BEGIN RSA PRIVATE KEY-----";
var RSA_END         = "-----END RSA PRIVATE KEY-----";
var CERT_REQ_START  = "-----BEGIN CERTIFICATE REQUEST-----";
var CERT_REQ_END    = "-----END CERTIFICATE REQUEST-----";
var CERT_START      = "-----BEGIN CERTIFICATE-----";
var CERT_END        = "-----END CERTIFICATE-----";
var CRL_START       = "-----BEGIN X509 CRL-----";
var CRL_END         = "-----END X509 CRL-----";

var files = [path.join(webinosPath,"keys"),
            path.join(webinosPath,"certificates/internal"),
            path.join(webinosPath,"certificates/external"),
            path.join(webinosPath,"certificates"),
            path.join(webinosPath,"userData"),
            path.join(webinosPath,"logs"),
            path.join(webinosPath,"policies"),
            path.join(webinosPath,"wrt"),
            path.join(webinosPath,"crl.json"),
            path.join(webinosPath,"metaData.json")
        ];

function findService(address, callback){
    webinos.webinos.discovery.findServices(new webinos.ServiceType('http://webinos.org/api/test'),
        {onFound:function (service) {
            expect(service.api).toEqual('http://webinos.org/api/test');
            expect(service.displayName).toEqual('Test');
            expect(service._testAttr).toEqual('HelloWorld');
            // POLICY: Check WRT POLICY
            console.log("!!!!!Service found",service.serviceAddress, address)
            if(service.serviceAddress === address) {
                service.bindService({onBind:function (service1) {
                    expect(service1.id).toEqual(service.id);
                    expect(service1.api).toEqual(service.api);
                    expect(service1.displayName).toEqual(service.displayName);
                    expect(typeof service1.get42).toEqual("function");
                    expect(typeof service1.listenerFor42).toEqual("function");
                }});
                service.get42('foo', function (result) {
                    expect(result).toContain("foo");
                    service.listenerFor42(function (result) {
                        expect(result).toEqual({ msg: '42' });
                        callback(true);
                    }, {opts:"unused"});
                });
            }
        }
    });
}

function createPzhProvider() {
    var inputConfig = {
        "friendlyName": "",
        "sessionIdentity": pzhAddress
    };
    var config = new wUtil.webinosConfiguration("PzhP", inputConfig);
    config.cert = new certificateHandler(config.metaData);
    if(config.loadWebinosConfiguration() && config.loadCertificates(config.cert)){
        if((csr=config.cert.generateSelfSignedCertificate("PzhWS", "PzhWS"))) {
            if((clientCert= config.cert.generateSignedCertificate(csr))) {
                config.cert.internal["webclient"].cert = clientCert;
                pzhWebCertificates =   {
                    key:  config.cert.keyStore.fetchKey(config.cert.internal.webclient.key_id),
                    cert: config.cert.internal.webclient.cert,
                    ca:   config.cert.internal.master.cert,
                    requestCert: true,
                    rejectUnauthorized: true
                };
                return true;
            }
        }
    }
    return false;
}

function createPzh(pzhConnection, email, displayName) {
    var nickname = email.split("@")[0]
    var user = {
        emails: [{value:email}],
        displayName: displayName,
        from: "google",
        nickname:nickname, 
        identifier:nickname+"@"+USER_DOMAIN
    };
    pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "addPzh", "nickname":nickname}})));
    return user;
}

function createPzp(i, callback ) {
    var inputConfig = {
        "friendlyName":"Linux Device #"+i,
        "forcedDeviceName":"machine_"+i
    };
    pzp_api.setInputConfig(inputConfig);
    var pzpInstance= pzp_api.getInstance();
    pzpInstance.on("PZP_STARTED",function(){
         callback(pzpInstance);
    });
}

function enrollPzp(pzhConnection, user, pzpInstance) {
    webinos.webinos.session.message_send({type:'prop', payload:{status:'setPzhProviderAddress', message:pzhAddress}});
    var msg = {user: user,
        message: {type:"csrFromPzp",
            from:pzpInstance.getMetaData("webinosName"),
            csr:pzpInstance.getCertificateToBeSignedByPzh(),
            friendlyName: pzpInstance.getFriendlyName()}};
    pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify(msg)));
}

// VIRGIN PZP START
describe("Create a VIRGIN PZP", function(){
    it ("Initialize PZP instance", function(done) {
        pzp_api.setInputConfig({});
        pzpInstance = pzp_api.getInstance();
        pzpInstance.on("PZP_STARTED",function(){
            started = true;
            done();
        });
        expect(pzpInstance).not.toBeNull();
    });
    it ("SessionId = Device name in virgin mode", function() {
        expect(pzpInstance.getSessionId()).not.toBeNull();
        expect(pzpInstance.getMetaData("webinosName")).not.toBeNull();
        expect(pzpInstance.getMetaData("webinosName")).toEqual((os.hostname()).substring(0,34)); // Device Name should equal device hostname.
        expect(pzpInstance.getMetaData("webinosName")).toEqual(pzpInstance.getSessionId());// in virgin mode they should be equal
        expect(pzp_api.getDeviceName()).toEqual(pzpInstance.getMetaData("webinosName"));// PZP exposed API should equal instance value
        expect(pzp_api.getSessionId()).toEqual(pzpInstance.getSessionId());
    });
});

describe("PZP default configuration in VIRGIN mode", function(){
    it ("Default directories of webinos PZP", function() {
        files.forEach(function(folderName){
            expect(fs.existsSync(folderName)).toBeTruthy();
        });
    });
    // Everything depends on this information...
    it ("Webinos metadata", function() {
        var metaData = JSON.parse(fs.readFileSync(path.join(webinosPath,"metaData.json")).toString());
        expect(metaData).not.toBeNull();
        expect(pzpInstance.getPzhId()).not.toBeNull();
        expect(metaData.pzhId).toEqual(pzpInstance.getPzhId());
        expect(pzpInstance.getMetaData("serverName")).not.toBeNull();
        expect(metaData.serverName).toEqual(pzpInstance.getMetaData("serverName"));
        expect(pzpInstance.getMetaData("webinos_version")).not.toBeNull();
        expect(metaData.webinos_version).toEqual(pzpInstance.getMetaData("webinos_version"));
        expect(pzpInstance.getMetaData("webinosName")).not.toBeNull();
        expect(metaData.webinosName).toEqual(pzpInstance.getMetaData("webinosName"));
        expect(pzpInstance.getMetaData("webinosRoot")).not.toBeNull();
        expect(metaData.webinosRoot).toEqual(pzpInstance.getMetaData("webinosRoot"));
        expect(pzpInstance.getFriendlyName()).not.toBeNull();
        expect(metaData.friendlyName).toEqual(pzpInstance.getFriendlyName());
        expect(pzpInstance.getMetaData("retryConnection")).not.toBeNull();
        expect(metaData.retryConnection).toEqual(pzpInstance.getMetaData("retryConnection"));
    });
    it ("Service cache i.e. services are loaded", function() {
//        var serviceCache = JSON.parse(fs.readFileSync(path.join(webinosPath,"userData","serviceCache.json")).toString());
//        expect(serviceCache).not.toBeNull();
//        expect(pzpInstance.getServiceCache()).not.toBeNull();
//        expect(serviceCache).toEqual(pzpInstance.getServiceCache());
    });
    it ("Default userData i.e. details that will be used by certificate", function() {
        expect(pzpInstance.getUserData()).not.toBeNull();
    });
    it ("Ports configuration", function() {
        expect(pzpInstance.getWebinosPorts()).not.toBeNull();
        expect(pzp_api.getWebinosPorts()).toEqual(pzpInstance.getWebinosPorts());
    });
    it("search particular service configuration data", function(){
       var result = pzp_api.getServiceConfiguration("Test");
       expect(result.displayName).toEqual("Test");
       expect(result.api).toEqual("http://webinos.org/api/test");
       expect(result.serviceAddress).toEqual((os.hostname()).substring(0,34));
    });
});

describe("Master and connection certificates/privateKey", function() {
    var certificates, crl, keyList;
    it("Private keys", function(){
        keyList      = fs.readdirSync(path.join(webinosPath,"keys"));
        keyList.forEach(function(name){
            var key = fs.readFileSync(path.join(webinosPath,"keys", name)).toString();
            expect(key).not.toBeNull();
            expect(key).toContain(RSA_START);
            expect(key).toContain(RSA_END);
        });
    });

    it("Web and PZH certificate should be empty in VIRGIN mode", function() {
        certificates = JSON.parse(fs.readFileSync(path.join(webinosPath,"certificates","internal","certificates.json")).toString());
        crl          = JSON.parse(fs.readFileSync(path.join(webinosPath,"crl.json")).toString());
        expect(certificates).not.toBeNull();
        expect(certificates.web).toEqual({});
        expect(certificates.pzh).toEqual({});
    });

    it("Master certificate", function(){
        expect(certificates.master.key_id).not.toBeNull();
        expect(certificates.master.key_id).toContain(pzpInstance.getMetaData("webinosName")+"_master");
        expect(pzpInstance.getCertificate("master")).not.toBeNull();
        expect(pzpInstance.getCertificateToBeSignedByPzh()).not.toBeNull();
        expect(certificates.master.csr).toContain(CERT_REQ_START);
        expect(certificates.master.csr).toContain(CERT_REQ_END);
        expect(certificates.master.csr).toContain(pzpInstance.getCertificateToBeSignedByPzh());
        expect(certificates.master.cert).toContain(CERT_START);
        expect(certificates.master.cert).toContain(CERT_END);
        expect(certificates.master.cert).toEqual(pzpInstance.getCertificate("master"));
    });

    it("Connection certificate", function(){
        expect(certificates.conn.key_id).not.toBeNull();
        expect(certificates.conn.key_id).toContain(pzpInstance.getMetaData("webinosName")+"_conn");
        expect(certificates.conn.csr).not.toBeNull();
        expect(certificates.conn.csr).toContain(CERT_REQ_START);
        expect(certificates.conn.csr).toContain(CERT_REQ_END);
        expect(certificates.conn.cert).toContain(CERT_START);
        expect(certificates.conn.cert).toContain(CERT_END);
        expect(pzpInstance.getCertificate("conn")).not.toBeNull();
        expect(certificates.conn.cert).toEqual(pzpInstance.getCertificate("conn"));
    });

    it("CRL", function(){
        expect(crl).not.toBeNull();
        expect(crl.value).toContain(CRL_START);
        expect(crl.value).toContain(CRL_END);
        expect(pzpInstance.getCRL()).not.toBeNull();
        expect(crl.value).toEqual(pzpInstance.getCRL());
    });
});

describe("PZP WebSocket Server ", function(){
    it ("Server status", function () {
        expect(started).toBeTruthy();
    });
    it ("WSS HTTP server running status", function (done) {
        require("http").get("http://localhost:"+pzpInstance.getWebinosPorts("pzp_webSocket"), function(res){
            expect(res.statusCode).toEqual(200);
            done();
        });
    });
});

describe("Browser/Widget connection to WebSocket server", function () {
    it("Initiate WebSocket client connection & check register browser message and webinos version message", function(done){
        webinos = require("./webinos.js");
        webinos.webinos.session.addListener ('webinosVersion', webinosVersion);
        webinos.webinos.session.addListener ('registeredBrowser', registeredBrowser);
        function webinosVersion(parseData){
            expect(parseData.type).toEqual("prop");
            expect(parseData.from).toEqual(pzpInstance.getSessionId());
            expect(parseData.to).not.toBeNull();
            expect(parseData.payload.status).toEqual("webinosVersion");
            expect(parseData.payload.message).not.toBeNull();
            expect(parseData.payload.message.tag).not.toBeNull();
            expect(parseData.payload.message.num_commit).not.toBeNull();
            expect(parseData.payload.message.commit_id).not.toBeNull();
        }
        function registeredBrowser(parseData){
            expect(parseData.type).toEqual("prop");
            expect(parseData.from).toEqual(pzpInstance.getSessionId());
            expect(parseData.to).not.toBeNull();
            expect(parseData.payload.status).toEqual("registeredBrowser");
            expect(parseData.payload.message).not.toBeNull();
            expect(parseData.payload.message.pzhId).toEqual(undefined);
            expect(parseData.payload.message.connectedDevices.length).toEqual(1);
            expect(parseData.payload.message.connectedDevices[0].id).toEqual(pzpInstance.getSessionId());
            expect(parseData.payload.message.connectedDevices[0].friendlyName).toEqual(pzpInstance.getFriendlyName());
            expect(parseData.payload.message.state.Pzp).toEqual("not_connected");
            expect(parseData.payload.message.state.Pzh).toEqual("not_connected");
            expect(parseData.payload.message.enrolled).toEqual(false);
            done();
        }
    });
    it("Find Service inside same PZP", function(done){
         findService(pzpInstance.getSessionId(), function(status){
            if (status) done();
         });
    });
});
 ////////////// End of VIRGIN PZP SCENARIO   \\\\\\\\\\\\\\\\\\\\\\\\\\\\\

// Start of Enrolling 1 PZP at a PZH
describe("PZH - PZP connectivity, enrollment, and findService at PZH", function(){
    var pzhConnection, user;
    it("PZH farm status", function(done){
        wUtil.webinosHostname.getHostName("", function (address) {
            pzhAddress= address;
            var socket = require("net").createConnection(pzpInstance.getWebinosPorts("provider"),  address); //Check if we are online..
            socket.on('connect', function() {
                socket.end();
                done();
            });
        });
    });
    it("Enroll A PZP at the PZH and Connect", function(done){
        // Makes a TLS connection towards PZH similar to PZH webServer
        if(createPzhProvider()){
            pzhConnection = require("tls").connect(pzpInstance.getWebinosPorts("provider"),pzhAddress, pzhWebCertificates,
            function () {
                expect(pzhConnection.authorized).toEqual(true);
                user = createPzh(pzhConnection, "hello0@"+USER_DOMAIN, "Hello#0");
            });
            pzhConnection.on("data", function (_buffer) {
                wUtil.webinosMsgProcessing.readJson(pzhConnection.address().address, _buffer, function (obj) {
                    if(obj.payload && obj.payload.type && obj.payload.type === "addPzh") {
                       enrollPzp(pzhConnection, user, pzpInstance);
                    } else if (obj.payload && obj.payload.message && obj.payload.message.payload && obj.payload.message.payload.status === "signedCertByPzh"){
                        expect(obj.user.nickname).toEqual("hello0");
                        expect(obj.payload.type).toEqual("csrFromPzp");
                        expect(obj.payload.message.from).toEqual("hello0@"+pzhAddress);
                        expect(obj.payload.message.to).toEqual("hello0@"+pzhAddress+"/"+pzpInstance.getMetaData("webinosName"));
                        expect(obj.payload.message.payload.status).toEqual("signedCertByPzh");
                        expect(obj.payload.message.payload.message.clientCert).not.toBeNull();
                        expect(obj.payload.message.payload.message.clientCert).toContain(CERT_START);
                        expect(obj.payload.message.payload.message.clientCert).toContain(CERT_END);
                        expect(obj.payload.message.payload.message.masterCert).not.toBeNull();
                        expect(obj.payload.message.payload.message.masterCert).toContain(CERT_START);
                        expect(obj.payload.message.payload.message.masterCert).toContain(CERT_END);
                        expect(obj.payload.message.payload.message.masterCrl).not.toBeNull();
                        expect(obj.payload.message.payload.message.masterCrl).toContain(CRL_START);
                        expect(obj.payload.message.payload.message.masterCrl).toContain(CRL_END);
                        pzpInstance.pzpEnrollment(obj.payload.message.from, obj.payload.message.to, obj.payload.message.payload.message); // This message enrolls PZP at the PZH

                    }
                });
            });
        }
        pzpInstance.on("PZH_CONNECTED", function(){
            done();
        });
    },2000);
    it("Find service at the PZH", function(done){
        setTimeout(function() {
            findService("hello0@"+pzhAddress,function(status){
                if (status) done();
            })
        }, 1000);// the update message that PZP sends take time to reach websocket client...
    }, 3000);
    // POLICY: Check at PZP by searching for service that is not allowed
});
////// End of Single PZP test cases ....\\\\\\\\\\\\
// Enroll multiple PZPs at a PZH
describe("Create "+numberOfPZP+" PZP and Enroll with the Same PZH ", function(){
   it("Create "+numberOfPZP+" PZPs", function(done){
       var user = {emails: [{value:"hello0@"+USER_DOMAIN}],displayName: "Hello#0",from: "google", nickname:"hello0", identifier:"hello0@"+USER_DOMAIN};
       function createPzpEnroll(i) {
          createPzp(i, function(pzpInstance){
              var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,
              function() {
                  expect(pzhConnection.authorized).toEqual(true);
                  // We could use same pzhConnection as above but the event data needs to be handled
                  enrollPzp(pzhConnection, user, pzpInstance);
                  pzhConnection.on("data", function (_buffer) {
                      wUtil.webinosMsgProcessing.readJson(pzhConnection.address().address, _buffer, function (obj) {
                          if (obj&& obj.payload && obj.payload.message && obj.payload.message.payload && obj.payload.message.payload.status === "signedCertByPzh"){
                              expect(obj.payload.message.from).toEqual("hello0@"+pzhAddress);
                              expect(obj.payload.message.to).toEqual("hello0@"+pzhAddress+"/"+pzpInstance.getMetaData("webinosName"));
                              expect(obj.payload.message.payload.status).toEqual("signedCertByPzh");
                              expect(obj.payload.message.payload.message.clientCert).toContain(CERT_START);
                              expect(obj.payload.message.payload.message.masterCert).toContain(CERT_START);
                              expect(obj.payload.message.payload.message.masterCrl).toContain(CRL_START);
                              pzpInstance.pzpEnrollment(obj.payload.message.from, obj.payload.message.to, obj.payload.message.payload.message);
                              pzpInstance.on("PZH_CONNECTED", function(){
                                  setTimeout(function(){
                                      var addressLookService = "hello0@" + pzhAddress+ "/machine_"+ ((i === 0 )?0: (i-1)); // Find Service at other PZP
                                      findService(addressLookService,function(){
                                          //pzhConnection.socket.end();
                                          if ((i+1) < numberOfPZP) createPzpEnroll(i + 1);
                                          else done();
                                      });
                                  },750); // Time Before everything get started....
                              });
                          }
                      });
                  });
              });
          });
       }
       createPzpEnroll(0);
   }, numberOfPZP*2000); // 1000 ms for each PZP to search service from the connected PZH...
});

// Create PZH,inside PZH there will be single PZP, 2 PZH will connect each other and find service in PZP of other zone
describe("PZH - PZH certificate exchange", function() {
    it("Create Multiple PZH, each PZH will have a PZP created and enrolled with them", function(done) {
        function createPzh_Pzp(i) {
            var socket = require("tls").connect(providerPort,pzhAddress, pzhWebCertificates,
                function() {
                    var  pzpInstance, user = createPzh(socket, "hello"+i+"@"+USER_DOMAIN, "Hello#"+ i);
                    socket.on("data", function (_buffer) {
                        wUtil.webinosMsgProcessing.readJson(socket.address().address, _buffer, function (obj) {
                            if(obj.payload && obj.payload.type && obj.payload.type === "addPzh") {
                                createPzp(numberOfPZP+i, function(pzpInstance_){
                                    pzpInstance = pzpInstance_;
                                    enrollPzp(socket, user, pzpInstance);
                                });
                            } else if (obj&& obj.payload && obj.payload.message && obj.payload.message.payload &&
                                obj.payload.message.payload.status === "signedCertByPzh"){
                                pzpInstance.pzpEnrollment(obj.payload.message.from, obj.payload.message.to,
                                    obj.payload.message.payload.message);
                                pzpInstance.on("PZH_CONNECTED", function(){
                                    socket.socket.end();
                                    if ((i +1) < numberOfPZH) createPzh_Pzp(i+1);
                                    else done();
                                });
                            }
                        });
                    });
                });
        }
        createPzh_Pzp(1);  // 0 is first PZH that's created already
    });
    it("Connect PZH (hello0@"+USER_DOMAIN+") to all PZHs we have created", function(done) {
        // Certificate Exchange between PZH0 to PZH1
        // Connect everyone to PZH0 as we have only access to this PZH's PZP's WRT...
        function connectPZH(i) {
            var msg, socket = require("tls").connect(providerPort,pzhAddress, pzhWebCertificates,
                function() {
                    var user = {emails: [{value:"hello0@"+USER_DOMAIN}], displayName: "Hello#0",  from: "google", nickname:"hello0", identifier:"hello0@"+USER_DOMAIN};
                    // hello0@webinos.org connect to all PZHs
                    msg = {user: user, message: {type: "requestAddLocalFriend", "externalNickname":"hello"+i}};
                    socket.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify(msg)));
                    socket.on("data", function (_buffer) {
                        wUtil.webinosMsgProcessing.readJson(socket.address().address, _buffer, function (obj) {
                            if(obj.payload && obj.payload.type && obj.payload.type === "requestAddLocalFriend") {
                                expect(obj.payload.message).toEqual(true);
                                socket.socket.end();
                                if ((i+1) < numberOfPZH) connectPZH(i+1);
                                else done();
                            }

                        });
                    });
                });
        }
        connectPZH(1);
    });

    it("Approve at all PZH, request from hello0@"+USER_DOMAIN, function(done){
        function approvePZH(i) {
            var msg, socket = require("tls").connect(providerPort,pzhAddress, pzhWebCertificates,
                function() {
                    var user = {emails: [{value:"hello"+i+"@"+USER_DOMAIN}], displayName: "Hello#"+i,  from: "google", "nickname":"hello"+i, "identifier":"hello"+i+"@"+USER_DOMAIN};
                    // hello0@webinos.org connect to all PZHs
                    msg = {user: user, message: {type: "approveFriend", "externalUserId":"hello0@"+pzhAddress}};
                    socket.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify(msg)));
                    socket.on("data", function (_buffer) {
                        wUtil.webinosMsgProcessing.readJson(socket.address().address, _buffer, function (obj) {
                            if(obj.payload && obj.payload.type && obj.payload.type === "approveFriend") {
                                expect(obj.payload.message).toEqual(true);
                                socket.socket.end();
                                if ((i+1) < numberOfPZH) approvePZH(i+1);
                                else done();
                           }
                        });
                    });

                });
        }
        approvePZH(1);
    });
    // All PZH are now connected, so at PZH (hello0@webinos.org) findService
    it("FindService in between connected PZH's service at PZP", function(done){
        // PZH A hello0@webinos.org and PZH B hello1@webinos.org are connected to each other, so from A we can get PZP's service
        // So findService from PZHA about PZHB services...
        function findServicePzp(i) {
            setTimeout(function(){
                var address = "hello"+i+"@"+pzhAddress+"/machine_"+ (numberOfPZP+i);
                findService(address, function(status){
                    expect(status).toBeTruthy();
                    if ((i + 1) < numberOfPZH) findServicePzp(i+1);
                    else done();
                });
            }, 1000); // A delay as connection between PZH take time to exchange services
        }
        findServicePzp(1);
    }, numberOfPZH * 2000); // It takes extra time as more hops are involved
});

describe("machine with long Pzp Name", function(){
   it("create pzp with long name and enroll with pzh", function(done){
       var user = {emails: [{value:"hello0@"+USER_DOMAIN}],displayName: "Hello#0",from: "google", nickname:"hello0", identifier:"hello0@"+USER_DOMAIN};

       var inputConfig = {
           "friendlyName":"Linux Device #longName",
           "forcedDeviceName":"machinethatissupportingpzplongnametesting"
       };
       pzp_api.setInputConfig(inputConfig);
       var pzpInstance= pzp_api.getInstance();
       pzpInstance.on("PZP_STARTED",function(){
           var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,
           function() {
               enrollPzp(pzhConnection, user, pzpInstance);
               pzhConnection.on("data", function (_buffer) {
                   wUtil.webinosMsgProcessing.readJson(pzhConnection.address().address, _buffer, function (obj) {
                       if (obj&& obj.payload && obj.payload.message && obj.payload.message.payload && obj.payload.message.payload.status === "signedCertByPzh"){
                           expect(obj.payload.message.from).toEqual("hello0@"+pzhAddress);
                           expect(obj.payload.message.to).toEqual("hello0@"+pzhAddress+"/"+pzpInstance.getMetaData("webinosName"));
                           expect(obj.payload.message.payload.status).toEqual("signedCertByPzh");
                           expect(obj.payload.message.payload.message.clientCert).toContain(CERT_START);
                           expect(obj.payload.message.payload.message.masterCert).toContain(CERT_START);
                           expect(obj.payload.message.payload.message.masterCrl).toContain(CRL_START);
                           pzpInstance.pzpEnrollment(obj.payload.message.from, obj.payload.message.to, obj.payload.message.payload.message);
                           pzpInstance.on("PZH_CONNECTED", function(){
                               setTimeout(function(){
                                   var addressLookService = "hello0@"+pzhAddress; // Find Service at PZH
                                   findService(addressLookService,function(){
                                     pzhConnection.socket.end();
                                     done();
                                   });
                               },500); // Time Before everything get started....
                           });
                       }
                   });
               });
           });
       });
   },2000);
});
 
// Check sync with PZH
describe("check synchronization with the PZH", function(){
    it("check at the pzp if contents match with the contents of the PZH", function(done){
        var pzhPath = pzpInstance.getMetaData("webinosRoot")+"Pzh/hello0";
        var pzpPath = pzpInstance.getMetaData("webinosRoot");
       pzpInstance.getFileList().forEach(function(name){
           if (name.fileName === "trustedList") {
               var pzpTrustedList = require(pzpPath+"/trustedList.json");
               var pzhTrustedList = require(pzhPath+"/trustedList.json");
               expect(Object.keys(pzpTrustedList.pzh).length).toEqual(Object.keys(pzhTrustedList.pzh).length);
               expect(Object.keys(pzpTrustedList.pzp).length).toEqual(Object.keys(pzhTrustedList.pzp).length);
           }
           if (name.fileName === "crl") {
               expect(require(pzpPath+"/crl.json")).toEqual(require(pzhPath+"/crl.json"));
           }
           if (name.fileName === "certificates") {
               expect(require(pzpPath+"/certificates/external/certificates.json")).toEqual(require(pzhPath+"/certificates/external/certificates.json"));
           }
       });
       done();
    });
    it("PZP service cache synced with the PZH", function(done){
        var pzhPath = pzpInstance.getMetaData("webinosRoot")+"Pzh/hello0";
        var pzpPath = pzpInstance.getMetaData("webinosRoot");
        var pzpData = require(pzpPath+"/userData/serviceCache.json");
        var pzhData = require(pzhPath+"/userData/serviceCache.json");
        expect(Object.keys(pzpData).length).toEqual(Object.keys(pzhData).length);
        done();
    },2000);
});
