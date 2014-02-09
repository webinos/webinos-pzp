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
    PzpObject.moduleHttpHandlers = {};
    var httpserver;
    var wrtServer;
    var peerCert = new PzpCommon.certExchange(PzpObject);
    if (process.platform == "android") {
        try {
            // Call interface to webinos-android
            wrtServer = require("bridge").load(require("../platform_interfaces.json").android.WebinosSocketServerImpl, exports);
        } catch (e) {
            logger.error ("exception attempting to open wrt server " + e);
        }
    }


    /**
     * This handles HTTP request which includes file which are shown in browser
     */
    function handleHttpRequest(url, req, res) {
        var path = url.pathname;
        var parts = path.split('/').filter(function (part) { return !!part; });
        if (parts.length >= 2 && parts[0] == "module" && PzpObject.moduleHttpHandlers[parts[1]]) {
            return PzpObject.moduleHttpHandlers[parts[1]](req, res);
        } else if (path == "/webinosConfig.json") {
            /**
             * Expose the current communication channel websocket port using this virtual file.
             * This code must have the same result with the widgetServer.js used by wrt
             * webinos-widgetServer/lib/widgetServer.js
             */
            res.writeHead (200, {"Content-Type":"application/json"});
            res.write (JSON.stringify ({websocketPort:PzpObject.getWebinosPorts("pzp_webSocket")}));
            res.end();
            return;
        }  else if (path == "/webinos.js") {
            /**
             * Expose the webinos.js from .webinos folder due to write permissions.
             * This code must have the same result with the widgetServer.js
             * webinos-widgetServer/lib/widgetServer.js
             */
            var webinosJSPath = PzpCommon.path.join(PzpCommon.wUtil.webinosPath.webinosPath(), "wrt", "webinos.js");
            var stream = PzpCommon.fs.createReadStream(webinosJSPath);
            stream.on('open', function () {
                res.writeHead(200, {"Content-Type": "application/javascript"});
                stream.pipe(res);
            });
            stream.on('error', function () {
                res.writeHead(404);
                res.end();
            });
            return;
        } else if (/^\/dashboard(\/.*)?$/.test(path)) {
            var dashboard = null;
            try {dashboard = require("webinos-dashboard");}catch (e){logger.log("webinos Dashboard is not present.");}
            if (dashboard != null){
                dashboard.httpHandler(path, req, res);
                return;
            }
        } else if (PzpObject.searchInsideOwnModules(path)) {
            var documentRoot2 = PzpCommon.path.join (__dirname, "../node_modules");

            // If we detect that user has not configured PZP, redirect towards the page.
            var filename2 = PzpCommon.path.join(documentRoot2, path);
            PzpCommon.wUtil.webinosContent.sendFile(res, documentRoot2, filename2);
            return;
        }
        var documentRoot = PzpCommon.path.join (__dirname, "../web_root/");
        var filename = PzpCommon.path.join (documentRoot, path);
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
     * Returns connected devices information
     * @return {Array}
     */
    function getConnectedInfo() {
        var list = [],zonePzh, zonePzp, isConnected;
        var pzhId = PzpObject.getPzhId();
        zonePzh = Object.keys(PzpObject.getTrustedList("pzh"));
        zonePzp = Object.keys(PzpObject.getTrustedList("pzp"));

        var connectedDevice = PzpObject.getConnectedDevices();
        if (pzhId && connectedDevice.pzh.indexOf(pzhId) === -1 && PzpObject.getConnectedPzh(pzhId)) {
            connectedDevice.pzh.push(pzhId);
        }
	// Not connected to PZH
        for (var i =0; i < zonePzh.length; i = i + 1) {
            pzhId = zonePzh[i];
            var pzp=[];
            for (var j=0; j < zonePzp.length; j = j +1) {
                if(pzhId === zonePzp[j].split("/")[0]){
                    isConnected =(connectedDevice.pzp.indexOf(zonePzp[j]) !== -1) ;
                    if (zonePzp[j] === PzpObject.getSessionId()){
                        isConnected = true;
                    }
                    pzp.push({friendlyName: PzpObject.getFriendlyName(zonePzp[j]),
                      id: zonePzp[j],
                      deviceType: PzpObject.getTrustedList("pzp") && PzpObject.getTrustedList("pzp")[zonePzp[j]]
                                  && PzpObject.getTrustedList("pzp")[zonePzp[j]].deviceType,
                      isConnected:isConnected});
                }
            }
            isConnected = (connectedDevice.pzh.indexOf(pzhId) !== -1) ;
            list.push( {id: pzhId,
                friendlyName: PzpObject.getFriendlyName(pzhId),
                pzp: pzp,
                photoUrl:PzpObject.getTrustedList("pzh") && PzpObject.getTrustedList("pzh")[pzhId]
                    && PzpObject.getTrustedList("pzh")[pzhId].photoUrl ,
                isConnected: isConnected});
        }
//        if (PzpObject.getEnrolledStatus())
//            list.push({id: PzpObject.getPzhId(),
//                       friendlyName: PzpObject.getFriendlyName(PzpObject.getPzhId()),
//                       pzp:getPzpDetails(zonePzp, PzpObject.getPzhId()) });
        if (list.length === 0) {
            list.push({friendlyName: PzpObject.getFriendlyName(),
                       id: PzpObject.getSessionId(),
                       deviceType: PzpObject.getMetaData("deviceType")});
        }
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

    this.registerBrowser = function(msg, connection) {
        var webAppName = msg && msg.payload && msg.payload.value;
        var webAppOrigin = msg && msg.payload && msg.payload.origin;
        var to, key, tmp;
        if (connection) {
            to = PzpObject.setApplicationId(webAppName, webAppOrigin);
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
        var msg, payload = {
            "pzhId": PzpObject.getPzhId(),
            "connectedDevices" :getConnectedInfo(),
            "state"        :PzpObject.getState(),
            "pzhWebAddress":PzpObject.getMetaData("pzhWebAddress"),
            "enrolled"     :PzpObject.getEnrolledStatus()
        };
        PzpObject.prepMsg(to, msgType, payload);
        msg = PzpObject.messageHandler.createRegisterMessage(to, PzpObject.getSessionId());
        PzpObject.messageHandler.onMessageReceived(msg, msg.to);
    }

    /**
     *  Start HTTP server, its instance is then used by the PZP WebSocket server
     */
    function startHttpServer(callback) {
        if (!httpserver){
             httpserver = PzpCommon.http.createServer(function (request, response) {
                var parsed = PzpCommon.url.parse(request.url, true);
                var tmp = "";

                request.on('data', function(data){
                    tmp = tmp + data;
                });
                request.on("end", function(){
                    if (parsed.query){
                        if (parsed.query === "connectPzh"){
                          if (request.connection.remoteAddress === PzpObject.getMetaData("serverName")) {
                              PzpObject.connectOwnPzh();
                          }
                        }else {
                            peerCert.handleMsg(parsed);
                        }
                    }
                });
                handleHttpRequest(parsed, request, response);
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
        } else {
            return callback(false);
        }
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

                PzpObject.registerBrowser(null, connection);

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
                            // Call interfaces to webinos-android
                            var androidInterfaces = require("../platform_interfaces.json").android;
                            process.env.WRT_HOME = androidInterfaces.wrt_home;
                            var bridgewm = require('bridge').load(androidInterfaces.WidgetManagerImpl, exports);
                            bridgewm.setWidgetProcessor(widgetLibrary.widgetmanager);
                        }
                    }

                    if (!PzpObject.getEnrolledStatus()) {
                        logger.log("Pzp is in virgin mode i.e. not enrolled/registered with Personal Zone Hub.");
                    }
                    PzpObject.emit("PZP_STARTED");

                    //android PZP status notification
                    if (process.platform == 'android') {
                        try {
                            var bridge = require('bridge');
                            // Call interface to webinos-android
                            var notification = bridge.load(require("../platform_interfaces.json").android.PZPNotificationManagerImpl, exports);
                            notification.eventNotify("Initialized", function(status){
                                logger.log("send notification on PZP status:" + status);
                            });
                            notification.eventNotify("PZP_PORT:"+PzpObject.getWebinosPorts("pzp_webSocket"), function(status){
                                logger.log("send notification on PZP info:" + status);
                            });
                        }
                        catch(e) {
                            logger.error("Android pzp notification - error: "+e.message);
                        }
                    }
                }
            }
        });
    };
}
module.exports = PzpWebSocketServer;
