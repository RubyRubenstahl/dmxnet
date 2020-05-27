'use strict';
// Load dmxnet as libary
var ArtNet = require('../src');
// Create new dmxnet instance
var artnet = new ArtNet({});
// Create new Sender instance


var sender = artnet.newSender({
  ip: '10.7.240.66',
  subnet: 0,
  universe: 0,
  net: 0,
});
// Set Channels
sender.setChannel(0, 100);
sender.setChannel(1, 128);
// Fill Channels
sender.fillChannels(1, 20, 10);
// Prepare Channel 26+27 after 10 s and send next secondly
setTimeout(function() {
  sender.prepChannel(25, 255);
  sender.prepChannel(26, 255);
  sender.transmit();
}, 10000);
// Stop sender after 5 seconds
setTimeout(function() {
  sender.stop();
}, 50000);
