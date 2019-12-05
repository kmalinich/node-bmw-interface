// Check :
// - If we're configured to use the specified port
// - Check if the port is open
//   - Update status object
//
// Handle :
// - unspecified interface path,
// - interface port null,
// - port.isOpen value not existing yet
function check(pass = null, fail = null) {
	if (intf.path === null) {
		log.lib('Interface ' + app_intf + ' is not enabled');

		// Update status object
		update.status('intf.up', false, false);
		typeof fail === 'function' && process.nextTick(fail);
		return status.intf.up;
	}

	const port_status = (intf.intf.port !== null && typeof intf.intf.port.isOpen !== 'undefined');

	// Update status object
	update.status('intf.up', port_status, false);

	typeof pass === 'function' && process.nextTick(pass);

	return status.intf.up;
}

// Check if CANBUS ARBID is on allow list
function check_allow(data) {
	// Convert to string hexadecimal representation and format
	const hexstr = hex.i2s(data, true, 3);
	return (bus.arbids.arbids_allow.indexOf(hexstr) > -1);
}

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
}


// Setup/configure interface
function init(pass, fail) {
	log.lib('Initalizing');

	check(() => {
		// Pull in socketcan library
		const can = require('socketcan');

		// Create raw socketcan channel, timestamps disabled
		intf.intf.port = can.createRawChannel(intf.path, false);

		// Respond to incoming CAN messages
		intf.intf.port.addListener('onMessage', (message) => {
			// Bounce if this is an not an allowed message
			if (!check_allow(message.id)) return;

			// Bounce if this is a repeated message
			if (check_repeat(message.id,  message.data.toJSON().data)) return;

			// Send data received from vehicle bus to socket
			socket.bus_rx({
				bus : app_intf,
				msg : message.data.toJSON().data,
				src : {
					id   : message.id,
					name : bus.arbids.h2n(message.id),
				},
			});

			message = undefined;
		});


		// Start CAN socket
		intf.intf.port.start();

		log.lib('Initialized');
		process.nextTick(pass);
	}, fail);
}

// Close interface
function term(pass, fail) {
	// Add listener for onStopped message
	intf.intf.port.addListener('onStopped', () => {
		log.lib('Terminated');
		process.nextTick(pass);
		return true;
	});

	log.lib('Terminating');

	// Call for channel to stop
	setTimeout(() => {
		intf.intf.port.stop();
	}, 500);

	// 5 second timeout until failure
	setTimeout(() => {
		process.nextTick(fail);
		return false;
	}, 5000);
}


// Write an object to the interface
function send(object) {
	// Convert data to Buffer and send
	intf.intf.port.send(Buffer.from(object.data));

	// Lame
	return true;
}


module.exports = {
	last : {},

	port : null,

	// Start/stop functions
	init : (pass, fail) => init(pass, fail),
	term : (pass, fail) => term(pass, fail),

	// Data functions
	send : (object) => send(object),
};
