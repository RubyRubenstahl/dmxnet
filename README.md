# ⚠ WARNING!!!

## Description
dmxnet is an ArtNet-DMX-sender and receiver for nodejs,
currently under heavy development!

## Features
- Send DMX-Data as ArtNet
- Use multiple senders with different Net, Subnet and Universe-Settings
- Receive ArtNet-Data
- Use multiple receivers with different Net, Subnet and Universe
- Receive ArtPoll and send ArtPollReply (dmxnet is found by other software, e.g. [DMX-Workshop](https://art-net.org.uk/resources/dmx-workshop/))

# Basic usage

```javascript

const Artnet = require("kt-artnet");

const opts = {
  verbose: 1, //Verbosity, default 0
  oem: 0, //OEM Code from artisticlicense, default to dmxnet OEM.
  sName: "Text", // 17 char long node description, default to "dmxnet"
  lName: "Long description" // 63 char long node description, default to "dmxnet - OpenSource ArtNet Transceiver"
}

// Create an Artnet server instance
const server = new Artnet({
  verbose: 1,
  sName: ''
});

// Create a sender
const sender = artnetServer.createSender({
  ip: "255.255.255.255",
  subnet: 0,
  universe: 0,
  net: 0,
});

// Set channels 1-512 to 100%
sender.fillChannels(0, 511, 255);
```

### Structure
dmxnet works with objects:
You can create a new Sender or Receiver-instance at any time,
each transmitting or receiving data for a single ArtNet-Universe.

Each combination of net, subnet and universe is possible.

### Notes
dmxnet can propagate max. 255 Sender/Receiver-Objects to other nodes.
This is a limitation based on the internal structure of ArtPollReply-Packages.
**You can of course use more Sender/Receiver-Objects, but they won't propagate
trough ArtPoll.**
### Transmitting Art-Net

**Create new sender object:**

Options:

```javascript
const opts = {
  ip: "127.0.0.1", //IP to send to, default 255.255.255.255
  subnet: 0, //Destination subnet, default 0
  universe: 0, //Destination universe, default 0
  net: 0, //Destination net, default 0
  port: 6454, //Destination UDP Port, default 6454
  base_refresh_interval: 1000 // Default interval for sending unchanged ArtDmx
}

var sender=dmxnet.newSender(options);
```

**Set Channel:**

```javascript
sender.setChannel(channel,value);
```

Sets *channel* (0-511) to *value* (0-255) and transmits the changed values .

**Fill Channels**

```javascript
sender.fillChannels(min,max,value);
```

Sets all channels between *min* and *max* (including these) to *value* and transmits the values.

**Prepare Channel:**

```javascript
sender.prepChannel(channel,value);
```

Prepares *channel* (0-511) to *value* (0-255) without transmitting.

Change is transmitted with next
```javascript
sender.transmit();
```
call, or the next periodically transmit. Useful for changing lots of channels at once/in parallel from device view.

**Transmit:**

```javascript
sender.transmit();
```

Transmits a new ArtDMX Frame manually.

**Reset:**

```javascript
sender.reset();
```

Resets all channels of this sender object to zero.

**Please Note: dmxnet transmits a dmx-frame every 1000ms even if no channel has changed its value!**

### Receiving Art-Net

**Create a new receiver-instance:**

```javascript
var receiver=dmxnet.newReceiver(options);
```

Options:

```javascript
{
  subnet: 0, //Destination subnet, default 0
  universe: 0, //Destination universe, default 0
  net: 0, //Destination net, default 0
}
```

**Wait for a new frame:**

```javascript
receiver.on('data', function(data) {
  console.log('DMX data:', data);
});
```

The receiver is emits an "data"-event each time new values have arrived.

The current values are stored inside the `receiver.values`-array for polling.

## ToDo:

- Act as Controller (Sending ArtPoll, Receiving ArtPollReply)
- Maybe support sACN?


### Please feel free to contribute!



## Credits

**Art-Net™ Designed by and Copyright Artistic Licence Holdings Ltd**
