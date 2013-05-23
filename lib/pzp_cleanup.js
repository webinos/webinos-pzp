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