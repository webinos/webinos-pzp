var pzp_api = require("../../lib/pzp_sessionHandling.js");
var fs = require("fs");
var os = require("os");
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
var path = require("path");
var webinosPath = require("webinos-utilities").webinosPath.webinosPath();
var webSocketClient = require('websocket').client

var pzpInstance, files;
var started = false;
describe("PZP cleanup", function() {
    it("delete directories", function(){
        // Cleanup webinos directories.
        files = [path.join(webinosPath,"keys"),
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
        files.forEach(function(folderName) {
            if(fs.existsSync(folderName)){
                var stat = fs.statSync(folderName);
                if (stat.isDirectory()){
                    var fileList = fs.readdirSync(folderName);
                    fileList.forEach(function(fileName){
                        console.log("deleting - "+fileName);
                        fs.unlinkSync(path.join(folderName, fileName));
                    });
                    console.log("deleting - "+folderName);
                    fs.rmdirSync(folderName);
                } else {
                    console.log("deleting - "+folderName);
                    fs.unlinkSync(folderName);
                }
            }
        });
    });
});

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
    it ("check sessionId", function() {
        expect(pzp_api.getSessionId()).not.toBeNull();
        expect(pzpInstance.getSessionId()).not.toBeNull();
        expect(pzp_api.getSessionId()).toEqual(pzpInstance.getSessionId());
        expect(pzp_api.getSessionId()).toEqual(os.hostname());
    });
    it ("check webinos path", function() {
        expect(pzp_api.getDeviceName()).not.toBeNull();
        expect(pzpInstance.getDeviceName()).not.toBeNull();
        expect(pzp_api.getDeviceName()).toEqual(pzpInstance.getSessionId());// in virgin mode they should be equal
        expect(pzp_api.getDeviceName()).toEqual(pzpInstance.getDeviceName());
        expect(pzp_api.getDeviceName()).toEqual(os.hostname());
    });
    it ("check default ports", function() {
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
    it ("check metadata", function() {
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
    it ("check service cache", function() {
        var serviceCache = JSON.parse(fs.readFileSync(path.join(webinosPath,"userData","serviceCache.json")).toString());
        expect(serviceCache).not.toBeNull();
        expect(pzpInstance.getServiceCache()).not.toBeNull();
        expect(serviceCache).toEqual(pzpInstance.getServiceCache());

    });
    it ("check userData", function() {
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
    var RSA_START       = "-----BEGIN RSA PRIVATE KEY-----";
    var RSA_END         = "-----END RSA PRIVATE KEY-----";
    var CERT_REQ_START  = "-----BEGIN CERTIFICATE REQUEST-----";
    var CERT_REQ_END    = "-----END CERTIFICATE REQUEST-----";
    var CERT_START      = "-----BEGIN CERTIFICATE-----";
    var CERT_END        = "-----END CERTIFICATE-----";
    var CRL_START       = "-----BEGIN X509 CRL-----";
    var CRL_END         = "-----END X509 CRL-----";
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
        expect(certificates.master.key_id).toContain(keyList[0]);
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
        expect(certificates.conn.key_id).toContain(keyList[1]);
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
/*
        var client = new webSocketClient();
        client.connect("ws://localhost:8080/");
        client.on("connect", function(connection){
            describe ("check webinos messages", function () {
                connection.send(JSON.stringify({type: 'prop', payload: {status:'registerBrowser', value: __filename}}));
                connection.on('message', function(message) {
                    if (message.type === 'utf8') {
                        console.log("Received: '" + message.utf8Data + "'");
                        var parseData = JSON.parse(message.utf8Data);
                        if(parseData.payload.status === "registeredBrowser") {
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

                                var webinos = require("./webinos.js");
                                webinos.webinos.discovery.findServices(new webinos.ServiceType('http://webinos.org/api/test'),
                                    {onFound:function (service) {
                                        console.log(service);
                                        service.serviceAddress.bindService({onBind:function (service) {
                                            console.log('TEST API ' + service.api + ' bound.');
                                        }});
                                        service.serviceAddress.get42('foo', function (result) {
                                            console.log(result);
                                        },
                                        function (error) {
                                            console.log(error.code + " " + error.message);
                                        });
                                        service.serviceAddress.listenerFor42(function (result) {
                                            console.log(result.msg);
                                        }, {opts:"unused"});
                                    }});
                        } else if(parseData.payload.status === "webinosVersion") {
                                expect(parseData.type).toEqual("prop");
                                expect(parseData.from).toEqual(pzpInstance.getFriendlyName());
                                expect(parseData.to).not.toBeNull();
                                expect(parseData.payload.status).toEqual("webinosVersion");
                                expect(parseData.payload.message).not.toBeNull();
                                expect(parseData.payload.message.tag).not.toBeNull();
                                expect(parseData.payload.message.num_commit).not.toBeNull();
                                expect(parseData.payload.message.commit_id).not.toBeNull();
                                done();

                        }
                    }
                });
            });

        });
    });

    it ("websocket cleanup", function () {
       //client.close();
    });
});
/*describe("check other managers", function(){
    it ("check RPC", function () {

    });
    it ("check messaging", function () {

    });
    it ("load modules", function () {

    });
    it ("check policy manager", function () {

    });
    it ("check synchronization manager", function () {

    });
    it ("check TLS server is communicable", function () {

    });
})


describe("check reConnectivity", function(){
    it ("test get42", function (done) {

    });
});
  */

/*describe("shutdown pzp", function(){
    it("close pzp", function(){
        //process.exit();
    });
});*/
