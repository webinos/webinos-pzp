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
 * AUTHORS: Habib Virji (habib.virji@samsung.com)
 *******************************************************************************/
var PzpSendMessage = function () {
    "use strict";
    var PzpCommon = require("./pzp.js");
    var PzpObject = this;
    var logger    = PzpCommon.wUtil.webinosLogging(__filename) || console;

    function isConnected(to){
        return (PzpObject.getConnectedPzp(to) || PzpObject.getConnectedPzh(to) || PzpObject.connectedWebApp.hasOwnProperty(to));
    }
    function isApp(address){
        var len = address.split("/");
        console.log(len.length)
        return !!(len.length === 3);
    }
    function isSameZone(name){
        var splitName = name.split("/");
        if (splitName.length > 1) {
            if (splitName[0] === PzpObject.getPzhId()) return true;
        }
        return false;
    }
    function startConnection(to){
        var trustedList = PzpObject.getTrustedList(), name;
        if(trustedList.pzh[to]){ // Direct to own PZH
            if (to === PzpObject.getPzhId()){// Own PZH
                PzpObject.connectOwnPzh();
                return;
            }
        }
        // CONNECTING ZONE PZH
        // PZP does not connect directly, it connects via its own PZH
        if (trustedList.pzh[to]){
            if (!PzpObject.getConnectedPzh(PzpObject.getPzhId())) {
                PzpObject.connectOwnPzh();// Force our PZH to start...
                // Once connected message from PZP will be forwarded to PZH, PZH will then trigger connection towards other PZH
            }
        }

        // CONNECTING OTHER PEERS
        // find other



    }


    /**
     * Prepares webinos internal message to be sent between webinos endpoints
     * @param {String} to - address of the entity message is being sent
     * @param {String} status - webinos specific command
     * @param {String/Object} message - message payload
     */
    this.prepMsg = function (to, status, message) {
        if (!message) {
            message = status;
            status = to;
            to = PzpObject.getPzhId();
        }
        var msg = {"type":"prop",
            "from"       :PzpObject.getSessionId(),
            "to"         :to,
            "payload"    :{"status":status,
                "message"          :message}};
        PzpObject.sendMessage (msg, to);
    };

    /**
     * Sends message to either PZH or PZP or Apps
     * @param {Object} message - message to be sent to other entity
     * @param {String} address - destination address
     */
    this.sendMessage = function (message, address) {
        if(!logger.id) logger.addId(PzpObject.getSessionId());
        if (message && address) {
            var jsonString = JSON.stringify (message);
            var buf = PzpCommon.wUtil.webinosMsgProcessing.jsonStr2Buffer (jsonString);
            if(isConnected(address)){
                if (PzpObject.checkConnectedPzp(address)
                    && PzpObject.getState("peer") === "connected") {
                    try {
                        PzpObject.getConnectedPzp(address).pause();
                        PzpObject.getConnectedPzp(address).write(buf);
                    } catch (err) {
                        PzpObject.emit("EXCEPTION","exception in sending message to pzp",err);
                    } finally {
                        logger.log ('send to pzp - ' + address + ' message ' + jsonString);
                        PzpObject.getConnectedPzp(address).resume ();
                    }
                } else if (PzpObject.checkConnectedPzh(address)
                    && PzpObject.getEnrolledStatus()
                    && PzpObject.getState("hub") === "connected") {
                    try {
                        PzpObject.getConnectedPzh(address).resume ();
                        PzpObject.getConnectedPzh(address).pause();
                        PzpObject.getConnectedPzh(address).write(buf);
                    } catch (err) {
                        PzpObject.emit("EXCEPTION","exception in sending message to pzh",err);
                    } finally {
                        logger.log ('send to hub - ' + address + ' message ' + jsonString);
                        PzpObject.getConnectedPzh(address).resume ();
                    }
                } else if (PzpObject.connectedWebApp.hasOwnProperty (address)) {
                    try {
                        PzpObject.connectedWebApp[address].socket.pause ();
                        PzpObject.connectedWebApp[address].sendUTF(jsonString);
                    } catch (err) {
                        logger.error ("exception in sending message to pzp - " + err);
                    } finally {
                        logger.log ('send to web app - ' + address + ' message ' + jsonString);
                        PzpObject.connectedWebApp[address].socket.resume ();
                    }
                }
            } else if (!isApp(address)) {
                startConnection(address);
                var message_ = message;
                var address_ = address;

                PzpObject.on("HUB_CONNECTED", function(){
                    if (message_ && address_){
                        PzpObject.appSource[message_.resp_to] = address_;
                        PzpObject.sendMessage(message_, address_);
                    }
                    message_=address_=undefined;
                });
            } else{
                logger.log("The app "+address+ " is not currently connected");
            }
        } else {
            PzpObject.emit("PARAM_MISSING", "message or address field are missing");
        }
    };

    /**
     *
     * @param command
     * @param payload
     */
    this.sendMessageAll = function (command, payload) {
        PzpObject.getConnectedPzp().forEach(function(name) {
            PzpObject.prepMsg(name, command, payload);
        });
        PzpObject.getConnectedPzh().forEach(function(name) {
            PzpObject.prepMsg(name, command, payload);
        });
    };
};
module.exports = PzpSendMessage;
