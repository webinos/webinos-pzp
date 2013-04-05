function PeerCertificateExchange(PzpInstance) {
    var pzpPeer = this;
    var PzpSib = require("./pzp_SIB_auth.js");
    this.Sib = new PzpSib(PzpInstance);;
    this.sendtoClient = function(msg) {
        var appId;
        for(appId in PzpInstance.getConnectedWebApp()) {
            if(PzpObject.connectedWebApp.hasOwnProperty(appId)) {
                msg.to = appId;
                PzpObject.connectedWebApp[appId].sendUTF(JSON.stringify(msg));
            }
        }
    }
    this.sendPzpPeersToApp = function() {
        pzpPeer.peerDiscovery.findPzp(parent, 'zeroconf', PzpObject.getPorts().pzp_tlsServer, null, function(data){
            var payload = { "foundpeers": data};
            logger.log(data);
            var msg = PzpObject.prepMsg("", "pzpFindPeers", payload);
            PzpObject.sendtoClient(msg);
        });
    };


    this.handleMsg = function(parsed){
        var msg;
        if (parsed.query && parsed.query.cmd === "pubCert"){
            msg = JSON.parse(tmp.toString("utf8"));
            logger.log("got pubcert");
            //store the pub certificate and send own pub cert back
            PzpInstance.storeKeys(msg.payload.message.cert, "otherconn");
            PzpInstance.setConnectPeerAddress(msg.payload.message.addr);
            //send own public key out
            logger.log("exchange cert message sending to: " + msg.from);
            //save a local copy
            PzpInstance.storeKeys(PzpInstance.getConnectionCert(), "conn");
            vmsg= prepMsg("", "repubCert", {cert: PzpInstance.getConnectionCert() });
            response.writeHead(200, {"Content-Type": "application/json"});
            response.write(JSON.stringify(msg));
            response.end();
            msg = prepMsg("", "pubCert", { "pubCert": true});
            pzpPeer.sendtoClient(msg);
            return;
        }
        else if (parsed.query && parsed.query.cmd === "pzhCert"){
            if (!PzpInstance.getExternal().hasOwnProperty(parsed.query.from)) {
                msg = JSON.parse(tmp.toString("utf8"));
                logger.log("got pzhcert - storing external cert");
                PzpInstance.setExternal(msg.from, { cert: msg.payload.message.cert, crl: msg.payload.message.crl});
                logger.log("got pzhCert from:" + msg.from); //remember the other party

                if(!parent.config.exCertList.hasOwnProperty(msg.from)) {
                    var storepzp = {"exPZP" : msg.from};
                    parent.config.exCertList = storepzp;
                    parent.config.storeDetails(null, "exCertList", parent.config.exCertList);
                }

                //send own certificate back
                logger.log("exchange cert message sending to: " + msg.from);
                msg = prepMsg("", "replyCert", {cert: PzpInstance.getPzhCert(), crl: PzpInstance.getCrl()});
                response.writeHead(200, {"Content-Type": "application/json"});
                response.write(JSON.stringify(msg));
                response.end();
            }
            return;
        }
        else if(parsed.query && parsed.query.cmd === "requestRemoteScanner"){
            logger.log("got requestRemoteScanner");
            msg = prepMsg("", "requestRemoteScanner", { "requestRemoteScanner": true});
            pzpPeer.sendtoClient(msg);
            return;
        }
    }
    function getHashQR(cb) {
        var path = require ("path");
        var os = require("os");
        var infile = path.join(parent.config.metaData.webinosRoot, "keys", "conn.pem");


        if(os.platform().toLowerCase() == "android")  {
            try{
                var outfile = path.join("/data/data/org.webinos.app/node_modules/webinos/wp4/webinos/web_root", "testbed", "QR.png");
                parent.webinos_manager.Sib.createQRHash(infile, outfile, 200, 200, function(data){
                    logger.log("calling SIB create QR Hash");
                    cb(data);
                });
            } catch(e) {
                logger.error("Creating Hash QR for Android failed!" + e);
            }
        }
        else {
            try {
                parent.webinos_manager.Sib.createQRHash(infile, null, 0, 0, function(err, data){
                    if(err === null)
                        cb(data);
                    else
                        logger.log("createQRHash failed");
                });
            } catch (e) {
                logger.error("Creating Hash QR failed!" + e);
            }
        }
    }

    function checkHashQR(hash, cb) {
        var path = require ("path");
        var filename = path.join(parent.config.metaData.webinosRoot, "keys", "otherconn.pem");
        try {
            logger.log("android - check hash QR");
            Sib.checkQRHash(filename, hash, function(data){
                if(data)
                {
                    logger.log("Correct Hash is passed over");
                    cb(parent.pzp_state.connectingPeerAddr);
                }
                else
                {
                    logger.log("Wrong Hash key");
                    cb(null);
                }
            });
        } catch (e) {
            logger.error("Checking Hash QR Failed!" + e);
        }
    }

    function requestRemoteScanner(to) {
        if(to === "")
        {
            logger.error("No auth party is found - abort action!");
            return;
        }
        else
        {
            logger.log("requestRemoteScanner at: " + to);
            var msg = prepMsg(to, "requestRemoteScanner", {addr: parent.pzp_state.networkAddr});
            if(msg) {
                var options = {
                    host: to,
                    port: 8080,
                    path: '/testbed/client.html?cmd=requestRemoteScanner',
                    method: 'POST',
                    headers: {
                        'Content-Length': JSON.stringify(msg).length
                    }
                };
                var req = http.request(options, function (res) {
                    res.on('data', function (data) {
                    });
                });

                req.on('connect', function(){
                    callback(true);
                });

                req.on('error', function (err) {
                    callback(err);
                });

                req.write(JSON.stringify(msg));
                req.end();
            }
        }
    }

    function connectintra(message, callback) {
        var addr = message.payload.message.peer;
        var name = message.payload.message.name;
        logger.log("connecting to: " + addr + name);
        if(addr !== null)
        {
            var msg={};
            msg.address = addr;
            //fetch PZH id
            msg.name = parent.config.metaData.pzhId + "/" + name + "_Pzp";
            parent.pzpClient.connectPeer(msg);
        }
    }

    function exchangeCert(message, callback) {
        var to =  message.payload.message.peer;
        if(to !== null)
            parent.pzp_state.connectingPeerAddr = to; //remember the party that current is connecting to
        var msg = {};
        if(message.payload.status === "pubCert")
        {
            if(to === "")
                logger.log("please select the peer first");
            else
            {
                var msg = prepMsg(to, "pubCert", {cert: parent.config.cert.internal.conn.cert, addr: parent.pzp_state.networkAddr});
                logger.log("own address is: " + parent.pzp_state.networkAddr);

                // save a local copy - remove when connected
                var filename = "conn";
                parent.config.storeKeys(parent.config.cert.internal.conn.cert, filename);

                if(msg) {
                    var options = {
                        host: to,
                        port: 8080,
                        path: '/testbed/client.html?cmd=pubCert',
                        method: 'POST',
                        headers: {
                            'Content-Length': JSON.stringify(msg).length
                        }
                    };
                }
            }
        }
        else if(message.payload.status === "pzhCert")
        {
            to = parent.pzp_state.connectingPeerAddr;
            logger.log("exchange cert message sending to: " + to);
            if(to === "")
            {
                logger.error("Abort Certificate exchange - the other party's address is not available!");
                return;
            }
            else
            {
                logger.log("msg send to: " + to);
                var msg = prepMsg(to, "pzhCert", {cert: parent.config.cert.internal.master.cert, crl : parent.config.crl});
                if(msg) {
                    var options = {
                        host: to,
                        port: 8080,                              //pzp webserver port number
                        path: '/testbed/client.html?cmd=pzhCert',
                        method: 'POST',
                        headers: {
                            'Content-Length': JSON.stringify(msg).length
                        }
                    };
                }
            }
        }
        if(msg){
            var http = require ("http");
            var req = http.request(options, function (res) {
                var headers = JSON.stringify(res.headers);
                if((headers.indexOf("text/html")) !== -1)
                {
                    logger.log("wrong content type - do nothing.");
                    return;
                }
                res.setEncoding('utf8');
                var tmpdata = "";
                res.on('data', function (data) {
                    logger.log('BODY: ' + data);
                    tmpdata = tmpdata + data;
                    var n=data.indexOf("}}");  //check if data ends with }}
                    if (n !== -1)
                    {
                        logger.log(tmpdata);
                        var rmsg = JSON.parse("" + tmpdata);
                        if (rmsg.payload && rmsg.payload.status === "repubCert") {
                            logger.log("come to repubCert");
                            var filename = "otherconn";
                            parent.config.storeKeys(rmsg.payload.message.cert, filename);
                            //trigger Hash QR display
                            var payload = { "pubCert": true};
                            var msg = prepMsg("", "pubCert", { "pubCert": true});
                            sendtoClient(msg);
                        }
                        else if (rmsg.payload && rmsg.payload.status === "replyCert") {
                            logger.log("rmsg from: "  + rmsg.from);
                            parent.config.cert.external[rmsg.from] = { cert: rmsg.payload.message.cert, crl: rmsg.payload.message.crl};
                            parent.config.storeDetails(path.join("certificates","external"), "certificates", parent.config.cert.external);

                            if(!parent.config.exCertList.hasOwnProperty(rmsg.from)) {
                                var storepzp = {"exPZP" : rmsg.from};
                                parent.config.exCertList = storepzp;
                                parent.config.storeDetails(null, "exCertList", parent.config.exCertList);
                            }
                            var msg={};
                            logger.log("rmsg.from: " + rmsg.from);
                            msg.name = rmsg.from;
                            msg.address = parent.pzp_state.connectingPeerAddr;
                            parent.pzpClient.connectPeer(msg);
                        }
                    }
                });
            });

            req.on('connect', function(){
                callback(true);
            });

            req.on('error', function (err) {
                callback(err);
            });

            req.write(JSON.stringify(msg));
            req.end();
        }
    }
};

module.exports = PeerCertificateExchange;