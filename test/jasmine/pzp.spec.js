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

var pzpInstance, pzhWebCertificates, pzhAddress;
var started = false;
var webinos;
var numberOfPZP,numberOfPZH;
numberOfPZH= 2; // Change this value if you do not like 100 PZPs to be created
numberOfPZP = 2;

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
// VIRGIN PZP START
describe("Create a VIRGIN PZP", function(){
    it ("Initialize PZP instance", function(done) {
        pzp_api.setInputConfig({});
        pzpInstance = pzp_api.getInstance();
        pzpInstance.on("PZP_STARTED",function(){
            console.log("pzp started event received");
            started = true;
            done();
        });
        expect(pzpInstance).not.toBeNull();
    });
    it ("SessionId = Device name in virgin mode", function() {
        expect(pzpInstance.getSessionId()).not.toBeNull();
        expect(pzpInstance.getDeviceName()).not.toBeNull();
        expect(pzpInstance.getDeviceName()).toEqual(os.hostname()); // Device Name should equal device hostname.
        expect("D"+pzpInstance.getDeviceName()).toEqual(pzpInstance.getSessionId());// in virgin mode they should be equal
        expect(pzp_api.getDeviceName()).toEqual(pzpInstance.getDeviceName());// PZP exposed API should equal instance value
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
        expect(pzpInstance.getServerAddress()).not.toBeNull();
        expect(metaData.serverName).toEqual(pzpInstance.getServerAddress());
        expect(pzpInstance.getWebinosVersion()).not.toBeNull();
        expect(metaData.webinos_version).toEqual(pzpInstance.getWebinosVersion());
        expect(pzpInstance.getDeviceName()).not.toBeNull();
        expect(metaData.webinosName).toEqual(pzpInstance.getDeviceName());
        expect(pzpInstance.getWebinosPath()).not.toBeNull();
        expect(metaData.webinosRoot).toEqual(pzpInstance.getWebinosPath());
        expect(pzpInstance.getFriendlyName()).not.toBeNull();
        expect(metaData.friendlyName).toEqual(pzpInstance.getFriendlyName());
        expect(pzpInstance.getRetryConnectionValue()).not.toBeNull();
        expect(metaData.retryConnection).toEqual(pzpInstance.getRetryConnectionValue());
    });
    it ("Service cache i.e. services are loaded", function() {
        var serviceCache = JSON.parse(fs.readFileSync(path.join(webinosPath,"userData","serviceCache.json")).toString());
        expect(serviceCache).not.toBeNull();
        expect(pzpInstance.getServiceCache()).not.toBeNull();
        expect(serviceCache).toEqual(pzpInstance.getServiceCache());
    });
    it ("Default userData i.e. details that will be used by certificate", function() {
        var userData = JSON.parse(fs.readFileSync(path.join(webinosPath,"userData","userDetails.json")).toString());
        expect(userData).not.toBeNull();
        expect(pzpInstance.getUserData()).not.toBeNull();
        expect(userData).toEqual(pzpInstance.getUserData());
    });
    it ("Ports configuration", function() {
        var userPref = JSON.parse(fs.readFileSync(path.join(webinosPath,"userData","userPref.json")).toString());
        expect(userPref).not.toBeNull();
        expect(pzpInstance.getWebinosPorts()).not.toBeNull();
        expect(JSON.stringify(userPref.ports)).toEqual(JSON.stringify(pzpInstance.getWebinosPorts()));
        expect(pzp_api.getWebinosPorts()).not.toBeNull(); // Check PZP exposed API are having right value
        expect(pzp_api.getWebinosPorts()).toEqual(pzpInstance.getWebinosPorts());
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
        expect(certificates.master.key_id).toContain(os.hostname()+"_master");
        expect(pzpInstance.getMasterCertificate()).not.toBeNull();
        expect(pzpInstance.getCertificateToBeSignedByPzh()).not.toBeNull();
        expect(certificates.master.csr).toContain(CERT_REQ_START);
        expect(certificates.master.csr).toContain(CERT_REQ_END);
        expect(certificates.master.csr).toContain(pzpInstance.getCertificateToBeSignedByPzh());
        expect(certificates.master.cert).toContain(CERT_START);
        expect(certificates.master.cert).toContain(CERT_END);
        expect(certificates.master.cert).toEqual(pzpInstance.getMasterCertificate());
    });

    it("Connection certificate", function(){
        expect(certificates.conn.key_id).not.toBeNull();
        expect(certificates.conn.key_id).toContain(os.hostname()+"_conn");
        expect(certificates.conn.csr).not.toBeNull();
        expect(certificates.conn.csr).toContain(CERT_REQ_START);
        expect(certificates.conn.csr).toContain(CERT_REQ_END);
        expect(certificates.conn.cert).toContain(CERT_START);
        expect(certificates.conn.cert).toContain(CERT_END);
        expect(pzpInstance.getConnectionCertificate()).not.toBeNull();
        expect(certificates.conn.cert).toEqual(pzpInstance.getConnectionCertificate());
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
        require("http").get("http://localhost:"+pzpInstance.getWebinosPorts().pzp_webSocket, function(res){
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
            expect(parseData.from).toEqual(pzpInstance.getFriendlyName());
            expect(parseData.to).not.toBeNull();
            expect(parseData.payload.status).toEqual("webinosVersion");
            expect(parseData.payload.message).not.toBeNull();
            expect(parseData.payload.message.tag).not.toBeNull();
            expect(parseData.payload.message.num_commit).not.toBeNull();
            expect(parseData.payload.message.commit_id).not.toBeNull();
        }
        function registeredBrowser(parseData){
            expect(parseData.type).toEqual("prop");
            expect(parseData.from).toEqual(pzpInstance.getFriendlyName());
            expect(parseData.to).not.toBeNull();
            expect(parseData.payload.status).toEqual("registeredBrowser");
            expect(parseData.payload.message).not.toBeNull();
            expect(parseData.payload.message.pzhId).toEqual("");
            expect(parseData.payload.message.connectedDevices.length).toEqual(1);
            expect(parseData.payload.message.connectedDevices[0]).toEqual(pzpInstance.getFriendlyName());
            expect(parseData.payload.message.state.hub).toEqual("not_connected");
            expect(parseData.payload.message.state.peer).toEqual("not_connected");
            expect(parseData.payload.message.enrolled).toEqual(false);
            done();
        }
    });
    it("Find Service inside same PZP", function(done){
        webinos.webinos.discovery.findServices(new webinos.ServiceType('http://webinos.org/api/test'),
            {onFound:function (service) {
                expect(service.api).toEqual('http://webinos.org/api/test');
                expect(service.displayName).toEqual('Test');
                expect(service._testAttr).toEqual('HelloWorld');
                // POLICY: Check WRT POLICY
                service.bindService({onBind:function (service1) {
                    expect(service1.id).toEqual(service.id),
                        expect(service1.api).toEqual(service.api),
                        expect(service1.displayName).toEqual(service.displayName);
                    expect(typeof service1.get42).toEqual("function");
                    expect(typeof service1.listenerFor42).toEqual("function");
                }});
                service.get42('foo', function (result) {
                    expect(result).toEqual("21 foo");
                    service.listenerFor42(function (result) {
                        expect(result).toEqual({ msg: '42' });
                        done();
                       }, {opts:"unused"});
                });
            }
        });
    });
});

describe("PZH - PZP connectivity, enrollment, and findService at PZH", function(){
    var pzhConnection, user;
    it("PZH farm status", function(done){
        var status = false;
        wUtil.webinosHostname.getHostName("", function (address) {
            pzhAddress= address;
            var socket = require("net").createConnection(pzpInstance.getWebinosPorts().provider,  address); //Check if we are online..
            socket.on('connect', function() {
                status = true;
                socket.end();
                expect(status).toBeTruthy();
                done();
            });
        });
    });
    it("Enroll pzp at the PZH", function(done){
        // Makes a TLS connection towards PZH similar to PZH webServer
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
                   pzhConnection = require("tls").connect(pzpInstance.getWebinosPorts().provider,pzhAddress, pzhWebCertificates,
                   function () {
                      expect(pzhConnection.authorized).toEqual(true);
                      console.log("*********************** Creating PZH **********************");
                       user = {
                        emails: [{value:"hello@webinos.org"}],
                        displayName: "Hello",
                        from: "google"
                      };
                      var msg = {user: user, message: {type: "addPzh"}};
                      pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify(msg)));
                   });
                   pzhConnection.on("data", function (_buffer) {
                       wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                          if(obj.payload && obj.payload.type && obj.payload.type === "addPzh") {
                              var msg = {user: user,
                                message: {type:"csrAuthCodeByPzp",
                                from:pzpInstance.getDeviceName(),
                                csr:pzpInstance.getCertificateToBeSignedByPzh(),
                                friendlyName: pzpInstance.getFriendlyName()}};
                               pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify(msg)));
                          } else if (obj.payload && obj.payload.message && obj.payload.message.payload && obj.payload.message.payload.status === "signedCertByPzh"){
                              expect(obj.user.emails[0].value).toEqual("hello@webinos.org");
                              expect(obj.user.displayName).toEqual("Hello");
                              expect(obj.payload.type).toEqual("csrAuthCodeByPzp");
                              expect(obj.payload.message.from).toEqual(pzhAddress+":"+pzpInstance.getWebinosPorts().provider_webServer+"_hello@webinos.org");
                              expect(obj.payload.message.to).toEqual(pzhAddress+":"+pzpInstance.getWebinosPorts().provider_webServer+"_hello@webinos.org/D"+pzpInstance.getDeviceName());
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
                              done();
                          }
                       });
                   });
              }
           }
        }
    },1000);
    it("Connect to the PZH", function(done) {
        pzpInstance.connectHub();
        pzpInstance.on("HUB_CONNECTED", function(){
            done();
        });
    });
    it("Find service at the PZH", function(done){
        //delete require.cache[require.resolve('./webinos.js')]; // To load webinos.js for second PZP, but how do we sent port information??
        // For time being lets use first PZP to find second PZP...
        webinos.webinos.discovery.findServices(new webinos.ServiceType('http://webinos.org/api/test'),
            {onFound:function (service) {
                expect(service.api).toEqual('http://webinos.org/api/test');
                expect(service.displayName).toEqual('Test');
                expect(service._testAttr).toEqual('HelloWorld');
                if(service.serviceAddress === "Hello_google") { // A check to trigger search at the PZH
                  service.bindService({onBind:function (service1) {
                      expect(service1.id).toEqual(service.id),
                          expect(service1.api).toEqual(service.api),
                          expect(service1.displayName).toEqual(service.displayName);
                      expect(typeof service1.get42).toEqual("function");
                      expect(typeof service1.listenerFor42).toEqual("function");
                  }});
                  service.get42('foo', function (result) {
                      expect(result).toContain("foo");
                      service.listenerFor42(function (result) {
                      expect(result).toEqual({ msg: '42' });
                          pzhConnection.socket.end();   // Close socket connection
                          done();
                      }, {opts:"unused"});
                  });
                }
            }
        });
    }, 1000);
    // POLICY: Check at PZP by searching for service that is not allowed
});

