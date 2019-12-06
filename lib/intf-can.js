/* eslint require-atomic-updates : 0 */

// TODO: Make this a class


// Check if CANBUS ARBID is on allow list
function check_allow(data) {
	// Convert to string hexadecimal representation and format
	const hexstr = hex.i2s(data, true, 3);
	return (bus.arbids.arbids_allow.indexOf(hexstr) > -1);
} // check_allow(data)

// Check for / filter out repeat CANBUS data
// return false : not a repeat
// return true  : is a repeat
function check_repeat(id, data) {
	// Store data as Buffer
	data = Buffer.from(data);

	// If old buffer is not a buffer/doesn't exist, populate it, then return false
	if (!Buffer.isBuffer(intf.intf.last[id])) {
		intf.intf.last[id] = data;
		return false;
	}

	// Bounce if the new buffer doesn't equal the old buffer
	if (!intf.intf.last[id].equals(data)) return false;

	// Return true if it is a genuine repeat
	return true;
} // check_repeat()


// Setup/configure interface
async function init() {
	log.lib('Initalizing');

	if (intf.path === null) {
		log.lib('Interface ' + app_intf + ' is not enabled');
		update.status('intf.up', false, false);
		return;
	}

	// Pull in socketcan library
	const can = require('socketcan');

	// Create raw socketcan channel, timestamps disabled
	// eslint require-atomic-updates
	intf.intf.port = await can.createRawChannel(intf.path, false);

	// Respond to incoming CAN messages
	intf.intf.port.addListener('onMessage', message => {
		// If enabled, return now if this is an not an allowed message
		if (config.can.check.allow) {
			if (!check_allow(message.id)) return;
		}

		// If enabled, return now if this is a repeated message
		if (config.can.check.repeat) {
			if (check_repeat(message.id,  message.data.toJSON().data)) return;
		}

		// Send data received from vehicle bus to socket
		socket.bus_rx({
			bus : app_intf,
			msg : message.data.toJSON().data,
			src : {
				id   : message.id,
				name : bus.arbids.h2n(message.id),
			},
		});
	});

	// Start CAN socket
	await intf.intf.port.start();

	log.lib('Initialized');
} // async init()

// Close interface
async function term() {
	log.lib('Terminating');

	// Add listener for onStopped message
	intf.intf.port.addListener('onStopped', () => {
		log.lib('CAN channel stopped');
	});

	// Call for channel to stop
	await intf.intf.port.stop();

	log.lib('Terminated');

	return true;
} // async term()


// Write an object to the interface
async function send(object) {
	// Convert data to Buffer and send
	await intf.intf.port.send(Buffer.from(object.data));

	// Lame
	return true;
} // async send(object)


module.exports = {
	last : {},

	port : null,

	// Start/stop functions
	init,
	term,

	// Data functions
	send,
};
