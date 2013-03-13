
var PzpClient = function () {
    "use strict";
    var PzpCommon = require("./pzp.js");
    var logger = PzpCommon.wUtil.webinosLogging (__filename) || console;
     /**
     *
     */
    function pzpClient_PeerCleanup() {
        var path = require("path");
        var fs = require("fs");
        var existsSync = fs.existsSync || path.existsSync;
        logger.log("Clean up SiB leftovers");
        var own = path.join(parent.config.metaData.webinosRoot, "keys", "conn.pem");
        var other = path.join(parent.config.metaData.webinosRoot, "keys", "otherconn.pem");
        var exlist = path.join(parent.config.metaData.webinosRoot, "exCertList.json");
        if(existsSync(own)) {
            fs.unlink(own, function(err){
                if(err) throw err;
                logger.log("removed" + own);
            });
        }
        if(existsSync(other)) {
            fs.unlink(other, function(err){
                if(err) throw err;
                logger.log("removed" + other);
            });
        }
        if(existsSync(exlist)) {
            fs.unlink(exlist, function(err){
                if(err) throw err;
                logger.log("removed - " + exlist);
            });
        }
        parent.pzp_state.connectingPeerAddr = "";
    }
    /**
     * Connect Peer PZPs. This is either triggered by PZH sending PZPUpdate message or else from PZP local discovery
     * @param msg - msg is an object containing port, address and name of PZP to be connected
     */
    this.connectPeer = function (msg) {
        parent.setConnectionParameters(function (options) {
            var name = msg.name, n, client;
            if(name && (n = name.indexOf("/"))) options.servername = name.substring(0, n);
            client = require("tls").connect(parent.getPorts().pzp_tlsServer, msg.address, options, function () {
                if (client.authorized) {
                    parent.handlePeerAuthorization(msg.name, client);
                    pzpClient_PeerCleanup();
                } else {
                    logger.error("pzp client - connection failed, " + client.authorizationError);
                }
            });

            client.on("data", function (buffer) {
                parent.handleMsg(client, buffer);
            });

            client.on("end", function () {
                parent.cleanUp(client.id);
            });

            client.on("error", function (err) {
                logger.error(err.message);
            });
        });
    }
};

module.exports = PzpClient;