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
    PzpObject.appSource = {};

    function startSyncTimer(){
        var id = setInterval(function(){
            if (PzpObject.getConnectedPzh().length === 0) {
                PzpObject.connectOwnPzh();
            }
           clearInterval(id);
        }, 30*60*1000);// Every 30 minutes wakeup and connect to PZH
    }
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
        if (PzpObject.appSource && PzpObject.appSource[connection.id]){
            var status = false;
            var source = PzpObject.appSource[connection.id], socketDetails;
            // Make sure no other app is using that host
            delete PzpObject.appSource[connection.id];
//            for (var key in PzpObject.appSource){
//                if (PzpObject.appSource.hasOwnProperty(key) && PzpObject.appSource[key]===source) status = true;
//            }
//            if (!status){
//               PzpObject.socketCleanUp(source);
//            }
        }

    };

    /**
     * Removes pzp or pzh from the connected list and then updatesApp to update status about connection status
     * @param_ id - identity of the PZP or PZH disconnected
     */
    this.socketCleanUp = function (_id) {
        if (_id) {
            PzpObject.messageHandler.removeRoute(_id, PzpObject.getSessionId());
            if(PzpObject.getConnectedPzp(_id)){
                logger.log ("pzp - " + _id + " details removed");
                if (PzpObject.getConnectedPzp().length <= 1) PzpObject.setConnectState("Pzp", false);
                PzpObject.deleteConnectedDevice(_id);
                return;
            }
            if (PzpObject.getConnectedPzh(_id)) {
                logger.log ("pzh - " + _id + " details removed");
                PzpObject.setConnectState("Pzh", false);
                PzpObject.deleteConnectedDevice(_id);
            }
            if (PzpObject.getConnectedPzh().length === 0) {
                startSyncTimer();
            }
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
        PzpObject.getFileList().forEach (function (name) {
            if (!name.fileName) name.fileName = PzpObject.getMetaData("webinosName");
            filePath = PzpCommon.path.join(PzpObject.getMetaData("webinosRoot"), name.folderName, name.fileName+".json");
            logger.log("PZP Reset - " + filePath);
            PzpCommon.fs.unlink(filePath);
        });

        if (PzpObject.getConnectedPzh().length > 1)  PzpObject.pzhDisconnected();
        // Disconnect existing connections

        PzpObject.getConnectedPzp().forEach(function(key){
            PzpObject.deleteConnectedDevice(key);
            PzpObject.messageHandler.removeRoute(key, PzpObject.getSessionId());
        });
        PzpObject.getConnectedPzh().forEach(function(key){
            PzpObject.deleteConnectedDevice(key);
            PzpObject.messageHandler.removeRoute(key, PzpObject.getSessionId());
        });
        PzpObject.setConnectState("hub", false);
        PzpObject.initializePzp();
    };

    this.decideToKeepConnectionAliveOrClose= function(id){
        // TODO: uncomment below lines for connection optimization
//        if((Object.keys(PzpObject.connectedWebApp)).length === 0){
//           logger.log("No application running, closing connection");
//           PzpObject.socketCleanUp(id);
//
//        }
        // If any App is running, keep connection alive.
    }
}

module.exports = Pzp_CleanUp;