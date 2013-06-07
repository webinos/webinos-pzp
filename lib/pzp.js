var mandatoryModule = ["webinos-utilities",
    "webinos-certificateHandler",
    "webinos-messaging",
    "webinos-jsonrpc2",
    "webinos-api-serviceDiscovery",
    "webinos-api-test",
    "webinos-messaging",
    "webinos-policy",
    "webinos-synchronization"
];

mandatoryModule.forEach(function(name) {
    if (!require.resolve(name)) {
        throw new Error("Webinos PZP mandatory module "+ name + " is missing, these modules are compulsory for PZP to run. " +
            "Please run npm install "+name+" at command prompt to proceed");
    }
});

module.exports = {
  "wUtil"       : require("webinos-utilities"),
  "wCertificate": require("webinos-certificateHandler"),
  "discovery"   : require("webinos-api-serviceDiscovery").Service,
  "messageHandler": require("webinos-messaging").MessageHandler,
  "rpc"         : require("webinos-jsonrpc2"),
  "certExchange": require("./pzp_peerCertificateExchange"),
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
