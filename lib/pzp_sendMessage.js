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
var PzpReceiveMessage = require("./pzp_receiveMessage.js");

var PzpSendMessage = function () {
    "use strict";
    console.log("sendMessage");
    PzpReceiveMessage.call(this);
    var PzpCommon = require("./pzp.js");
    var PzpObject = this;
    var logger    = PzpCommon.wUtil.webinosLogging(__filename) || console;

    PzpObject.setInternalParams = function(id) {
        try {
            var to;
            if(id === PzpObject.getSessionId()) {
                id = PzpObject.getFriendlyName(); // Special case of findServices
            } else if (PzpObject.getConnectedPzp()[id] && PzpObject.getConnectedPzp()[id].friendlyName) {
                id = PzpObject.getConnectedPzp()[id].friendlyName;
            } else if (PzpObject.getConnectedPzh()[id] && PzpObject.getConnectedPzh()[id].friendlyName) {
                id = PzpObject.getConnectedPzh()[id].friendlyName;
            } else if (PzpObject.getConnectedApp[id]) {
                to = (id && id.split("/") && id.split("/").length === 2) ? id.split("/")[1] : id.split("/")[2];
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
    }

    PzpObject.setOriginalId = function(id) {
        try {
            if (id) {
                var matchId= id && id.split("/") && id.split("/")[0], key, i;
                if(matchId === PzpObject.getFriendlyName()) {
                    id = (id.split('/').length > 1) ? (PzpObject.getSessionId() +"/"+ id.split('/')[1]) : PzpObject.getSessionId();
                } else {
                    var list = [PzpObject.getConnectedPzp(),
                                PzpObject.getConnectedPzh(),
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
    }
	
	/**
    * Send updates about connected devices
    */
    PzpObject.sendUpdateToAll = function(id) {
        function getConnectedList(type) {
            var connList=[],key, list = (type === "pzp") ? config.trustedList.pzp: config.trustedList.pzh;
            for (key in list) {
                if (list.hasOwnProperty(key) && key !== id) {
                    connList.push({friendlyName: list[key].friendlyName, key: key});
                }
            }
            return connList;
        }
		if (PzpObject.getEnrolledStatus()) {
			var key,msg, payload = {connectedPzp: getConnectedList("pzp"),
				connectedPzh: getConnectedList("pzh")};
			if (payload.connectedPzh.length >= 1 || payload.connectedPzp.length >= 1) {
			  for (key in pzpState.connectedPzp) {
				if (pzpState.connectedPzp.hasOwnProperty(key) && key !== id) {
					PzpObject.prepMsg(key, "update", payload);
				}
			  }
			}
		}	
    };
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
        if (message && address) {
            var jsonString = JSON.stringify (message);
            var buf = PzpCommon.wUtil.webinosMsgProcessing.jsonStr2Buffer (jsonString);
            if (PzpObject.checkConnectedPzp(address)
                && pzpState.state["peer"] === "connected") {
                try {
                    PzpObject.getConnectedPzp[address].pause();
                    PzpObject.getConnectedPzp[address].write(buf);
                } catch (err) {
                    PzpObject.emit("EXCEPTION","exception in sending message to pzp",err);
                } finally {
                    logger.log ('send to pzp - ' + address + ' message ' + jsonString);
                    PzpObject.getConnectedPzp[address].resume ();
                }
            } else if (PzpObject.checkConnectedPzp(address)
                && PzpObject.getEnrolledStatus() && pzpState.state["hub"] === "connected") {
                try {
                    PzpObject.getConnectedPzh[address].resume ();
                    PzpObject.getConnectedPzh[address].pause();
                    PzpObject.getConnectedPzh[address].write(buf);
                } catch (err) {
                    PzpObject.emit("EXCEPTION","exception in sending message to pzh",err);
                } finally {
                    logger.log ('send to hub - ' + address + ' message ' + jsonString);
                    PzpObject.getConnectedPzh[address].resume ();
                }
            } else { // sending to the app
                PzpObject.sendConnectedApp(address, message);
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
        var key;
        var connectedPzp = Object.keys(PzpObject.getConnectedPzp());
        var connectedPzh = Object.keys(PzpObject.getConnectedPzh());
        connectedPzp.forEach(function(name) {
            PzpObject.prepMsg(name, command, payload);
        });
        connectedPzh.forEach(function(name) {
            PzpObject.prepMsg(name, command, payload);
        });
    };
};
require("util").inherits(PzpSendMessage, PzpReceiveMessage);
module.exports = PzpSendMessage;
