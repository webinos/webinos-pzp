
/**
 * Connects with PZH and handle respective events
 */
var PzpOtherManager = require("./pzp_otherManager.js");
var PzpCommon       = require("./pzp.js");

var PzpConnectHub = function () {
    "use strict";
    PzpOtherManager.call(this);
    var self = this;
    var logger = PzpCommon.wutil.webinosLogging (__filename) || console;

    /**
     * If PZP fails to connect to PZH, this tries to connect back to PZH
     */
    function retryConnecting () {
        if (self.getEnrolledStatus()) {
            setTimeout (function () {
                self.connect (function (status) {
                    logger.log ("retrying to connect back to the PZH " + (status ? "successful" : "failed"));
                });
            }, 60000);//increase time limit to suggest when it should retry connecting back to the PZH
        }
    }
    /**
     *
     * @param callback
     */
    this.connectHub = function (callback) {
        var pzpClient;
        try {
            self.setConnectionParameters(function (certificateConfiguration) {
                pzpClient = require("tls").connect(parent.getPorts().provider,
                    self.getServerAddress(),
                    certificateConfiguration, function() {
                    logger.log ("connection to pzh status: " + pzpClient.authorized);
                    if (pzpClient.authorized) {
                        authenticated (pzpClient, callback);
                    } else {
                        unauthenticated (pzpClient, callback);
                    }
                });
                pzpClient.setTimeout(100);

                pzpClient.on ("data", function (buffer) {
                    handleMsg(pzpClient, buffer);
                });

                pzpClient.on ("close", function(had_error) {
                    if(had_error) {
                        logger.log("transmission error lead to disconnect");
                    }
                });
                pzpClient.on ("end", function() {
                    if (pzpClient.id) cleanUp(pzpClient.id);
                    retryConnecting();
                });

                pzpClient.on ("error", function(err) {
                    handlePzpError(err);
                });
            });
        } catch (err) {
            logger.error ("Connecting Personal Zone Hub Failed : " + err);
        }
    }
};

require("util").inherits(PzpConnectHub, PzpOtherManager);
module.exports = PzpConnectHub;