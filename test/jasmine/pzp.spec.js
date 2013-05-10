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

var pzpInstance, files;
var started = false;

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

describe("PZP input configuration and check webinos PZP exposed API", function(){
    it ("check input config", function(done) {
        pzp_api.setInputConfig({});
        pzpInstance = pzp_api.getInstance();
        pzpInstance.on("PZP_STARTED",function(){
            console.log("pzp started event received");
            started = true;
            done();
        });
        expect(pzpInstance).not.toBeNull();
    });
    it ("check sessionId does it match device name in virgin mode", function() {
        expect(pzp_api.getSessionId()).not.toBeNull();
        expect(pzpInstance.getSessionId()).not.toBeNull();
        expect(pzp_api.getSessionId()).toEqual(pzpInstance.getSessionId());
        expect(pzp_api.getSessionId()).toEqual(os.hostname());
    });
    it ("check webinos device name and session id are equal in virgin mode", function() {
        expect(pzp_api.getDeviceName()).not.toBeNull();
        expect(pzpInstance.getDeviceName()).not.toBeNull();
        expect(pzp_api.getDeviceName()).toEqual(pzpInstance.getSessionId());// in virgin mode they should be equal
        expect(pzp_api.getDeviceName()).toEqual(pzpInstance.getDeviceName());
        expect(pzp_api.getDeviceName()).toEqual(os.hostname());
    });
    it ("check default ports are set", function() {
        expect(pzp_api.getWebinosPorts()).not.toBeNull();
        expect(pzpInstance.getWebinosPorts()).not.toBeNull();
        expect(pzp_api.getWebinosPorts()).toEqual(pzpInstance.getWebinosPorts());
        expect(pzp_api.getWebinosPorts()).toEqual(require("../../config.json").ports);
    });
});

