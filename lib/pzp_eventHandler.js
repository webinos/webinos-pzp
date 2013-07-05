var PzpEventHandler = function() {
    var PzpCommon = require("./pzp.js");
    var logger    = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var PzpObject = this;
    var stateListeners = [];

    /**
     * Listener to update WRT about PZP state change
     * @param listener -
     */
    this.addStateListener = function (listener) {
        if (listener) {
            if (typeof listener.setHubConnected !== "function") {
                listener.setHubConnected = function(isConnected) {};
            }
            if (typeof listener.setPeerConnected !== "function") {
                listener.setPeerConnected = function(isConnected) {};
            }
            stateListeners.push(listener);

            // communicate current state
            listener.setHubConnected(PzpObject.getState("hub") === "connected");
            listener.setPeerConnected(PzpObject.getState("peer") === "connected");
        }
    };

    /**
     *  Triggers connected listeners about hub and peer state updates
     */
    this.setConnectState = function (mode, isConnected) {
        stateListeners.forEach(function(listener) {
            if (mode === "hub") {
                listener.setHubConnected(isConnected);
            } else if (mode === "peer") {
                listener.setPeerConnected(isConnected);
            }
        });
    };

    PzpObject.on("EXCEPTION", function(err){
      logger.error("EXCEPTION "+err);
    });
    PzpObject.on("MODULE_MISSING", function(err){
        logger.log("MODULE_MISSING " +err);
    });
    PzpObject.on("PZP_CONNECTED", function(msg){
        logger.log("PZP_CONNECTED ");
    });
    PzpObject.on("PZP_STARTED", function(msg){
        logger.log("PZP_STARTED ");
    });
    PzpObject.on("CONNECTION_FAILED", function(msg){
        logger.error("CONNECTION_FAILED " +msg);
    });
    PzpObject.on("PZP_START_FAILED", function(msg){
        logger.error("PZP_START_FAILED " +msg);
    });
    PzpObject.on("CLEANUP", function(err){
        logger.log("CLEANUP " +err);
    });
    PzpObject.on("FUNC_ERROR", function(err){
        logger.error("FUNC_ERROR " + err);
    });
    PzpObject.on("PARAM_MISSING", function(err){
        logger.error("PARAM_MISSING " +err);
    });

};
module.exports = PzpEventHandler;