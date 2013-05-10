var mandatoryModule = ["webinos-utilities",
    "webinos-certificateHandler",
    "webinos-messaging",
    "webinos-jsonrpc2",
    "webinos-api-serviceDiscovery",
    "webinos-api-test",
    "webinos-messaging"
];
var optionalModule = ["webinos-synchronization",
    "webinos-policy"
];
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
  "messageHandler": require("webinos-messaging").MessageHandler,
  "rpc"         : require("webinos-jsonrpc2"),
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
