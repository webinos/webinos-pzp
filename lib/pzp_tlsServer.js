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
var PzpServer = function () {
    "use strict";
    var PzpObject = this;
    var PzpCommon = require("./pzp.js");
    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var tlsServer;

    /**
     * Starts PZP TLS server
     */
    this.startServer = function() {
        if (!tlsServer) {
            var options = PzpObject.setConnectionParameters();
            var otherPzpCert = PzpObject.getSignedCertificateObj();
            for (var key in otherPzpCert) options.ca.push(otherPzpCert[key]);

            tlsServer = PzpCommon.tls.createServer(options, function(conn) {
                if (conn.authorized) {
                    PzpObject.handleAuthorization(conn);
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
               PzpObject.emit("EXCEPTION",err);
            });

            tlsServer.on ("listening", function () {
                logger.log("PZP TLS Server listening on port :" + PzpObject.getWebinosPorts("pzp_tlsServer"));
            });
            tlsServer.listen(PzpObject.getWebinosPorts("pzp_tlsServer"));
        }

    };
};
module.exports = PzpServer;
