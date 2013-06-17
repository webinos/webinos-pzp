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
function PzpWebSocketServer(){
    "use strict";
    var PzpCommon = require("./pzp.js");
    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var PzpObject = this;
    PzpObject.connectedWebApp = {}; // List of connected apps i.e session with browser
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
     * This handles HTTP request which includes file which are shown in browser
     */
    function handleHttpRequest(uri, req, res) {
        /**
         * Expose the current communication channel websocket port using this virtual file.
         * This code must have the same result with the widgetServer.js used by wrt
         * webinos\common\manager\widget_manager\lib\ui\widgetServer.js
         */
        if (uri == "/webinosConfig.json") {
            var jsonReply =
            res.writeHead (200, {"Content-Type":"application/json"});
            res.write (JSON.stringify ({websocketPort:PzpObject.getWebinosPorts("pzp_webSocket")}));
            res.end();
            return;
        } else if (uri === "/promptReply") {
            try {
                if (require.resolve("webinos-policy")) {
                    var pm_rpc = require(PzpCommon.path.join(require.resolve("webinos-policy"), "../../lib/rpcInterception.js"));
                    var policyManager = pm_rpc.getPolicyManager();
                    var params = PzpCommon.url.parse(req.url).search.split("&");
                    var token = params[0].split("=")[1];
                    var reply = params[1].split("=")[1];
                    policyManager.replyPrompt(token, parseInt(reply));
                }
            } catch(err){
                logger.error("error during prompt reply: " + err.message);
            }
            return;
        }
        var documentRoot = PzpCommon.path.join (__dirname, "../web_root/");
        var filename = PzpCommon.path.join (documentRoot, uri);
        // If we detect that user has not configured PZP, redirect towards the page.
        PzpCommon.wUtil.webinosContent.sendFile(res, documentRoot, filename, "index.html");
    }
    /**
     * Returns webinos version
     * @param from - Address to return back message
     */
    function getVersion (from) {
        if (PzpObject.getMetaData("webinosVersion")) {
            PzpObject.prepMsg (from, "webinosVersion", PzpObject.getMetaData("webinosVersion"));
        } else {
            var packageValue = require("../package.json");
            PzpObject.prepMsg (from, "webinosVersion", packageValue.version);
        }
    }
    /**
     * Helper function for getConnectedInfo
     */
    function getPzpDetails(zone, key) {
        var list = [], value, key1;
        zone.forEach(function(name){
            for(key1 in name){
                if(name.hasOwnProperty(key1) && key === key1.split("/")[0]) list.push({id: key1, friendlyName: PzpObject.getFriendlyName(key1)});
                if (key === PzpObject.getPzhId()) list.push({friendlyName: PzpObject.getFriendlyName(), id: PzpObject.getSessionId()});
            }
        });
        return list;
    }
    /**
     * Returns connected devices information
     * @return {Array}
     */
    function getConnectedInfo() {
        var list = [], store = {}, key, zonePzh, zonePzp, externalPzh, externalPzp;
        zonePzh = [PzpObject.getTrustedList("pzh"), PzpObject.getPzhConnectedDevices("pzh")];
        zonePzp = [PzpObject.getTrustedList("pzp"), PzpObject.getPzhConnectedDevices("pzp")];

        console.log(zonePzh, zonePzp)
        // Not connected to PZH
        zonePzh.forEach(function(name){
            name.forEach(function(key){
               store = {id: key, friendlyName: PzpObject.getFriendlyName(key), pzp:getPzpDetails(zonePzp, key) };
               list.push(store);
            });
        });
        if (PzpObject.getEnrolledStatus())
            list.push({id: PzpObject.getPzhId(),
                       friendlyName: PzpObject.getFriendlyName(PzpObject.getPzhId()),
                       pzp:getPzpDetails(zonePzp, PzpObject.getPzhId()) });
        if (list.length === 0) list.push({friendlyName: PzpObject.getFriendlyName(), id: PzpObject.getSessionId()});
        return list;
    }

    this.pzhDisconnected = function () {
        var key;
        for (key in PzpObject.connectedWebApp) {
            if (PzpObject.connectedWebApp.hasOwnProperty (key)) {
                var msg = prepMsg (key, "pzhDisconnected", "pzh disconnected");
                PzpObject.sendMessage (key, msg);
            }
        }
    };

    this.checkConnectedWebApp = function(from) {
        return PzpObject.connectedWebApp.hasOwnProperty(from);
    };

    this.connectedApp = function(connection, webAppName) {
        var to, key, tmp;
        if (connection) {
            to = PzpObject.setApplicationId(webAppName);
            PzpObject.connectedWebApp[to] = connection;
            connection.id = to; // this to helps in while deleting socket connection has ended
            sendApplicationItsId("registeredBrowser", to);
            if(Object.keys(PzpObject.connectedWebApp).length == 1 ) {
                getVersion(to);
            }
        } else {
            for (key in PzpObject.connectedWebApp) {
                if (PzpObject.connectedWebApp.hasOwnProperty (key)) {
                    //Special case of enrollment, length of id will be 2 and after these felow steps will be updated to 3
                    if ((key && key.split("/") && key.split("/").length === 2) &&
                        (PzpObject.getSessionId() && PzpObject.getSessionId().split("/") && PzpObject.getSessionId().split("/").length === 2)) {
                        tmp = PzpObject.connectedWebApp[key];
                        delete PzpObject.connectedWebApp[key];
                        key = PzpObject.getSessionId()+"/"+ key.split("/")[1];
                        tmp.id = key;
                        PzpObject.connectedWebApp[key] = tmp;
                    }
                    sendApplicationItsId("update", key);
                }
            }

        }
    };

    function sendApplicationItsId(msgType, to) {
        var msg, payload = { "pzhId": PzpObject.getPzhId(),
            "connectedDevices" :getConnectedInfo(),
            "state"        :PzpObject.getState(),
            "enrolled"     :PzpObject.getEnrolledStatus()};

        PzpObject.prepMsg(to, msgType, payload);
        msg = PzpObject.messageHandler.createRegisterMessage(to, PzpObject.getSessionId());
        PzpObject.messageHandler.onMessageReceived(msg, msg.to);
    }

    /**
     *  Start HTTP server, its instance is then used by the PZP WebSocket server
     */
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
            handleHttpRequest(parsed.pathname, request, response);
        });

        httpserver.on ("error", function (err) {
            if (err.code === "EADDRINUSE") {
                var pzpWebSocket = parseInt(PzpObject.getWebinosPorts("pzp_webSocket"), 10) + 1;
                logger.error ("address in use, now trying port " + pzpWebSocket);
                httpserver.listen(pzpWebSocket);
                PzpObject.updateWebinosPort("pzp_webSocket", pzpWebSocket);
            } else {
                return callback (false, err);
            }
        });

        httpserver.on ("listening", function () {
            logger.log("httpServer listening at port " + PzpObject.getWebinosPorts("pzp_webSocket") + " and hostname localhost");
            return callback (true, httpserver);
        });
        httpserver.listen (PzpObject.getWebinosPorts("pzp_webSocket"), "0.0.0.0");
    }

    /**
     *  Starts Android Widget Runtime
     */
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
                        PzpObject.wsMessage (connection, "android", ev.data);
                    },
                    onClose  :function () {
                        PzpObject.applicationCleanUp (connection);
                    },
                    onError  :function (reason) {
                        logger.error (reason);
                    }
                };
            };
        }
    }

    /**
     * Initializes a WSS server.
     * 1. First start HTTP server
     * 2. Start Android Widget runtime
     * 3. Starts WebSocket Server
     */
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
                logger.addId (PzpObject.getMetaData("webinosName"));
                wsServer.on ("request", function (request) {
                    logger.log ("Request for a websocket, origin: " + request.origin + ", host: " + request.host);
                    if (request.host && request.host.split (":") &&
                        (request.host.split(":")[0] === "localhost" || request.host.split(":")[0] === "127.0.0.1")) {
                        var connection = request.accept ();
                        //_PzpObject.pzpWebSocket.connectedApp(connection);
                        connection.on ("message", function (message) { PzpObject.wsMessage (connection, request.origin, message.utf8Data); });
                        connection.on ("close", function (reason, description) { PzpObject.applicationCleanUp (connection, description) });
                    } else {
                        logger.error ("Failed to accept websocket connection: " + "wrong host or origin");
                    }
                });
                if (wsServer) {
                    logger.log("Successfully started pzp WebSocket server");
                    /* start up the Android-side widgetmanager service */
                    if (process.platform == 'android') {
                        try { var widgetLibrary = require('webinos-widget'); } catch(e) { widgetLibrary = null; }
                        if(widgetLibrary) {
                            process.env.WRT_HOME = '/data/data/org.webinos.app/wrt';
                            var bridgewm = require('bridge').load('org.webinos.app.wrt.mgr.WidgetManagerImpl', exports);
                            bridgewm.setWidgetProcessor(widgetLibrary.widgetmanager);
                        }
                    }
                    
                    if (PzpObject.getEnrolledStatus()) {
                        PzpObject.connectHub();
                    } else {
                        logger.log("Pzp is in virgin mode i.e. not enrolled/registered with Personal Zone Hub.");
                    }
                    PzpObject.emit("PZP_STARTED");
                }
            }
        });
    };
}
module.exports = PzpWebSocketServer;
