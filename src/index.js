var EventEmitter = require("events");
var dgram = require("dgram");
const os = require("os");
const Netmask = require("netmask").Netmask;
const Sender = require('./sender');
const Receiver = require("./receiver");
const parseArtnetPacket = require('./parser');
const jspack = require('jspack').jspack;

class ArtNet extends EventEmitter {
  /**
   * Creates a new dmxnet instance
   *
   * @param {object} options - Options for the whole instance
   */
  constructor(options) {
    super();
    // Parse all options and set defaults
    this.verbose = options.verbose || 0;
    this.oem = options.oem || 0x2908; // OEM code hex
    this.port = options.port || 6454; // Port listening for incoming data
    this.sName = options.sName || "dmxnet"; // Shortname
    this.lName = options.lName || "dmxnet - OpenSource ArtNet Transceiver"; // Longname

    // Get all network interfaces
    this.interfaces = os.networkInterfaces();
    this.ip4 = [];
    this.ip6 = [];
    // Iterate over interfaces and insert sorted IPs
    Object.keys(this.interfaces).forEach((key) => {
      this.interfaces[key].forEach((val) => {
        if (val.family === "IPv4") {
          var netmask = new Netmask(val.cidr);
          this.ip4.push({
            ip: val.address,
            netmask: val.netmask,
            mac: val.mac,
            broadcast: netmask.broadcast,
          });
        }
      });
    });
    // init artPollReplyCount
    this.artPollReplyCount = 0;
    // Array containing reference to foreign controllers
    this.controllers = [];
    // Array containing reference to foreign node's
    this.nodes = [];
    // Array containing reference to senders
    this.senders = [];
    // Array containing reference to receiver objects
    this.receivers = [];
    // Object containing reference to receivers by SubnetUniverseNet
    this.receiversSubUni = {};
    // Timestamp of last Art-Poll send
    this.last_poll;
    // Create listener for incoming data
    if (!Number.isInteger(this.port)) throw new Error("Invalid Port");
    this.listener4 = dgram.createSocket({
      type: "udp4",
      reuseAddr: true,
    });
    // ToDo: IPv6
    // ToDo: Multicast
    // Catch Socket errors
    this.listener4.on("error", function(err) {
      throw new Error("Socket error: ", err);
    });
    // Register listening object
    this.listener4.on("message", (msg, rinfo) => {
      parseArtnetPacket(msg, rinfo, this);
    });
    // Start listening
    this.listener4.bind(this.port);
    this.emit("listening", this.port);

    // Open Socket for sending broadcast data
    this.socket = dgram.createSocket("udp4");
    this.socket.bind(() => {
      this.socket.setBroadcast(true);
      this.socket_ready = true;
    });
    // Periodically check Controllers
    setInterval(() => {
      if (this.controllers) {
        for (var index = 0; index < this.controllers.length; index++) {
          if (
            new Date().getTime() -
              new Date(this.controllers[index].last_poll).getTime() >
            60000
          ) {
            this.emit("controller_lost", this.controllers.index);
            this.controllers[index].alive = false;
          }
        }
      }
    }, 30000);
    return this;
  }

  /**
   * Returns a new sender instance
   *
   * @param {object} options - Options for the new sender
   * @returns {sender} - Instance of Sender
   */
  createSender(options) {
    var s = new Sender(options, this);
    this.senders.push(s);
    this.ArtPollReply();
    return s;
  }

  /**
   * Returns a new receiver instance
   *
   * @param {object} options - Options for the new receiver
   * @returns {receiver} - Instance of Receiver
   */
  createReceiver(options) {
    var r = new Receiver(options, this);
    this.receivers.push(r);
    this.ArtPollReply();
    return r;
  }

