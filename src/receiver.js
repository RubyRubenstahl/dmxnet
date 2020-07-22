var EventEmitter = require("events");


/**
 *  Object representing a receiver-instance
 */
class Receiver extends EventEmitter {
  /**
   * Creates a new receiver, usually called trough factory in dmxnet
   *
   * @param {object} opt - Options for the receiver
   * @param {dmxnet} parent - Instance of the dmxnet parent
   */
  constructor(opt, parent) {
    super();
    // save parent object
    this.parent = parent;

    // set options
    var options = opt || {};
    this.net = options.net || 0;
    this.subnet = options.subnet || 0;
    this.universe = options.universe || 0;
    this.subuni = options.subuni;
    this.verbose = this.parent.verbose;

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

    parent.emit("sender_started", this);

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
    this.subuninet = (this.subuni << 8) | this.net;
    // Insert this object into the map
    parent.receiversSubUni[this.subuninet] = this;
  }

  /**
   * Handles received data
   *
   * @param {Array} data - Data from received ArtDMX
   */
  receive(data) {
    this.values = data;
    this.emit("data", data);
  }

}

module.exports = Receiver