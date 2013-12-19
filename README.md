Webinos PZP
===========

A webinos personal zone enables communication between personal devices and services. A personal zone
comprises of two entities, a PZH (Personal Zone Hub) and PZP (Personal Zone Proxy). A PZH is an
entity that runs in the cloud and on publicly accessible IP address. A webinos-enabled device that
 supports running of the services is referred to as Personal Zone Proxy (PZP).

A PZP can connect to other PZPs in a personal zone. To achieve this, a PZP has to has to be enrolled
in a personal zone. Once enrolled, the PZP is capable of connecting to the PZH, connect to peers and
connect to devices outside the personal zone. A PZP can also be hosted on the cloud to provide
services across PZPs such as context database.

A PZP is a composition of different functionalities. It is a TLS Client to the PZH and Peer PZPs,
and hosts a TLS server to allow Peer PZPs to connect. It provides similar functionality as a PZH of
routing, policy enforcement, service discovery, and synchronization and is capable of running in the
cloud too. A PZP differs from a PZH, as it is capable of hosting services and executing the remote
RPC calls but cannot perform enrolling and revocation of a device in the personal zone.

All PZPs whether on device or in cloud should be ran as a daemon/service on a webinos-enabled device
so as to allow connections to other devices in the zone, when requested. A PZP has various modes of
operation, which define its authentication and other states. These modes include when device is not
enrolled in personal zone, connected to PZH, and connected to peers. PZPs also provide a set of user
preferences including port configurations, synchronisation and connection options.

## Start PZP :
    * node webinos_pzp.js
    * Options:
    ** "pzpHost"          : "External PZP HTTP Server Hostname (autodetect, fallback: 0.0.0.0)"
    ** "pzhHost"          : "Set the ip-address of the pzh provider"
    ** "friendlyName"     : "Sets the name assigned to the PZP such as PC/Mobile/TV"
    ** "forcedDeviceName" :"Forced PZP device name that you assign instead of the default PZP name"
    ** "widgetServer"     : "starts widget server"
    ** "policyEditor"     : "starts policy editor server"
    ** "signedWidgetOnly" : "only allow signed widgets"
    ** "enforceWidgetCSP" : "enforce content security policy on the widgets"
    ** "useWidgetProtocol": "use the wgt:// protocol when launching widgets"
    ** "test"             :"start the PZP and exit if it loaded successfully.  Useful for testing
    the build"
    ** "debug"            : "Enables verbose logging output."
    ** "help"             :"to get this help menu"

## Install new Webinos API:
    * Before starting webinos_pzp, npm install git://github.com/webinos/webinos-api-<api name>
    * Replace API name with your choice of API as listed on http://dev.webinos.org/specifications/api/

**Please Note**: If using a virtual machine to test PZP used option --forcedDeviceName as all
virtual machine set the same device name