var jspack = require("jspack").jspack;

// Parser & receiver
var dataParser = function(msg, rinfo, parent) {
  parent.emit("udp_packet_received", { node: parent, from: rinfo, data: msg });
  if (rinfo.size < 10) {
    this.emit("error", { node: parent, error: new Error("Payload too short") });
    return;
  }
  // Check first 8 bytes for the "Art-Net" - String
  if (String(jspack.Unpack("!8s", msg)) !== "Art-Net\u0000") {
    parent.emit("error", { node: parent, error: new Error("Invalid header") });
    return;
  }
  var opcode = parseInt(jspack.Unpack("B", msg, 8), 10);
  opcode += parseInt(jspack.Unpack("B", msg, 9), 10) * 256;
  if (!opcode || opcode === 0) {
    parent.emit("error", {
      node: parent,
      error: new Error("Invalid header", { opcode }),
    });
    return;
  }
  switch (opcode) {
    case 0x5000:
      parent.emit("artdmx_detected", { node: parent });
      var universe = parseInt(jspack.Unpack("H", msg, 14), 10);
      var data = [];
      for (var ch = 1; ch <= msg.length - 18; ch++) {
        data.push(msg.readUInt8(ch + 17, true));
      }
      parent.emit("debug", {
        node: parent,
        message: "'Received frame for SubUniNet 0x' + universe.toString(16)",
      });
      parent.emit("debug", {
        node: parent,
        message: "Received frame for SubUniNet 0x" + universe.toString(16),
      });
      if (parent.receiversSubUni[universe]) {
        parent.receiversSubUni[universe].receive(data);
      }
      break;
    case 0x2000:
      if (rinfo.size < 14) {
        parent.emit("error", {
          node: parent,
          error: new Error("ArtPoll too small"),
        });
        return;
      }
      parent.emit("detected_artpoll", { node: this });

      // Parse Protocol version
      var proto = parseInt(jspack.Unpack("B", msg, 10), 10);
      proto += parseInt(jspack.Unpack("B", msg, 11), 10) * 256;
      if (!proto || proto < 14) {
        parent.emit("error", new Error("Invalid OpCode"));
        return;
      }
      // Parse TalkToMe
      var ctrl = {
        ip: rinfo.address,
        family: rinfo.family,
        last_poll: Date(),
        alive: true,
      };
      var ttm_raw = parseInt(jspack.Unpack("B", msg, 12), 10);
      ctrl.diagnostic_unicast = (ttm_raw & 0b00001000) > 0;
      ctrl.diagnostic_enable = (ttm_raw & 0b00000100) > 0;
      ctrl.unilateral = (ttm_raw & 0b00000010) > 0;
      // Priority
      ctrl.priority = parseInt(jspack.Unpack("B", msg, 13), 10);
      // Insert into controller's reference
      var done = false;
      for (var index = 0; index < parent.controllers.length; ++index) {
        if (parent.controllers[index].ip === rinfo.address) {
          done = true;
          parent.controllers[index] = ctrl;
        }
      }
      if (done !== true) {
        parent.controllers.push(ctrl);
      }
      parent.ArtPollReply();
      parent.emit("controllers_found ", {
        node: parent,
        controllers: parent.controllers,
      });
      break;
    case 0x2100:
      // ToDo
      parent.emit("art_poll_reply", { node: parent });
      break;
    default:
      parent.emit("warning", {
        node: parent,
        message: "OpCode not implemented",
      });
  }
};


module.exports = dataParser;