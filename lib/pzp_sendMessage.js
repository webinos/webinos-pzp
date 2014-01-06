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

    this.isConnected = function(to){
        return (PzpObject.getConnectedPzp(to) ||
            PzpObject.getConnectedPzh(to) ||
            PzpObject.connectedWebApp.hasOwnProperty(to));
    }
    function isApp(address){
        var len = address && address.split("/");
        return !!(len.length === 3);
    }
    /**
     * Prepares webinos internal message to be sent between webinos endpoints
     * @param {String} to - address of the entity message is being sent
     * @param {String} status - webinos specific command
     * @param {String/Object} [message] - message payload
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
            if(this.isConnected(address) ){
                if (message.resp_to && isApp(message.resp_to)){
                    PzpObject.appSource[message.resp_to] = address;
                }
                if (PzpObject.checkConnectedPzp(address)
                    && PzpObject.getState("Pzp") === "connected") {
                    try {
                        PzpObject.getConnectedPzp(address).pause();
                        PzpObject.getConnectedPzp(address).write(buf);
                    } catch (err) {
                        PzpObject.emit("EXCEPTION","exception in sending message to pzp",err);
                    } finally {
                        logger.log ('send to pzp - ' + address);
                        PzpObject.getConnectedPzp(address).resume();
                    }
                } else if (PzpObject.checkConnectedPzh(address)
                    && PzpObject.getEnrolledStatus()
                    && PzpObject.getState("Pzh") === "connected") {
                    try {
                        PzpObject.getConnectedPzh(address).resume ();
                        PzpObject.getConnectedPzh(address).pause();
                        PzpObject.getConnectedPzh(address).write(buf);
                    } catch (err) {
                        PzpObject.emit("EXCEPTION","exception in sending message to pzh",err);
                    } finally {
                        logger.log ('send to hub - ' + address);
                        PzpObject.getConnectedPzh(address).resume();
                    }
                } else if (PzpObject.connectedWebApp.hasOwnProperty (address)) {
                    try {
                        PzpObject.connectedWebApp[address].socket.pause ();
                        PzpObject.connectedWebApp[address].sendUTF(jsonString);
                    } catch (err) {
                        logger.error ("exception in sending message to pzp - " + err);
                    } finally {
                        logger.log ('send to web app - ' + address + ' - Msg Len ' + jsonString.length);
                        PzpObject.connectedWebApp[address].socket.resume ();
                    }
                }
            } else if (PzpObject.checkConnectedPzh(PzpObject.getPzhId()) ) {
                PzpObject.sendMessage(message, PzpObject.getPzhId()); // If PZP is connected send to PZH, send to PZH...
            } else{
                logger.log("The app "+address+ " is not currently connected");
            }
        } else {
            PzpObject.emit("PARAM_MISSING", "message or address field are missing");
        }
    };
};
module.exports = PzpSendMessage;
