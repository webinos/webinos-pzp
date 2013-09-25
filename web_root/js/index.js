$ (document).ready (function () {
    function logMessage (msg) {
        if (msg) {
            $ ('#message').append ('<li>' + msg + '</li>');
        }
    }
    window.onerror=function(msg, url, linenumber){
        $('#message').append('&nbsp;<b style="color:red">Error: </b>' + msg +' at line number ' + linenumber +'. Please raise issue at http://jira.webinos.org.')
        return true;
    };

    function setPage (type, page) {
        $.get (page, {}, function (reply) {
            $('#modalDisplay').show();
            $('#modalContents').html("<h1 align='center'>"+type+"</h1> " + reply + '<a href="#modalClose" id="modalClose"><img src="images/close.png"></a>');
            $ ("#modalClose").click (function () {
                $('#modalDisplay').hide();
            });
        }, "html");
    }

    function getLinks(){
        var options = {type: 'prop', payload: {status:'gatherTestPageLinks'}};
        webinos.session.message_send(options);
    }

    function setEnrolling () {
        if (webinos.session.getPZHId() === "") {
            $ ('#enroll-DeEnrollPzp').html ("<a href='#login' id='login' class='fill-div'> Enroll Device </a>");
            $ ("#login").click (function () {
                setPage ("Login to your PZH", "connectPzh.html");
            });
        }  else {
            $ ('#enroll-DeEnrollPzp').html ("<a href='#removePzp' id='removePzp'  class='fill-div'> Disconnect Device from Personal Zone </a>");
        }
    }

    function connectedDetails () {
        var connectedStatus, connectedDevices = webinos.session.getConnectedDevices(), text="Connected Devices:"; // all connected pzp
        $ ("#connectedDevices").html("");

        for (var i = 0; i < connectedDevices.length; i += 1) {
            if(!webinos.session.getPZHId()) {
                connectedStatus = (connectedDevices[i].isConnected === false) ? "#B0B0B0":"#FFFFFF";
                text += "<p style='color:"+connectedStatus+";text-align:left'>" +
                    webinos.session.getFriendlyName(connectedDevices[i].id) +
                    (connectedDevices[i] === webinos.session.getPZPId()?" (Your Device)": "")+"</p>";
            } else {
                connectedStatus = (connectedDevices[i].isConnected === false) ? "#B0B0B0":"#FFFFFF";
                text += "<p style='color:"+connectedStatus+";text-align:left'>" +
                    webinos.session.getFriendlyName(connectedDevices[i].id) +
                    (connectedDevices[i].id === webinos.session.getPZHId()?" (Your Hub)": "")+"</p>";
                if(connectedDevices[i].pzp){
                    for (var j=0; j < connectedDevices[i].pzp.length; j = j + 1) {
                        connectedStatus = (connectedDevices[i].pzp[j].isConnected === false) ? "#B0B0B0":"#FFFFFF";
                        text += "<p style='color:"+connectedStatus+";text-align:center'>" +
                            "<li>" + webinos.session.getFriendlyName(connectedDevices[i].pzp[j].id) +
                            (connectedDevices[i].pzp[j].id === webinos.session.getPZPId()?" (Your Device)": "")+"</li></p>";
                    }
                }
            }
        }
        $ ("#connectedDevices").html(text);
        setEnrolling ();
    }

    function fillPZAddrs () {
        logMessage ('registeredBrowser msg from ' + webinos.session.getFriendlyName(webinos.session.getPZPId ()));
        $ ("#title").html ("Welcome to your "+webinos.session.getFriendlyName(webinos.session.getPZPId()));
        connectedDetails();
        getLinks();
    }
    webinos.session.addListener ('registeredBrowser', fillPZAddrs);
    webinos.session.addListener ('update', connectedDetails);

    function webinosVersion (msg) {
        var currentVersion = msg.payload.message;
        if (typeof currentVersion === "object") {
            $ ("#webinosVersion").html ("Webinos Version: "+currentVersion.tag+"."+currentVersion.num_commit +
                "(CommitId-"+ currentVersion.commit_id+")");
        } else {
            $ ("#webinosVersion").html ("Webinos Version: "+currentVersion);
        }
    }
    webinos.session.addListener ('webinosVersion', webinosVersion);

    function pzhDisconnected () {
        setEnrolling ();
        logMessage ("pzp disconnected from pzh, will try connecting back");
    }
    webinos.session.addListener ('pzhDisconnected', pzhDisconnected);

    function printInfo (data) {
        logMessage (data.payload.message);
    }
    webinos.session.addListener ('info', printInfo);

    function error (msg) {
        logMessage ("ERROR :"+ msg.payload.message);
    }
    webinos.session.addListener ('error', error);

    function callSetPage(event){
        setPage(event.data.param1, event.data.param2);
    }
    function generateLinks(msg) {
        $ ("#api").html("");
        for (var i =0 ; i < msg.payload.message.length; i = i + 1){
            $('<div class="eachElement"> <a href="javascript:;" class="fill-div">'+msg.payload.message[i].name+'</a> </div>')
                .click({param1:msg.payload.message[i].name, param2: msg.payload.message[i].link}, callSetPage)
                .appendTo("#APILinks");
        }
    }
    webinos.session.addListener('gatherTestPageLinks', generateLinks);

    $("#removePzp").click(function(){
        if(webinos.session.getPZHId() !== "") { // That means we are enrolled to atleast 1 PZH
            var sure = confirm("Are you sure you want to reset device?");
            if (sure) {
                var options = {type: 'prop', payload: {status:'resetDevice'}};
                webinos.session.message_send(options);
            }
        } else {
            setEnrolling();
        }
    });

    $ ('#status').mouseenter (function () {
        var that = $ (this);
        var right = that.css ("right");
        that.css ("right", (right === "0px") ? "" : "0px");
    });

    $ ("#testService").click (function () {
        setPage("Test API Demo", "testbed/test.html");
    });

    $ ("#pzpLocalDiscovery").click (function () {
        setPage("Webinos Pzp Local Discovery", "./peerDiscovery.html");
    });

    $ ("#fetchConfiguration").click (function () {
        setPage("Set Webinos Configuration", "./config.html");
    });

    $ ("#modalClose").click (function () {
        $('#modalDisplay').hide();
    });
});