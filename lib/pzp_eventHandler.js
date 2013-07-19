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
            listener.setHubConnected(PzpObject.getState("Pzh") === "connected");
            listener.setPeerConnected(PzpObject.getState("Pzp") === "connected");
        }
    };

    /**
     *  Triggers connected listeners about hub and peer state updates
     */
    this.setConnectState = function (mode, isConnected) {
        stateListeners.forEach(function(listener) {
            if (mode === "Pzh") {
                listener.setHubConnected(isConnected);
            } else if (mode === "Pzp") {
                listener.setPeerConnected(isConnected);
            }
        });
    };

    function getDetails(){
        var errorDetails = new Error().stack;
        errorDetails = errorDetails.split('\n')[4];
        var obj={fileName:"",functionName:"",lineNumber:""};
        obj.fileName = errorDetails.split("(")[1];
        obj.fileName = obj.fileName.substring(0,obj.fileName.indexOf(":"));
        obj.functionName = errorDetails.split("(")[0];
        obj.functionName = obj.functionName.substring(7);
        obj.lineNumber = errorDetails.split(":")[1];
        return obj;
    }
    PzpObject.on("PZP_STARTED", function(msg){
        logger.log("PZP_STARTED ");
    });
    PzpObject.on("PZH_CONNECTED", function(){
        logger.log("PZH_CONNECTED");
    });
    PzpObject.on("PZP_CONNECTED", function(){
        logger.log("PZP_CONNECTED");
    });
    PzpObject.on("EXCEPTION", function(err){
        var errDetails = getDetails();
        logger.error("EXCEPTION " + err + "\n Error raised in file "+ errDetails.fileName+" in function "+ errDetails.functionName +"at line number "+ errDetails.lineNumber);
    });

    PzpObject.on("MODULE_MISSING", function(err){
        var errDetails = getDetails();
        logger.error("MODULE_MISSING " + err + "\n Error raised in file "+ errDetails.fileName+" in function "+ errDetails.functionName +"at line number "+ errDetails.lineNumber);
    });
    PzpObject.on("PZP_CONNECTION_FAILED", function(err){
        var errDetails = getDetails();
        logger.error("PZP_CONNECTION_FAILED " + err + "\n Error raised in file "+ errDetails.fileName+" in function "+ errDetails.functionName +"at line number "+ errDetails.lineNumber);
    });
    PzpObject.on("PZP_START_FAILED", function(err){
        var errDetails = getDetails();
        logger.error("PZP_START_FAILED " + err + "\n Error raised in file "+ errDetails.fileName+" in function "+ errDetails.functionName +"at line number "+ errDetails.lineNumber);
    });
    PzpObject.on("FUNC_ERROR", function(err){
        var errDetails = getDetails();
        logger.error("FUNC_ERROR " + err + "\n Error raised in file "+ errDetails.fileName+" in function "+ errDetails.functionName +"at line number "+ errDetails.lineNumber);
    });
    PzpObject.on("PARAM_MISSING", function(err){
        var errDetails = getDetails();
        logger.error("PARAM_MISSING " + err + "\n Error raised in file "+ errDetails.fileName+" in function "+ errDetails.functionName +"at line number "+ errDetails.lineNumber);
    });
    PzpObject.on("CLEANUP", function(err){
        logger.log("CLEANUP " +err);
    });


};
module.exports = PzpEventHandler;