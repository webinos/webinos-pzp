var PzpID = function () {
    var PzpObject = this;
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
            friendlyName = PzpObject.getFriendlyName(PzpObject.getPzhId())+ " " + friendlyName;
        }
        return friendlyName;
    };

    /**
     * Sets webinos pzp sessionId
     */
    this.setSessionId = function () {
        var sessionId = PzpObject.getMetaData("webinosName");
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
        var appId = null, sessionId, newId;
        if (!webAppName) {
            webAppName = require("crypto").randomBytes(3).toString("hex").toUpperCase();
        } else {
            if (webAppName.indexOf('widget') == 1) {
                // widget's path syntax:
                // /widget/<install_id>/<session_id>/file
                appId = 'IID' + webAppName.split('/')[2];
            }
        }
        if (appId == null) {
            appId = require("crypto").createHash("md5").update(PzpObject.getSessionId() + webAppName).digest("hex");
        }
        sessionId = Math.round(Math.random()*100);
        newId = (PzpObject.getSessionId()  + "/"+ appId +":" + sessionId)
        return newId;
    }
};

module.exports = PzpID;
