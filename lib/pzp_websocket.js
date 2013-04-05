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
 * AUTHOR: Habib Virji (habib.virji@samsung.com)
 *         Ziran Sun (ziran.sun@samsung.com)
 *******************************************************************************/

var PzpHub = require("./pzp_connectPzh.js");

function PzpWebSocketServer(){
    "use strict";
    PzpHub.call(this);
    var PzpCommon = require("./pzp.js");
    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var connectedWebApp = {}; // List of connected apps i.e session with browser
    var PzpObject = this;
    var expectedPzhAddress;
    var wrtServer;
    var peerCert = new PzpCommon.certExchange(PzpObject);
    if (process.platform == "android") {
        try {
            wrtServer = require ("bridge").load ("org.webinos.app.wrt.channel.WebinosSocketServerImpl", exports);
        } catch (e) {
            logger.error ("exception attempting to open wrt server " + e);
        }
    }
    /**
     *
     * @param to
     * @param status
     * @param message
     * @return {Object}
     */
    function prepMsg(to, status, message) {
        return {
            "type": "prop",
            "from": PzpObject.getSessionId(),
            "to": to,
            "payload": {
                "status": status,
                "message": message
            }
        };
    }

    /**
     *
     * @param from
     */
    function getVersion (from) {
        var msg;
        if (PzpObject.getWebinosVersion()) {
            msg = prepMsg (from, "webinosVersion", PzpObject.getWebinosVersion());
        } else {
            var packageValue = require("../package.json")
            msg = prepMsg (from, "webinosVersion", packageValue.version);
        }
        PzpObject.sendConnectedApp(from, msg);
    }

    /**
     *
     * @param type
     * @return {Array}
     */
    function getConnectedList(type) {
        var list = [], key, connectedDevice = {},  externalConnected = {};
        connectedDevice =  (type === "Pzp") ?  PzpObject.getConnectedPzp(): PzpObject.getConnectedPzh();
        externalConnected = (type === "Pzp")? PzpObject.getPzhConnectedDevices().pzp: PzpObject.getPzhConnectedDevices().pzh;
        for (key in connectedDevice) {
            if(connectedDevice.hasOwnProperty(key)) {
                list.push(connectedDevice[key].friendlyName || key);
            }
        }
        for (key in externalConnected) {
            if(externalConnected.hasOwnProperty(key)) {
                list.push(externalConnected[key] || key);
            }
        }
        if (type === "Pzp") list.push(PzpObject.getFriendlyName());
        return list;
    }

    function getWebinosLog (type, from) {
        logger.fetchLog (type, "Pzp", PzpObject.getDeviceName(), function (data) {
            var msg = prepMsg (from, type + "Log", data);
            PzpObject.sendConnectedApp(from, msg);
        });
    }

    function setInternalParams(id) {
        var to;
        if(id === PzpObject.getSessionId()) {
            id = PzpObject.getFriendlyName(); // Special case of findServices
        } else if (PzpObject.getConnectedPzp().hasOwnProperty(id) && PzpObject.getConnectedPzp()[id].friendlyName) {
            id = PzpObject.getConnectedPzp()[id].friendlyName;
        } else if (PzpObject.getConnectedPzh().hasOwnProperty(id) && PzpObject.getConnectedPzh()[id].friendlyName) {
            id = PzpObject.getConnectedPzh()[id].friendlyName;
        } else if (connectedWebApp[id]) {
            to = (id.split("/") && id.split("/").length === 2) ? id.split("/")[1] : id.split("/")[2];
            id = PzpObject.getFriendlyName() + "/"+ to;
        } else if(PzpObject.getPzhConnectedDevices().pzp[id]) {
            id = PzpObject.getPzhConnectedDevices().pzp[id];
        } else if(PzpObject.getPzhConnectedDevices().pzh[id]) {
            id = PzpObject.getPzhConnectedDevices().pzh[id];
        }
        return id;
    }

    function getConfigData(from){
        var configData, accData = [];
        PzpCommon.mandatoryModule.forEach(function(name){
            if(PzpCommon.path.resolve(require.resolve(name),"config.json")) {
                configData = require(PzpCommon.path.join(require.resolve(name), "config.json"))
                accData.push({name:name, config: configData});
            }
        });
        PzpObject.sendConnectedApp(from, accData);
    }

    function setOriginalId(id) {
        if (id) {
            var matchId= id.split("/") && id.split("/")[0], key, i;
            if(matchId === PzpObject.getFriendlyName()) {
                id = (id.split('/').length > 1) ? (PzpObject.getSessionId() +"/"+ id.split('/')[1]) : PzpObject.getSessionId();
            } else {
                for (key in PzpObject.getConnectedPzp()) {
                    if (PzpObject.getConnectedPzp().hasOwnProperty(key) &&
                        PzpObject.getConnectedPzp()[key].friendlyName === matchId) {
                        id = key;
                        break;
                    }
                }
                for (key in PzpObject.getConnectedPzh()) {
                    if (PzpObject.getConnectedPzh().hasOwnProperty(key) &&
                        PzpObject.getConnectedPzh()[key].friendlyName === matchId) {
                        id = key;
                        break;
                    }
                }
                for (key in PzpObject.getPzhConnectedDevices().pzp) {
                    if (PzpObject.getPzhConnectedDevices().pzp.hasOwnProperty(key) &&
                        PzpObject.getPzhConnectedDevices().pzp[key] === matchId) {
                        id = key;
                        break;
                    }
                }
                for (key in PzpObject.getPzhConnectedDevices().pzh) {
                    if (PzpObject.getPzhConnectedDevices().pzh.hasOwnProperty(key) &&
                        PzpObject.getPzhConnectedDevices().pzh[key] === matchId) {
                        id = key;
                        break;
                    }
                }
            }
        }
        return id;
    }

    function wsMessage (connection, origin, utf8Data) {
        //schema validation
        var key, msg = JSON.parse (utf8Data), invalidSchemaCheck = true;
        if (msg && msg.payload && msg.payload.status === "registerBrowser") {
            // skip schema check as this is first message
        } else {
            try {
                invalidSchemaCheck = PzpCommon.wUtil.webinosSchema.checkSchema (msg);
            } catch (err) {
                logger.error (err);
            }
            if (invalidSchemaCheck) {
                // For debug purposes, we only print a message about unrecognized packet,
                // in the final version we should throw an error.
                // Currently there is no a formal list of allowed packages and throw errors
                // would prevent the PZP from working
                logger.error ("msg schema is not valid " + JSON.stringify (msg));
            }
        }
        msg.to = setOriginalId(msg.to);
        msg.from = setOriginalId(msg.from);
        msg.resp_to = setOriginalId(msg.resp_to);

        if (msg.type === "prop") {
            switch (msg.payload.status) {
                case "registerBrowser":
                    PzpObject.connectedApp(connection, msg.payload.value);
                    break;
                case "setFriendlyName":
                    //PzpObject.changeFriendlyName(msg.payload.value);
                    // THis functionality will be added via webinos core api.
                    break;
                case "getFriendlyName":
                    var msg1 = prepMsg(msg.from, "friendlyName", PzpObject.getFriendlyName());
                    PzpObject.sendConnectedApp (msg.from, msg1);
                    break;
                case "infoLog":
                    getWebinosLog("info", msg.from);
                    break;
                case "errorLog":
                    getWebinosLog("error", msg.from);
                    break;
                case "webinosVersion":
                    getVersion(msg.from);
                    break;
                case "authCodeByPzh":
                    if (expectedPzhAddress === msg.payload.providerDetails) {
                        connection.sendUTF (JSON.stringify ({"from":PzpObject.getDeviceName(),
                            "payload":{"status":"csrAuthCodeByPzp", "csr":PzpObject.getCertificateToBeSignedByPzh(), "authCode":msg.payload.authCode}}));
                    }
                    break;
                case "signedCertByPzh":
                    if (expectedPzhAddress === (msg.from && msg.from.split("_") && msg.from.split("_")[0])) {
                        PzpObject.registerDevice (msg.from, msg.to, msg.payload.message);
                    }
                    break;
                case "setPzhProviderAddress":
                    expectedPzhAddress = msg.payload.message;
                    break;
                case "pzpFindPeers":
                    PzpObject.sendPzpPeersToApp();
                    break;
                case "showHashQR":
                    PzpObject.getHashQR(function(value){
                        var msg2 = prepMsg(msg.from, "showHashQR", value);
                        PzpObject.sendtoClient(msg2);
                    });
                    break;
                case "checkHashQR":
                    //get payload message.hash
                    var hash = msg.payload.message.hash;
                    logger.log("hash passed from client page is: " + hash);
                    PzpObject.checkHashQR(hash, function(value){
                        var msg6 = prepMsg(msg.from, "checkHashQR", value);
                        PzpObject.sendtoClient(msg6);
                    });
                    break;
                case "requestRemoteScanner":
                    PzpObject.requestRemoteScanner(PzpObject.getConnectPeerAddress());
                    break;
                case "pubCert":
                    PzpObject.exchangeCert(msg, function(value){
                        logger.log("pubCert exchanged: " + value);
                    });
                    break;
                case "pzhCert":
                    PzpObject.exchangeCert(msg, function(value){
                        logger.log("pzhCert Value:" + value);
                    });
                    break;
                case "intraPeer":
                    PzpObject.connectintra(msg, function(value){
                        logger.log("connect intra-zone peer: " + value);
                    });
                    break;
                case "resetDevice":
                    PzpObject.unRegisterDevice();
                    break;
                case "getConfigData":
                    getConfigData(msg.from);
                    break;
            }
        } else {
            PzpObject.processMsg (msg, msg.to);
        }
    }

    function wsClose (connection, reason) {
        if (connectedWebApp[connection.id]) {
            delete connectedWebApp[connection.id];
            PzpObject.messageHandler.removeRoute (connection.id, PzpObject.getSessionId());
            logger.log ("web client disconnected: " + connection.id + " due to " + reason);
        }
    }

    function handleRequest (uri, req, res) {
        /**
         * Expose the current communication channel websocket port using this virtual file.
         * This code must have the same result with the widgetServer.js used by wrt
         * webinos\common\manager\widget_manager\lib\ui\widgetServer.js
         */
        if (uri == "/webinosConfig.json") {
            var jsonReply =
            res.writeHead (200, {"Content-Type":"application/json"});
            res.write (JSON.stringify ({websocketPort:PzpObject.getPorts().pzp_webSocket}));
            res.end();
            return;
        }
        var documentRoot = PzpCommon.path.join (__dirname, "../web_root/");
        var filename = PzpCommon.path.join (documentRoot, uri);
        // If we detect that user has not configured PZP, redirect towards the page.
        if(PzpObject.getPzpConfigurationStatus()) {
            PzpCommon.wUtil.webinosContent.sendFile(res, documentRoot, PzpCommon.path.join(documentRoot,"config.html"), "index.html");
        } else {
            PzpCommon.wUtil.webinosContent.sendFile(res, documentRoot, filename, "index.html");
        }
    }

    function startHttpServer(callback) {
        var httpserver = PzpCommon.http.createServer(function (request, response) {
            var parsed = PzpCommon.url.parse(request.url, true);
            var tmp = "";

            request.on('data', function(data){
                tmp = tmp + data;
            });
            request.on("end", function(data){
                if (parsed.query){
                    peerCert.handleMsg(parsed);
                }
            });
            handleRequest(parsed.pathname, request, response);
        });

        httpserver.on ("error", function (err) {
            if (err.code === "EADDRINUSE") {
                PzpObject.getPorts().pzp_webSocket = parseInt(PzpObject.getPorts().pzp_webSocket, 10) + 1;
                logger.error ("address in use, now trying port " + PzpObject.getPorts().pzp_webSocket);
                httpserver.listen(PzpObject.getPorts().pzp_webSocket);
                PzpObject.emit("WSS_Started");
            } else {
                return callback (false, err);
            }
        });

        httpserver.on ("listening", function () {
            logger.log("httpServer listening at port " + PzpObject.getPorts().pzp_webSocket + " and hostname localhost");
            PzpObject.emit("WSS_Started");
            return callback (true, httpserver);
        });
        httpserver.listen (PzpObject.getPorts().pzp_webSocket, "0.0.0.0");
    }

    function startAndroidWRT () {
        if (wrtServer) {
            wrtServer.listener = function (connection) {
                logger.log ("connection accepted and adding proxy connection methods.");
                connection.socket = {
                    pause :function () {},
                    resume:function () {}
                };
                connection.sendUTF = connection.send;

                PzpObject.connectedApp(connection);

                connection.listener = {
                    onMessage:function (ev) {
                        wsMessage (connection, "android", ev.data);
                    },
                    onClose  :function () {
                        wsClose (connection);
                    },
                    onError  :function (reason) {
                        logger.error (reason);
                    }
                };
            };
        }
    }


    this.connectedApp = function(connection, webAppName) {
        var appId, tmp, payload, key, msg, msg2;
        if (connection) {
            if (!webAppName) webAppName = require("crypto").randomBytes(3).toString("hex").toUpperCase();
            var sessionWebApp = require("crypto").createHash("md5").update(PzpObject.getSessionId() + webAppName).digest("hex");
            appId = PzpObject.getSessionId()  + "/"+ sessionWebApp +"/" + Math.random();
            connectedWebApp[appId] = connection;
            connection.id = appId; // this appId helps in while deleting socket connection has ended

            payload = { "pzhId":(PzpObject.getPzhId() && PzpObject.getConnectedPzh().hasOwnProperty(PzpObject.getPzhId()) &&
                                 PzpObject.getConnectedPzh()[PzpObject.getPzhId()].friendlyName)|| "",
                "connectedPzp" :getConnectedList("Pzp"),
                "connectedPzh" :getConnectedList("Pzh"),
                "state"        :PzpObject.getState(),
                "enrolled"     :PzpObject.getEnrolledStatus()};
            msg = prepMsg(appId, "registeredBrowser", payload);
            PzpObject.sendConnectedApp(appId, msg);

            if(Object.keys(connectedWebApp).length == 1 ) {
                getVersion(appId);
            }
        } else {
            for (key in connectedWebApp) {
                if (connectedWebApp.hasOwnProperty (key)) {
                    tmp = connectedWebApp[key];
                    payload = { "pzhId":PzpObject.getPzhId() || "",
                        "connectedPzp" :getConnectedList("Pzp"),
                        "connectedPzh" :getConnectedList("Pzh"),
                        "state"        :PzpObject.getState(),
                        "enrolled"     :PzpObject.getEnrolledStatus()};
                    msg = prepMsg(key, "update", payload);
                    PzpObject.sendConnectedApp(key, msg);
                }
            }
        }
    };

    this.startWebSocketServer = function() {
        startHttpServer (function (status, value) {
            if (status) {
                if (wrtServer) {
                    startAndroidWRT ();
                }

                var wsServer = new PzpCommon.WebSocketServer ({
                    httpServer           :value,
                    autoAcceptConnections:false
                });
                logger.addId (PzpObject.getDeviceName());
                wsServer.on ("request", function (request) {
                    logger.log ("Request for a websocket, origin: " + request.origin + ", host: " + request.host);
                    if (request.host && request.host.split (":") &&
                        (request.host.split(":")[0] === "localhost" || request.host.split(":")[0] === "127.0.0.1")) {
                        var connection = request.accept ();
                        logger.log ("Request accepted");
                        //_PzpObject.pzpWebSocket.connectedApp(connection);
                        connection.on ("message", function (message) { wsMessage (connection, request.origin, message.utf8Data); });
                        connection.on ("close", function (reason, description) { wsClose (connection, description) });
                    } else {
                        logger.error ("Failed to accept websocket connection: " + "wrong host or origin");
                    }
                });
            }
        });
    };


    this.sendConnectedApp = function (address, message) {
        if (address && message) {
            if (connectedWebApp.hasOwnProperty (address)) {
                message.from = setInternalParams(message.from);
                message.resp_to = setInternalParams(message.resp_to);
                message.to = setInternalParams(message.to);

                if(message.payload && message.payload.method && message.payload.method.indexOf("servicefound") > -1) {
                    message.payload.params.serviceAddress = setInternalParams(message.payload.params.serviceAddress);
                }

                try {
                    var jsonString = JSON.stringify(message);
                    connectedWebApp[address].socket.pause ();
                    connectedWebApp[address].sendUTF(jsonString);
                } catch (err) {
                    logger.error ("exception in sending message to pzp - " + err);
                } finally {
                    logger.log ('send to web app - ' + address + ' message ' + jsonString);
                    connectedWebApp[address].socket.resume ();
                }
            } else {
                logger.error ("unknown destination " + address);
            }
        } else {
            logger.error ("message or address is missing");
        }
    };

    this.pzhDisconnected = function () {
        var key;
        for (key in connectedWebApp) {
            if (connectedWebApp.hasOwnProperty (key)) {
                var msg = prepMsg (key, "pzhDisconnected", "pzh disconnected");
                PzpObject.sendConnectedApp (key, msg);
            }
        }
    };
    /**
     *
     */
    this.startWSS = function() {
        startWebSocketServer();
    };
}

require("util").inherits(PzpWebSocketServer, PzpHub);
module.exports = PzpWebSocketServer;
