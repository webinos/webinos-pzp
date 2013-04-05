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
 * AUTHORS: Habib Virji (habib.virji@samsung.com), Ziran Sun(ziran.sun@samsung.com)
 *******************************************************************************/
/**
 * PZP TLS Server allow other PZPs to this device
 * This server is started after PZP is enrolled to the PZH
 * This is used in P2P scenario
 */
var PzpClient = require("./pzp_connectPeer.js");
var PzpServer = function () {
    "use strict";
    PzpClient.call(this);
    var PzpObject = this;
    var PzpCommon = require("./pzp.js");
    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var tlsServer;

    /**
     * Checks if connecting PZP has valid certificate parameters
     * @param conn
     */
    function pzpAuthorization (conn) {
        var text, clientSessionId, cn, n, cn_part;
        var peerCertificate = conn.getPeerCertificate();
        if (peerCertificate) {
            text = decodeURIComponent(peerCertificate.subject && peerCertificate.subject.CN);
            cn = decodeURIComponent(peerCertificate.issuer && peerCertificate.issuer.CN);
            // check if in the same zone
            var zoneId = PzpObject.getPzhId();
            if(zoneId.indexOf(cn) !=-1) {
                clientSessionId = zoneId + "/"+ text.split(":")[1];
            } else {
                clientSessionId = PzpObject.getExternalCertificate();
                if (!clientSessionId) {
                    logger.error("UnKnown device is trying to connect to the PZP");
                    conn.socket.end();
                    return;
                }
                PzpObject.setExternalCertificate("");
            }
            logger.log("Authorised session " + clientSessionId);
            PzpObject.handlePeerAuthorization(clientSessionId, conn);
        } else {
            conn.socket.end();
            logger.error("Pzp connection unauthorized as peer certificate not present");
        }
    }

    /**
     * Starts PZP TLS server
     */
    this.startServer = function() {
        if (!tlsServer) {
            PzpObject.setConnectionParameters(function (status, certConfig) {
                tlsServer = PzpCommon.tls.createServer(certConfig, function(conn) {
                    if (conn.authorized) {
                        pzpAuthorization(conn);
                    } else {
                        PzpObject.unAuthentication(conn);
                    }

                    conn.on ("data", function (buffer) {
                        PzpObject.handleMsg(conn, buffer);
                    });

                    conn.on ("end", function () {
                        PzpObject.cleanUp(conn.id);
                    });

                    conn.on ("error", function (err) {
                        PzpObject.handleError(err);
                    });
                });

                tlsServer.on ("error", function (err) {
                   PzpObject.handleError(err);
                });

                tlsServer.on ("listening", function () {
                    logger.log("listening on port :" + PzpObject.getPorts().pzp_tlsServer);
                });
                tlsServer.listen(PzpObject.getPorts().pzp_tlsServer);
            })
        }

    };
};

require("util").inherits(PzpServer, PzpClient);
module.exports = PzpServer;