describe("Create "+numberOfPZP+" PZP and Enroll with the Same PZH ", function(){
   it("Create "+numberOfPZP+" PZPs", function(done){
       createPzpEnroll(0);
       function createPzpEnroll(i) {
           var pzpInstance;
           var inputConfig = {
               "friendlyName":"Linux Device #"+i,
               "forcedDeviceName":"machine_"+i
           };
           pzp_api.setInputConfig(inputConfig);
           pzpInstance= pzp_api.getInstance();
           pzpInstance.on("PZP_STARTED",function(){
               console.log("***********************Started "+i+" PZP - "+inputConfig.friendlyName+"**********************");
               // We could use same pzhConnection as above but the event data needs to be handled
               var pzhConnection = require("tls").connect(pzpInstance.getWebinosPorts().provider,pzhAddress, pzhWebCertificates,
                   function() {
                       expect(pzhConnection.authorized).toEqual(true);
                       var user = {
                           emails: [{value:"hello@webinos.org"}],
                           displayName: "Hello",
                           from: "google"
                       };
                       var msg = {user: user,
                           message: {type:"csrAuthCodeByPzp",
                               from:pzpInstance.getDeviceName(),
                               csr:pzpInstance.getCertificateToBeSignedByPzh(),
                               friendlyName: pzpInstance.getFriendlyName()}};
                       pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify(msg)));
               });
               pzhConnection.on("data", function (_buffer) {
                   setTimeout(function(){
                       wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                           if (obj&& obj.payload && obj.payload.message && obj.payload.message.payload && obj.payload.message.payload.status === "signedCertByPzh"){
                               expect(obj.payload.message.from).toEqual(pzhAddress+":"+pzpInstance.getWebinosPorts().provider_webServer+"_hello@webinos.org");
                               expect(obj.payload.message.to).toEqual(pzhAddress+":"+pzpInstance.getWebinosPorts().provider_webServer+"_hello@webinos.org/D"+pzpInstance.getDeviceName());
                               expect(obj.payload.message.payload.status).toEqual("signedCertByPzh");
                               expect(obj.payload.message.payload.message.clientCert).toContain(CERT_START);
                               expect(obj.payload.message.payload.message.masterCert).toContain(CERT_START);
                               expect(obj.payload.message.payload.message.masterCrl).toContain(CRL_START);
                               pzpInstance.pzpEnrollment(obj.payload.message.from, obj.payload.message.to, obj.payload.message.payload.message);
                               pzpInstance.connectHub();
                               pzpInstance.on("HUB_CONNECTED", function(){
                                   var addressLookService ="Hello_google Linux Device #"+(i === 0? 0 : (i - 1)); // Find Service at other PZP
                                   webinos.webinos.discovery.findServices(new webinos.ServiceType('http://webinos.org/api/test'),
                                   {onFound:function (service) {
                                       expect(service.api).toEqual('http://webinos.org/api/test');
                                       expect(service.displayName).toEqual('Test');
                                       expect(service._testAttr).toEqual('HelloWorld');
                                       if(service.serviceAddress ===addressLookService) {// Find at one address above.
                                           service.bindService({onBind:function (service1) {
                                               expect(service1.id).toEqual(service.id),
                                               expect(service1.api).toEqual(service.api),
                                               expect(service1.displayName).toEqual(service.displayName);
                                               expect(typeof service1.get42).toEqual("function");
                                               expect(typeof service1.listenerFor42).toEqual("function");
                                           }});
                                           service.get42('foo', function (result) {
                                               expect(result).toEqual("21 foo");
                                               service.listenerFor42(function (result) {
                                                   expect(result).toEqual({ msg: '42' });
                                                   pzhConnection.socket.end();// Close socket connection
                                                   if (i !== numberOfPZP) createPzpEnroll(i + 1);
                                                   else done();
                                               }, {opts:"unused"});
                                           });
                                       }
                                   }});
                               });
                           }
                       });
                   },50); // Small timeout as sync takes time to update PZP
               });
           });
       }
   }, numberOfPZP*1000); // 1000 ms for each PZP to search service from the connected PZH...
});

describe("Create PZH and do certificate exchange between them", function() {
    it("Multiple PZH", function(done) {
        var i = 0, msg, user;
        var pzhConnection = require("tls").connect(pzpInstance.getWebinosPorts().provider,pzhAddress, pzhWebCertificates,
        function() {
            function createPzh(i) {
                var user = {
                    emails: [{value:"hello"+i+"@webinos.org"}],
                    displayName: "Hello#"+i,
                    from: "google"
                };
                msg = {user: user, message: {type: "addPzh"}};
                console.log("*********************** Creating PZH "+user.displayName +" **********************");
                pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify(msg)));
                pzhConnection.on("data", function (_buffer) {
                    wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                        if(obj.payload && obj.payload.type && obj.payload.type === "addPzh") {
                            // Certificate Exchange
                            var msg = {user: user,
                                message: {type:"getCertificates",
                                    from: obj.to,
                                    csr:pzpInstance.getCertificateToBeSignedByPzh(),
                                    friendlyName: pzpInstance.getFriendlyName()}};
                            break;
                            pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify(msg)));
                            if (i === numberOfPZH) done();
                            else createPzh(i+1);
                        }
                    });
                });
            }
            createPzh(0);
        });
    });
});
