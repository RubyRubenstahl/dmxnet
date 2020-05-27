const { isBroadcast } = require("./helpers");
var dgram = require("dgram");
var EventEmitter = require("events");
const jspack = require('jspack').jspack
// ArtDMX Header for jspack
const ArtDmxHeaderFormat = "!7sBHHBBBBH";
// ArtDMX Payload for jspack
const ArtDmxPayloadFormat = "512B";

/**
 * Class representing a sender
 */
class Sender extends EventEmitter {
  /**
   * Creates a new sender, usually called trough factory in dmxnet
   *
   * @param {object} opt - Options for the sender
   * @param {dmxnet} parent - Instance of the dmxnet parent
   */
  constructor(opt, parent) {
    super();
    // save parent object
    this.parent = parent;

    this.socket_ready = false;
    // set options
    var options = opt || {};
    this.net = options.net || 0;
    this.subnet = options.subnet || 0;
    this.universe = options.universe || 0;
    this.subuni = options.subuni;
    this.ip = options.ip || "255.255.255.255";
    this.port = options.port || 6454;
    this.verbose = this.parent.verbose;
    this.base_refresh_interval = options.base_refresh_interval || 1000;

    // Validate Input
    if (this.net > 127) {
      throw new Error("Invalid Net, must be smaller than 128");
    }
    if (this.universe > 15) {
      throw new Error("Invalid Universe, must be smaller than 16");
    }
    if (this.subnet > 15) {
      throw new Error("Invalid subnet, must be smaller than 16");
    }
    if (this.net < 0 || this.subnet < 0 || this.universe < 0) {
      throw new Error("Subnet, Net or Universe must be 0 or bigger!");
    }
    this.emit("started", JSON.stringify(options));
    // init dmx-value array
    this.values = [];
    // fill all 512 channels
    for (var i = 0; i < 512; i++) {
      this.values[i] = 0;
    }
    // Build Subnet/Universe/Net Int16
    if (!this.subuni) {
      this.subuni = (this.subnet << 4) | this.universe;
    }
    // ArtDmxSeq
    this.ArtDmxSeq = 1;

    // Create Socket
    this.socket = dgram.createSocket("udp4");

    // Check IP and Broadcast
    if (isBroadcast(this.ip)) {
      this.socket.bind(() => {
        this.socket.setBroadcast(true);
        this.socket_ready = true;
      });
    } else {
      this.socket_ready = true;
    }
    // Transmit first Frame
    this.transmit();

    // Send Frame every base_refresh_interval ms - even if no channel was changed
    this.interval = setInterval(() => {
      this.transmit();
    }, this.base_refresh_interval);
  }

  /**
   * Transmits the current values
   */
  transmit() {
    // Only transmit if socket is ready
    if (this.socket_ready) {
      if (this.ArtDmxSeq > 255) {
        this.ArtDmxSeq = 1;
      }
      // Build packet: ID Int8[8], OpCode Int16 0x5000 (conv. to 0x0050),
      // ProtVer Int16, Sequence Int8, PhysicalPort Int8,
      // SubnetUniverseNet Int16, Length Int16
      var udppacket = Buffer.from(
        jspack.Pack(
          ArtDmxHeaderFormat + ArtDmxPayloadFormat,
          [
            "Art-Net",
            0,
            0x0050,
            14,
            this.ArtDmxSeq,
            0,
            this.subuni,
            this.net,
            512,
          ].concat(this.values)
        )
      );
      // Increase Sequence Counter
      this.ArtDmxSeq++;
      this.emit("frame_sending", { node: this, data: udppacket });

      // Send UDP
      var client = this.socket;
      client.send(udppacket, 0, udppacket.length, this.port, this.ip, (err) => {
        if (err) throw err;
        this.emit("frame_sent", { node: this, data: udppacket });
      });
    }
  }

  /**
   * Sets a single channel to a value and transmits the change
   *
   * @param {number} channel - channel (0-511)
   * @param {number} value - value (0-255)
   */
  setChannel(channel, value) {
    if (channel > 511 || channel < 0) {
      throw new Error("Channel must be between 0 and 512");
    }
    if (value > 255 || value < 0) {
      throw new Error("Value must be between 0 and 255");
    }
    this.values[channel] = value;
    this.transmit();
  }

  /**
   * Prepares a single channel (without transmitting)
   *
   * @param {number} channel - channel (0-511)
   * @param {number} value - value (0-255)
   */
  prepChannel(channel, value) {
    if (channel > 511 || channel < 0) {
      throw new Error("Channel must be between 0 and 512");
    }
    if (value > 255 || value < 0) {
      throw new Error("Value must be between 0 and 255");
    }
    this.values[channel] = value;
  }

  /**
   * Fills channel block with a value and transmits the change
   *
   * @param {number} start - start of the block
   * @param {number} stop - end of the block (inclusive)
   * @param {number} value - value
   */
  fillChannels(start, stop, value) {
    if (start > 511 || start < 0) {
      throw new Error("Channel must be between 0 and 512");
    }
    if (stop > 511 || stop < 0) {
      throw new Error("Channel must be between 0 and 512");
    }
    if (value > 255 || value < 0) {
      throw new Error("Value must be between 0 and 255");
    }
    for (var i = start; i <= stop; i++) {
      this.values[i] = value;
    }
    this.transmit();
  }

  /**
   * Resets all channels to zero and Transmits
   */
  reset() {
    // Reset all 512 channels of the sender to zero
    for (var i = 0; i < 512; i++) {
      this.values[i] = 0;
    }
    this.transmit();
  }

  /**
   * Stops the sender and destroys it
   */
  stop() {
    clearInterval(this.interval);
    this.parent.senders = this.parent.senders.filter(function(value) {
      if (value === this) {
        return false;
      }
      return true;
    });
    this.socket.close();
  }
}

module.exports = Sender;
