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

/**
 * This module is responsible for structure information cleanup from PZP when PZH/Peer PZP or App disconnects
 * - RPC/Message Handling are also invoked to remove information.
 * - Removes a PZP from Personal ZONE functionality is also implemented
 */

function Pzp_CleanUp(){
    "use strict";
    var PzpCommon = require("./pzp.js");
    var PzpObject = this;
    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    /**
     * Cleanup of the webSocket
     * @connection - WebSocket connection
     */
    this.applicationCleanUp  = function(connection, reason) {
        if (PzpObject.connectedWebApp[connection.id]) {
            delete PzpObject.connectedWebApp[connection.id];
            PzpObject.messageHandler.removeRoute (connection.id, PzpObject.getSessionId());
            logger.log ("web client disconnected: " + connection.id + " due to " + reason);
        }
    };

    /**
     * Removes pzp or pzh from the connected list and then updatesApp to update status about connection status
     * @param_ id - identity of the PZP or PZH disconnected
     */
    this.socketCleanUp = function (_id) {
        var key;
        if (_id) {
            PzpObject.messageHandler.removeRoute (_id, PzpObject.getSessionId());
            for (key in PzpObject.getConnectedPzp()) {
                if (key === _id) {
                    logger.log ("pzp - " + key + " details removed");
                    if (Object.keys(PzpObject.getConnectedPzp()) <= 1) PzpObject.setConnectState("peer", false);
                    delete PzpObject.getConnectedPzp()[key];
                }
            }
            if ((Object.keys(PzpObject.getConnectedPzh())).length > 1)  PzpObject.pzhDisconnected();
            for (key in PzpObject.getConnectedPzh()) {
                if (PzpObject.getConnectedPzh().hasOwnProperty (key) && key === _id) {
                    logger.log ("pzh - " + key + " details removed");
                    PzpObject.setConnectState("hub", false);
                    delete PzpObject.getConnectedPzp()[key];
                }
            }
            PzpObject.connectedApp();
        }
    };
    /**
     *  De-register PZP device from the PZH
     */
    this.unRegisterDevice = function() {
        // Delete all important folders that makes it a PZP
        var filePath, key;
        // TODO: Revoke PZP certificate...
        logger.log("PZP configuration is being reset");
        config.fileList.forEach (function (name) {
            if (!name.fileName) name.fileName = config.metaData.webinosName;
            filePath = PzpCommon.path.join(config.metaData.webinosRoot, name.folderName, name.fileName+".json");
            logger.log("PZP Reset - " + filePath);
            PzpCommon.fs.unlink(filePath);
        });

        if ((Object.keys(PzpObject.getConnectedPzh())).length > 1)  PzpObject.pzhDisconnected();
        // Disconnect existing connections
        for (key in PzpObject.getConnectedPzp()) {
            if (PzpObject.getConnectedPzp().hasOwnProperty (key)) {
                delete PzpObject.getConnectedPzp()[key];
                PzpObject.messageHandler.removeRoute(key, PzpObject.getSessionId());
            }
        }
        for (key in PzpObject.getConnectedPzh()) {
            if (PzpObject.getConnectedPzh().hasOwnProperty (key)) {
                delete PzpObject.getConnectedPzh()[key];
                PzpObject.messageHandler.removeRoute(key, PzpObject.getSessionId());
                PzpObject.setConnectState("hub", false);
            }
        }
        PzpObject.initializePzp();
    };
}

module.exports = Pzp_CleanUp;