  /**
   * Builds and sends an ArtPollReply-Packet
   */
  ArtPollReply() {
    this.emit("sending_artpoll_reply", { node: this });

    this.ip4.forEach((ip) => {
      // BindIndex handles all the different "instance".
      var bindIndex = 1;
      var ArtPollReplyFormat = "!7sBHBBBBHHBBHBBH18s64s64sH4B4B4B4B4B3HB6B4BBB";
      var netSwitch = 0x01;
      var subSwitch = 0x01;
      var status = 0b11010000;
      var stateString =
        "#0001 [" +
        ("000" + this.artPollReplyCount).slice(-4) +
        "] dmxnet ArtNet-Transceiver running";
      var sourceip = ip.ip;
      var broadcastip = ip.broadcast;
      // one packet for each sender
      this.senders.forEach((s) => {
        var portType = 0b01000000;
        var udppacket = Buffer.from(
          jspack.Pack(ArtPollReplyFormat, [
            "Art-Net",
            0,
            0x0021,
            // 4 bytes source ip + 2 bytes port
            sourceip.split(".")[0],
            sourceip.split(".")[1],
            sourceip.split(".")[2],
            sourceip.split(".")[3],
            this.port,
            // 2 bytes Firmware version, netSwitch, subSwitch, OEM-Code
            0x0001,
            s.net,
            s.subnet,
            this.oem,
            // Ubea, status1, 2 bytes ESTA
            0,
            status,
            0,
            // short name (18), long name (63), stateString (63)
            this.sName.substring(0, 16),
            this.lName.substring(0, 63),
            stateString,
            // 2 bytes num ports, 4*portTypes
            1,
            portType,
            0,
            0,
            0,
            // 4*goodInput, 4*goodOutput
            0b10000000,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            // 4*SW IN, 4*SW OUT
            s.universe,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            // 5* deprecated/spare, style
            0,
            0,
            0,
            0x01,
            // MAC address
            parseInt(ip.mac.split(":")[0], 16),
            parseInt(ip.mac.split(":")[1], 16),
            parseInt(ip.mac.split(":")[2], 16),
            parseInt(ip.mac.split(":")[3], 16),
            parseInt(ip.mac.split(":")[4], 16),
            parseInt(ip.mac.split(":")[5], 16),
            // BindIP
            sourceip.split(".")[0],
            sourceip.split(".")[1],
            sourceip.split(".")[2],
            sourceip.split(".")[3],
            // BindIndex, Status2
            bindIndex,
            0b00001110,
          ])
        );
        // Increase bindIndex
        bindIndex++;
        if (bindIndex > 255) {
          bindIndex = 1;
        }
        // Send UDP
        var client = this.socket;
        client.send(
          udppacket,
          0,
          udppacket.length,
          6454,
          broadcastip,
          (err) => {
            if (err) throw err;
            this.emit("debug", "ArtPollReply frame sent");
          }
        );
      });
      // Send one package for every receiver
      this.receivers.forEach((r) => {
        var portType = 0b10000000;
        var udppacket = Buffer.from(
          jspack.Pack(ArtPollReplyFormat, [
            "Art-Net",
            0,
            0x0021,
            // 4 bytes source ip + 2 bytes port
            sourceip.split(".")[0],
            sourceip.split(".")[1],
            sourceip.split(".")[2],
            sourceip.split(".")[3],
            this.port,
            // 2 bytes Firmware version, netSwitch, subSwitch, OEM-Code
            0x0001,
            r.net,
            r.subnet,
            this.oem,
            // Ubea, status1, 2 bytes ESTA
            0,
            status,
            0,
            // short name (18), long name (63), stateString (63)
            this.sName.substring(0, 16),
            this.lName.substring(0, 63),
            stateString,
            // 2 bytes num ports, 4*portTypes
            1,
            portType,
            0,
            0,
            0,
            // 4*goodInput, 4*goodOutput
            0,
            0,
            0,
            0,
            0b10000000,
            0,
            0,
            0,
            // 4*SW IN, 4*SW OUT
            0,
            0,
            0,
            0,
            r.universe,
            0,
            0,
            0,
            // 5* deprecated/spare, style
            0,
            0,
            0,
            0x01,
            // MAC address
            parseInt(ip.mac.split(":")[0], 16),
            parseInt(ip.mac.split(":")[1], 16),
            parseInt(ip.mac.split(":")[2], 16),
            parseInt(ip.mac.split(":")[3], 16),
            parseInt(ip.mac.split(":")[4], 16),
            parseInt(ip.mac.split(":")[5], 16),
            // BindIP
            sourceip.split(".")[0],
            sourceip.split(".")[1],
            sourceip.split(".")[2],
            sourceip.split(".")[3],
            // BindIndex, Status2
            bindIndex,
            0b00001110,
          ])
        );
        // Increase bindIndex
        bindIndex++;
        if (bindIndex > 255) {
          bindIndex = 1;
        }
        // Send UDP
        var client = this.socket;
        client.send(
          udppacket,
          0,
          udppacket.length,
          6454,
          broadcastip,
          (err) => {
            if (err) throw err;
            this.emit("artpoll_frame_reply_sent", { node: this });
          }
        );
      });
      if (this.senders.length + this.receivers.length < 1) {
        // No senders and receivers available, propagate as "empty"
        var udppacket = Buffer.from(
          jspack.Pack(ArtPollReplyFormat, [
            "Art-Net",
            0,
            0x0021,
            // 4 bytes source ip + 2 bytes port
            sourceip.split(".")[0],
            sourceip.split(".")[1],
            sourceip.split(".")[2],
            sourceip.split(".")[3],
            this.port,
            // 2 bytes Firmware version, netSwitch, subSwitch, OEM-Code
            0x0001,
            netSwitch,
            subSwitch,
            this.oem,
            // Ubea, status1, 2 bytes ESTA
            0,
            status,
            0,
            // short name (18), long name (63), stateString (63)
            this.sName.substring(0, 16),
            this.lName.substring(0, 63),
            stateString,
            // 2 bytes num ports, 4*portTypes
            0,
            0,
            0,
            0,
            0,
            // 4*goodInput, 4*goodOutput
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            // 4*SW IN, 4*SW OUT
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            // 5* deprecated/spare, style
            0,
            0,
            0,
            0x01,
            // MAC address
            parseInt(ip.mac.split(":")[0], 16),
            parseInt(ip.mac.split(":")[1], 16),
            parseInt(ip.mac.split(":")[2], 16),
            parseInt(ip.mac.split(":")[3], 16),
            parseInt(ip.mac.split(":")[4], 16),
            parseInt(ip.mac.split(":")[5], 16),
            // BindIP
            sourceip.split(".")[0],
            sourceip.split(".")[1],
            sourceip.split(".")[2],
            sourceip.split(".")[3],
            // BindIndex, Status2
            1,
            0b00001110,
          ])
        );
        this.emit("packet_sent", { node: this, data: udppacket });
        // Send UDP
        var client = this.socket;
        client.send(
          udppacket,
          0,
          udppacket.length,
          6454,
          broadcastip,
          (err) => {
            if (err) throw err;
            this.emit("artpoll_reply_frame_sent", {node:this});
          }
        );
      }
    });
    this.artPollReplyCount++;
    if (this.artPollReplyCount > 9999) {
      this.artPollReplyCount = 0;
    }
  }
}

module.exports = ArtNet;