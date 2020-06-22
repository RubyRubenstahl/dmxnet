'use strict';
// Load dmxnet as libary
var ArtNet = require('../src');
// Create new dmxnet instance
var artnet = new ArtNet({});
// Create new Sender instance


var sender = artnet.createSender({
  ip: '255.255.255.255',
  subnet: 0,
  universe: 0,
  net: 0,
});
// Set Channels
sender.setChannel(0, 0);
sender.setChannel(0, 128);
sender.transmit();
// Fill Channels
sender.fillChannels(1, 20, 10);
// Prepare Channel 26+27 after 10 s and send next secondly
