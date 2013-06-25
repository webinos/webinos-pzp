#!/usr/bin/env node
var fs = require("fs");
var path  = require("path");
var nodemodule_Dir, webroot_Dir, wrt_Dir, webinosJS, data, fileList;
console.log("starting to create webinosJS");
nodemodule_Dir = path.resolve(__dirname, "./node_modules");
webroot_Dir = path.resolve(__dirname, "./web_root");
wrt_Dir = path.resolve(__dirname, "./wrt"); // To read webinos.js and webinos.session.js
fs.writeFileSync(path.join(webroot_Dir, "webinos.js"),""); // Overwrite/create file
webinosJS = fs.createWriteStream(path.join(webroot_Dir, "webinos.js"), { flags:"a", encoding:"utf8"});

//Prevent loading webinos.js more than once
webinosJS.write("if(typeof webinos === 'undefined'){\n");

var mandatoryWebinosJS=[path.join(nodemodule_Dir,"webinos-jsonrpc2","lib","registry.js"),
    path.join(nodemodule_Dir,"webinos-jsonrpc2","lib","rpc.js"),
    path.join(nodemodule_Dir,"webinos-messaging","lib","messagehandler.js"),
    path.join(wrt_Dir,"webinos.session.js"),
    path.join(nodemodule_Dir,"webinos-api-serviceDiscovery","wrt","webinos.servicedisco.js"),
    path.join(wrt_Dir,"webinos.js")
];
mandatoryWebinosJS.forEach(function(name){
    data = fs.readFileSync(name);
    webinosJS.write(data.toString());
});

// Gather folders starting with webinos-api
fileList = fs.readdirSync(nodemodule_Dir);
for (i = 0; i < fileList.length; i = i + 1) {
    if(fileList[i].indexOf("webinos-api") !== -1){
        fileName = fs.readdirSync(path.resolve(nodemodule_Dir, fileList[i], "wrt"));
        for (j=0; j < fileName.length; j = j + 1) {
            if (fileList[i] !== "webinos-api-serviceDiscovery") {
                stat = fs.statSync(path.resolve(nodemodule_Dir, fileList[i], "wrt", fileName[j]));
                if (stat.isFile()) {
                    try {
                        data = fs.readFileSync(path.resolve(nodemodule_Dir, fileList[i], "wrt", fileName[j]));
                        webinosJS.write(data.toString());
                    } catch(err) {
                        console.log("Webinos module without client side code. Via Web RunTime you will not be able to access module "+ fileList[i]);
                    }
                }
            }
        }
    }
}

//Prevent loading webinos.js more than once, closing bracket
webinosJS.write("\n}");

console.log("created webinosJS");