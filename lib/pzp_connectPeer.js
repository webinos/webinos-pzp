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
 * AUTHORS: Habib Virji (habib.virji@samsung.com)
 *******************************************************************************/
var PzpClient = function () {
    "use strict";
    var PzpCommon = require("./pzp.js");
    var PzpObject = this;
    var logger = PzpCommon.wUtil.webinosLogging (__filename) || console;
     /**
     *
     */
    function pzpClient_PeerCleanup() {
        var existsSync = PzpCommon.fs.existsSync || PzpCommon.path.existsSync;
        logger.log("Clean up SiB leftovers");
        var certList = [PzpCommon.path.join(PzpObject.getMetaData("webinosRoot"), "keys", "conn.pem"),
            PzpCommon.path.join(PzpObject.getMetaData("webinosRoot"), "keys", "otherconn.pem"),
            PzpCommon.path.join(PzpObject.getMetaData("webinosRoot"), "exCertList.json")];
        certList.forEach(function(name){
            if(existsSync(name)) {
                try{
                    PzpCommon.fs.unlinkSync(name);
                    logger.log("removed" + name);
                } catch(err){
                   PzpObject.emit("CLEANUP", new Error("Failed removing "+name+ " - "+ err));
                }
            }
        });
        PzpObject.setConnectingPeerAddr("");
    }
    /**
     * Connect Peer PZPs. This is either triggered by PZH sending PZPUpdate message or else from PZP local discovery
     * @param msg - msg is an object containing port, address and name of PZP to be connected
     */
    this.connectPeer = function (address) {
        var options = PzpObject.setConnectionParameters();
        var otherPzpCert = PzpObject.getSignedCertificateObj();
        options.ca=[];
        for (var key in otherPzpCert) {
            if (otherPzpCert.hasOwnProperty(key) && key !== PzpObject.getSessionId()){
                options.ca.push(otherPzpCert[key]);
            }
        }
        options.servername = undefined;
        options.rejectUnauthorized = false;
        var client = PzpCommon.tls.connect(PzpObject.getWebinosPorts("pzp_tlsServer"), address, options,
            function () {
             console.log(client);
            if (client.authorized) {
                PzpObject.handleAuthorization(client);
            } else {
                PzpObject.unAuthorized(client, "Pzp");
            }
            pzpClient_PeerCleanup();
        });

        client.on("data", function (buffer) {
            PzpObject.handleMsg(client, buffer);
        });

        client.on("end", function () {
            PzpObject.socketCleanUp(client.id);
        });

        client.on("error", function (err) {
            PzpObject.emit("CONNECTION_FAILED", err);
        });
    }

};
module.exports = PzpClient;
