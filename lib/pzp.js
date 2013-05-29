var mandatoryModule = ["webinos-utilities",
    "webinos-certificateHandler",
    "webinos-messaging",
    "webinos-jsonrpc2",
    "webinos-api-serviceDiscovery",
    "webinos-api-serviceManagement",
    "webinos-api-test",
    "webinos-policy",
    "webinos-messaging"
];
var optionalModule = ["webinos-synchronization"];
mandatoryModule.forEach(function(name) {
    if (!require.resolve(name)) {
        throw new Error("Webinos PZP mandatory module "+ name + " is missing, these modules are compulsory for PZP to run. " +
            "Please run npm install "+name+" at command prompt to proceed");
    }
});

optionalModule.forEach(function(name) {
    try {
      require(name);
    } catch(err){
        console.log("Webinos PZP optional module "+ name + " is missing, PZP will run  but functionality provided by "+
            name + " will be missing");
    }    
});
module.exports = {
  "wUtil"       : require("webinos-utilities"),
  "wCertificate": require("webinos-certificateHandler"),
  "discovery"   : require("webinos-api-serviceDiscovery").Service,
  "serviceManagement" : require("webinos-api-serviceManagement").Service,
  "messageHandler": require("webinos-messaging").MessageHandler,
  "rpc"         : require("webinos-jsonrpc2"),
  "session"     : require("./pzp_sessionHandling"),
  "PzpDiscovery": require ("./pzp_peerDiscovery"),
  "PzpSib"      : require("./pzp_SIB_auth"),
  "certExchange": require("./pzp_peerCertificateExchange.js"),
  "os"          : require("os"),
  "https"       : require('https'),
  "http"        : require ("http"),
  "path"        : require("path"),
  "fs"          : require("fs"),
  "tls"         : require("tls"),
  "url"         : require("url"),
  "net"         : require("net"),
  "WebSocketServer":require ("websocket").server,
  "mandatoryModule":mandatoryModule

};