describe("check pzp default configuration in virgin mode", function(){
    it ("check default directories and files are created", function() {
        files.forEach(function(folderName){
            expect(fs.existsSync(folderName)).toBeTruthy();
        });
    });
    it ("check webinos metadata is set", function() {
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
    it ("check service cache i.e. services are loaded", function() {
        var serviceCache = JSON.parse(fs.readFileSync(path.join(webinosPath,"userData","serviceCache.json")).toString());
        expect(serviceCache).not.toBeNull();
        expect(pzpInstance.getServiceCache()).not.toBeNull();
        expect(serviceCache).toEqual(pzpInstance.getServiceCache());

    });
    it ("check default userData i.e. details that will be used by certificate is set", function() {
        var userData = JSON.parse(fs.readFileSync(path.join(webinosPath,"userData","userDetails.json")).toString());
        expect(userData).not.toBeNull();
        expect(pzpInstance.getUserData()).not.toBeNull();
        expect(userData).toEqual(pzpInstance.getUserData());
    });
    it ("check ports configuration", function() {
        var userPref = JSON.parse(fs.readFileSync(path.join(webinosPath,"userData","userPref.json")).toString());
        expect(userPref).not.toBeNull();
        expect(pzpInstance.getWebinosPorts()).not.toBeNull();
        expect(JSON.stringify(userPref.ports)).toEqual(JSON.stringify(pzpInstance.getWebinosPorts()));
    });
});

describe("check master and connection certificates/privateKey", function() {
    var certificates, crl, keyList;

    it("check private keys", function(){
        keyList      = fs.readdirSync(path.join(webinosPath,"keys"));
        keyList.forEach(function(name){
            var key = fs.readFileSync(path.join(webinosPath,"keys", name)).toString();
            expect(key).not.toBeNull();
            expect(key).toContain(RSA_START);
            expect(key).toContain(RSA_END);
        });
    });

    it("certificate web and pzh should be empty in virgin mode", function() {
        certificates = JSON.parse(fs.readFileSync(path.join(webinosPath,"certificates","internal","certificates.json")).toString());
        crl          = JSON.parse(fs.readFileSync(path.join(webinosPath,"crl.json")).toString());
        expect(certificates).not.toBeNull();
        expect(certificates.web).toEqual({});
        expect(certificates.pzh).toEqual({});
    });

    it("check master certificate data", function(){
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

    it("check connection certificate data", function(){
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

    it("check crl", function(){
        expect(crl).not.toBeNull();
        expect(crl.value).toContain(CRL_START);
        expect(crl.value).toContain(CRL_END);
        expect(pzpInstance.getCRL()).not.toBeNull();
        expect(crl.value).toEqual(pzpInstance.getCRL());
    });
});

describe("check if pzp webSocket server is started", function(){
    it ("check webSocket server status", function () {
        expect(started).toBeTruthy();
    });
    it ("check if http server is up and running", function (done) {
        require("http").get("http://localhost:"+pzpInstance.getWebinosPorts().pzp_webSocket, function(res){
            expect(res.statusCode).toEqual(200);
            done();
        });
    });
});

describe("check webSocket localhost connection", function () {
    var webinos;
    it("websocket client connection", function(done){
        webinos = require("./webinos.js");
        done();
    });
    it("check register message", function(done){
        webinos.webinos.session.addListener ('registeredBrowser', function(parseData){
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
        });
    });
    it("check webinos version message", function(done){
        webinos.webinos.session.addListener ('webinosVersion', function(parseData){
            expect(parseData.type).toEqual("prop");
            expect(parseData.from).toEqual(pzpInstance.getFriendlyName());
            expect(parseData.to).not.toBeNull();
            expect(parseData.payload.status).toEqual("webinosVersion");
            expect(parseData.payload.message).not.toBeNull();
            expect(parseData.payload.message.tag).not.toBeNull();
            expect(parseData.payload.message.num_commit).not.toBeNull();
            expect(parseData.payload.message.commit_id).not.toBeNull();
            done();
        });
    });

    it("websocket find service", function(done){
        setTimeout(function(){
            webinos.webinos.discovery.findServices(new webinos.ServiceType('http://webinos.org/api/test'),
                {onFound:function (service) {
                    expect(service.api).toEqual('http://webinos.org/api/test');
                    expect(service.displayName).toEqual('Test');
                    expect(service._testAttr).toEqual('HelloWorld');
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
        },500);
    });
});

describe("check other managers are started up", function(){
    it ("check RPC", function () {});
    it ("check messaging", function () { });
    it ("load modules", function () { });
    it ("check policy manager", function () {});
    it ("check synchronization manager", function () {});
    it ("check TLS server is communicable", function () {});
});

describe("PZH - PZP connectivity", function(){
    var wUtil = require("webinos-utilities");
    var pzhAddress;
    it("check if PZH farm is up and running", function(done){
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
    it("enroll pzp at the PZH", function(done){
        var certificateHandler = require("webinos-certificateHandler");
        // Makes a TLS connection similar to PZH webServer
        var inputConfig = {
            "friendlyName": "",
            "sessionIdentity": pzhAddress
        };
        var config = new wUtil.webinosConfiguration("PzhP", inputConfig);
        config.cert = new certificateHandler(config.metaData);
        var webOptions;
        if(config.loadWebinosConfiguration() && config.loadCertificates(config.cert)){
            if((csr=config.cert.generateSelfSignedCertificate("PzhWS", "PzhWS"))) {
              if((clientCert= config.cert.generateSignedCertificate(csr))) {
                  config.cert.internal["webclient"].cert = clientCert;
                  webOptions =   {
                      key:  config.cert.keyStore.fetchKey(config.cert.internal.webclient.key_id),
                      cert: config.cert.internal.webclient.cert,
                      ca:   config.cert.internal.master.cert,
                      requestCert: true,
                      rejectUnauthorized: true
                  };
                   var connection = require("tls").connect(pzpInstance.getWebinosPorts().provider,pzhAddress, webOptions,
                   function () {
                      expect(connection.authorized).toEqual(true);
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
                      connection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify(msg)));
                   });
                   connection.on("data", function (_buffer) {
                       wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                          expect(obj.user.emails[0].value).toEqual("hello@webinos.org");
                          expect(obj.user.displayName).toEqual("Hello");
                          expect(obj.payload.type).toEqual("csrAuthCodeByPzp");
                          expect(obj.payload.message.from).toEqual(pzhAddress+":"+pzpInstance.getWebinosPorts().provider_webServer+"_hello@webinos.org");
                          expect(obj.payload.message.to).toEqual(pzhAddress+":"+pzpInstance.getWebinosPorts().provider_webServer+"_hello@webinos.org/"+pzpInstance.getDeviceName());
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
                          pzpInstance.registerDevice(obj.payload.message.from, obj.payload.message.to, obj.payload.message.payload.message);
                          // This triggers connection towards PZH...
                          done();
                       });
                   });
              }
           }
        }
    },10000);
    it("connect to the PZH", function(done) {
        pzpInstance.connectHub();
        done();
    });
    it("find service after device is enrolled", function(done){
      // Wait for receiving message from the PZP
       pzpInstance.on("HUB_CONNECTED", function(){
          done();
        });
    });
    it("find service after device is enrolled", function(done){
        var webinos = require("./webinos.js");
        setTimeout(function() {
            webinos.webinos.discovery.findServices(new webinos.ServiceType('http://webinos.org/api/test'),
                {onFound:function (service) {
                    expect(service.api).toEqual('http://webinos.org/api/test');
                    expect(service.displayName).toEqual('Test');
                    expect(service._testAttr).toEqual('HelloWorld');
                    if(service.serviceAddress === "Hello_google") {
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
                }
            });
        }, 1000);
    });
});



