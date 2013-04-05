
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
        var own = path.join(PzpObject.getWebinosPath(), "keys", "conn.pem");
        var other = path.join(PzpObject.getWebinosPath(), "keys", "otherconn.pem");
        var exlist = path.join(PzpObject.getWebinosPath(), "exCertList.json");
        if(existsSync(own)) {
            PzpCommon.fs.unlink(own, function(err){
                if(err) throw err;
                logger.log("removed" + own);
            });
        }
        if(existsSync(other)) {
            PzpCommon.fs.unlink(other, function(err){
                if(err) throw err;
                logger.log("removed" + other);
            });
        }
        if(existsSync(exlist)) {
            PzpCommon.fs.unlink(exlist, function(err){
                if(err) throw err;
                logger.log("removed - " + exlist);
            });
        }
        PzpObject.setConnectingPeerAddr("");
    }
    /**
     * Connect Peer PZPs. This is either triggered by PZH sending PZPUpdate message or else from PZP local discovery
     * @param msg - msg is an object containing port, address and name of PZP to be connected
     */
    this.connectPeer = function (msg) {
        PzpObject.setConnectionParameters(function (status, options) {
            var name = msg.name, n, client;
            if(name && (n = name.indexOf("/"))) options.servername = name.substring(0, n);
            client = PzpCommon.tls.connect(PzpObject.getPorts().pzp_tlsServer, msg.address, options, function () {
                if (client.authorized) {
                    PzpObject.handlePeerAuthorization(msg.name, client);
                    pzpClient_PeerCleanup();
                } else {
                    PzpObject.unAuthentication(client);
                }
            });

            client.on("data", function (buffer) {
                PzpObject.handleMsg(client, buffer);
            });

            client.on("end", function () {
                PzpObject.cleanUp(client.id);
            });

            client.on("error", function (err) {
                PzpObject.handleError(err);
            });
        });
    };
};
module.exports = PzpClient;