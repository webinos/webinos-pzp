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
    console.log("websocket");
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
     * Cleanup of the webSocket
     * @connection - WebSocket connection
     */
    this.wsClose  = function(connection, reason) {
        if (connectedWebApp[connection.id]) {
            delete connectedWebApp[connection.id];
            PzpObject.messageHandler.removeRoute (connection.id, PzpObject.getSessionId());
            logger.log ("web client disconnected: " + connection.id + " due to " + reason);
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
            res.write (JSON.stringify ({websocketPort:PzpObject.getWebinosPorts().pzp_webSocket}));
            res.end();
            return;
        }
        var documentRoot = PzpCommon.path.join (__dirname, "../web_root/");
        var filename = PzpCommon.path.join (documentRoot, uri);
        // If we detect that user has not configured PZP, redirect towards the page.
        PzpCommon.wUtil.webinosContent.sendFile(res, documentRoot, filename, "index.html");
    }

    /**
     * @param address - address of the application
     * @param message - message towards web application
     */
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

    /**
     * Returns webinos version
     * @param from: Address to return back message
     */
    function getVersion (from) {
        var msg;
        if (PzpObject.getWebinosVersion()) {
            PzpObject.prepMsg (from, "webinosVersion", PzpObject.getWebinosVersion());
        } else {
            var packageValue = require("../package.json")
            PzpObject.prepMsg (from, "webinosVersion", packageValue.version);
        }
    }
    /**
     * Helper function for getConnectedInfo
     */
    function getPzpDetails(zone, key) {
        var list = [], value, key1;
        for (key1 in zone) {
            if (zone.hasOwnProperty(key1)){
                if(key) {
                  if (key1.split("/") && key1.split("/")[0] === key) {
                      list.push(zone[key1].friendlyName || key1);
                  }
                } else {
                    value = zone[key1].friendlyName || zone[key1];
                    if (typeof value === "object") value = key1;
                    list.push(value);
                }
            }
        }
        return list;
    }
    /**
     * Returns connected devices information
     * @return {Array}
     */
    function getConnectedInfo() {
        var list = [], store = {}, key, zonePzh, zonePzp, externalPzh, externalPzp;
        zonePzh = PzpObject.getConnectedPzh();
        zonePzp = PzpObject.getConnectedPzp();
        externalPzh =  PzpObject.getPzhConnectedDevices().pzh;
        externalPzp = PzpObject.getPzhConnectedDevices().pzp;

        // Not connected to PZH
        if(Object.keys(zonePzh).length === 0) {
            list = getPzpDetails(zonePzp);
            list.push(PzpObject.getFriendlyName() || PzpObject.getSessionId());
        } else {
	        for (key in zonePzh) {
            if(zonePzh.hasOwnProperty(key)) {
                store = {id: zonePzh[key].friendlyName || key, pzp: []};
                store.pzp.push(getPzpDetails(zonePzp, key));
                store.pzp.push(getPzpDetails(externalPzp, key));
                if (key === PzpObject.getPzhId()) store.pzp.push(PzpObject.getFriendlyName() || PzpObject.getSessionId());
                list.push(store);
            }
          }
        }
        // If PZH is not connected then externalPZH will be empty
        for (key in externalPzh) {
            if(externalPzh.hasOwnProperty(key)) {
                store = {id: externalPzh[key], pzp: []};
                store.pzp.push(getPzpDetails(zonePzp, key));
                store.pzp.push(getPzpDetails(externalPzp, key));
                list.push(store);
            }
        }
        return list;
    }

	function sendApplicationItsId(msgType, to) {
	    var msg, payload = { "pzhId":(PzpObject.getPzhId() && 
						PzpObject.getConnectedPzh().hasOwnProperty(PzpObject.getPzhId()) &&
						PzpObject.getConnectedPzh()[PzpObject.getPzhId()].friendlyName)|| 
						PzpObject.getPzhId() || "",
                        "connectedDevices" :getConnectedInfo(),
                        "state"        :PzpObject.getState(),
                        "enrolled"     :PzpObject.getEnrolledStatus()};

		PzpObject.prepMsg(to, msgType, payload);
		msg = PzpObject.messageHandler.createRegisterMessage(to, PzpObject.getSessionId());
		PzpObject.messageHandler.onMessageReceived(msg, msg.to);
	}
	function setWebApplicationId(webAppName) {
		var appId, sessionId;
		if (!webAppName) webAppName = require("crypto").randomBytes(3).toString("hex").toUpperCase();
        appId = require("crypto").createHash("md5").update(PzpObject.getSessionId() + webAppName).digest("hex");
		sessionId = Math.round(Math.random()*100);
        return (PzpObject.getSessionId()  + "/A"+ appId +"/S" + sessionId);
	}
	this.pzhDisconnected = function () {
        var key;
        for (key in connectedWebApp) {
            if (connectedWebApp.hasOwnProperty (key)) {
                var msg = prepMsg (key, "pzhDisconnected", "pzh disconnected");
                PzpObject.sendConnectedApp (key, msg);
            }
        }
    };
    this.checkConnectedWebApp = function(from) {
        return connectedWebApp.hasOwnProperty(from);
    };
    this.connectedApp = function(connection, webAppName) {
        var to ;
        if (connection) {
			setWebApplicationId(webAppName);		
            connectedWebApp[to] = connection;
            connection.id = to; // this to helps in while deleting socket connection has ended
			sendApplicationItsId("registeredBrowser", to);
            if(Object.keys(connectedWebApp).length == 1 ) {
                getVersion(to);
            }
        } else {
            for (key in connectedWebApp) {
                if (connectedWebApp.hasOwnProperty (key)) {
                    //Special case of enrollment, length of id will be 2 and after these felow steps will be updated to 3
                    if ((key && key.split("/") && key.split("/").length === 2) &&
                        (PzpObject.getSessionId() && PzpObject.getSessionId().split("/") && PzpObject.getSessionId().split("/").length === 2)) {
                        tmp = connectedWebApp[key];
                        delete connectedWebApp[key];
                        key = PzpObject.getSessionId()+"/"+ key.split("/")[1];
                        tmp.id = key;
                        connectedWebApp[key] = tmp;
                    }
					sendApplicationItsId("update", appId);            
                }
            }
        }
    };

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
                PzpObject.getWebinosPorts().pzp_webSocket = parseInt(PzpObject.getWebinosPorts().pzp_webSocket, 10) + 1;
                logger.error ("address in use, now trying port " + PzpObject.getWebinosPorts().pzp_webSocket);
                httpserver.listen(PzpObject.getWebinosPorts().pzp_webSocket);
            } else {
                return callback (false, err);
            }
        });

        httpserver.on ("listening", function () {
            logger.log("httpServer listening at port " + PzpObject.getWebinosPorts().pzp_webSocket + " and hostname localhost");
            return callback (true, httpserver);
        });
        httpserver.listen (PzpObject.getWebinosPorts().pzp_webSocket, "0.0.0.0");
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
                logger.addId (PzpObject.getDeviceName());
                wsServer.on ("request", function (request) {
                    logger.log ("Request for a websocket, origin: " + request.origin + ", host: " + request.host);
                    if (request.host && request.host.split (":") &&
                        (request.host.split(":")[0] === "localhost" || request.host.split(":")[0] === "127.0.0.1")) {
                        var connection = request.accept ();
                        //_PzpObject.pzpWebSocket.connectedApp(connection);
                        connection.on ("message", function (message) { PzpObject.wsMessage (connection, request.origin, message.utf8Data); });
                        connection.on ("close", function (reason, description) { wsClose (connection, description) });
                    } else {
                        logger.error ("Failed to accept websocket connection: " + "wrong host or origin");
                    }
                });
                if (wsServer) {
                    logger.log("Successfully started pzp WebSocket server");
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

require("util").inherits(PzpWebSocketServer, PzpHub);
module.exports = PzpWebSocketServer;
