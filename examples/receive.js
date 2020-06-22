'use strict';
// Load dmxnet as libary


const Artnet = require('../src/index')
var artnet = new Artnet({});
//console.log(artnet.interfaces);

// Create a new receiver instance, listening for universe 5 on net 0 subnet 0
var receiver = artnet.createReceiver({
  subnet: 0,
  universe: 1,
  net: 0,
});



// Dump data if DMX Data is received
receiver.on('data', function(data) {
  console.log('DMX data:', data); // eslint-disable-line no-console
});
