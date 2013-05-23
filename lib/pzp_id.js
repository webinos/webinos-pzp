var PzpID = function () {
    var PzpObject = this;
    PzpObject.convertSessionIdToFriendlyName= function(id) {
        try {
            if(id === PzpObject.getSessionId()) {
                id = PzpObject.getFriendlyName(); // Special case of findServices
            } else if (PzpObject.getTrustedList().pzp[id] && PzpObject.getTrustedList().pzp[id].friendlyName) {
                id = PzpObject.getTrustedList().pzp[id].friendlyName;
            } else if (PzpObject.getTrustedList().pzh[id] && PzpObject.getTrustedList().pzh[id].friendlyName) {
                id = PzpObject.getTrustedList().pzh[id].friendlyName;
            } else if (PzpObject.connectedWebApp[id]) {
                var to = (id && id.split("/") && id.split("/").length === 2) ? id.split("/")[1] : id.split("/")[2];
                id = PzpObject.getFriendlyName() + "/"+ to;
            } else if(PzpObject.getPzhConnectedDevices().pzp[id]) {
                id = PzpObject.getPzhConnectedDevices().pzp[id];
            } else if(PzpObject.getPzhConnectedDevices().pzh[id]) {
                id = PzpObject.getPzhConnectedDevices().pzh[id];
            }
            return id;
        } catch (err) {
            PzpObject.emit("FUNC_ERROR", "convert from internal name to friendly name failed");
        }
        return undefined;
    };

    PzpObject.convertFriendlyNameToSessionId = function(id) {
        try {
            if (id) {
                var matchId= id && id.split("/") && id.split("/")[0], key, i;
                if(matchId === PzpObject.getFriendlyName()) {
                    id = (id.split('/').length > 1) ? (PzpObject.getSessionId() +"/"+ id.split('/')[1]) : PzpObject.getSessionId();
                } else {
                    var list = [PzpObject.getTrustedList().pzh,
                        PzpObject.getTrustedList().pzp,
                        PzpObject.getPzhConnectedDevices().pzp,
                        PzpObject.getPzhConnectedDevices().pzh];
                    list.forEach(function(name) {
                        for (key in name) {
                            if (name.hasOwnProperty(key) &&
                                (name[key].friendlyName === matchId || name[key] === matchId )) {
                                id = key;
                                break;
                            }
                        }
                    });
                }
            }
            return id;
        } catch(err){
            PzpObject.emit("FUNC_ERROR", "convert from friendly name to internal name failed");
        }
        return undefined;
    };
    /**
     * Changes friendly name of the PZP
     * @param {String} friendlyName_ - PZP friendly name intended to be changed
     */
    this.setFriendlyName = function(friendlyName_) {
        var friendlyName;
        if(friendlyName_) {
            friendlyName = friendlyName_;
        } else {
            var os = require("os");
            if (os.platform() && os.platform().toLowerCase() === "android" ){
                friendlyName = "Mobile";
            } else if (process.platform === "win32") {
                friendlyName = "Windows PC";
            } else if (process.platform === "darwin") {
                friendlyName = "MacBook";
            } else if (process.platform === "linux" || process.platform === "freebsd") {
                friendlyName = "Linux Device";
            } else {
                friendlyName = "Webinos Device";// Add manually
            }
        }
        if (PzpObject.getEnrolledStatus()){
            friendlyName = PzpObject.getPzhFriendlyName()+ " " + friendlyName;
        }
        return friendlyName;
    };

    /**
     * Sets webinos pzp sessionId
     */
    this.setSessionId = function () {
        var sessionId = "D"+PzpObject.getDeviceName();
        if (PzpObject.getEnrolledStatus()) {
            sessionId = PzpObject.getPzhId()+ "/" +sessionId;
        }
        return sessionId;
    };
    /**
     * sets webinos application id
     * @param webAppName
     * @return {String}
     */
    this.setApplicationId = function(webAppName) {
        var appId, sessionId, newId;
        if (!webAppName) webAppName = require("crypto").randomBytes(3).toString("hex").toUpperCase();
        appId = require("crypto").createHash("md5").update(PzpObject.getSessionId() + webAppName).digest("hex");
        sessionId = Math.round(Math.random()*100);
        newId = (PzpObject.getSessionId()  + "/A"+ appId +":S" + sessionId)
        return newId;
    }
};

module.exports = PzpID;