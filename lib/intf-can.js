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

	let port_status = (intf.intf.port !== null && typeof intf.intf.port.isOpen !== 'undefined');

	// Update status object
	update.status('intf.up', port_status, false);

	typeof pass === 'function' && process.nextTick(pass);

	return status.intf.up;
}

// Check if CANBUS ARBID is on allow list
function check_allow(id) {
	// Convert to string hexadecimal representation and format
	id = id.toString(16);
	id = '0x' + id.replace('0x', '').replace(/^0+/, '');
	id = parseInt(id);
	id = id.toString(16).toUpperCase();
	id = '0x' + id.padStart(3, 0);

	return (bus.arbids.arbids_allow.indexOf(id) > -1);
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

			// Send data to zeroMQ socket
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
	log.lib('Terminating');

	// Add listener for onStopped message
	intf.intf.port.addListener('onStopped', () => {
		log.lib('Terminated');
		process.nextTick(pass);
		return true;
	});

	// Call for channel to stop
	intf.intf.port.stop();

	// 10 second timeout until failure
	setTimeout(() => {
		process.nextTick(fail);
		return false;
	}, 10000);
}


// Write an object to the interface
function send(object) {
	// Convert data to Buffer
	object.data = Buffer.from(object.data);

	intf.intf.port.send(object);

	// Lame
	return true;
}


module.exports = {
	port : null,

	// Start/stop functions
	init : (pass, fail) => { return init(pass, fail); },
	term : (pass, fail) => { return term(pass, fail); },

	// Data functions
	send : (object) => { return send(object); },
};
