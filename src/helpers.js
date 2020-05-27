/**
 * Checks if IPv4 address given is a broadcast address - only used internally
 *
 * @param {string} ipaddress - IP address to check
 * @returns {boolean} - result, true: broadcast
 */
function isBroadcast(ipaddress) {
  var oct = ipaddress.split(".");
  if (oct.length !== 4) {
    throw new Error("Wrong IPv4 lenght");
  }
  for (var i = 0; i < 4; i++) {
    if (parseInt(oct[i], 10) > 255 || parseInt(oct[i], 10) < 0) {
      throw new Error("Invalid IP (Octet " + (i + 1) + ")");
    }
  }
  if (oct[3] === "255") {
    return true;
  }
  return false;
}

module.exports = {isBroadcast}



