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
		log.msg('Interface ' + app_intf + ' is not enabled');

		// Update status object
		update.status('intf.up', false);
		typeof fail === 'function' && process.nextTick(fail);
		return status.intf.up;
	}

	let port_status = (intf.intf.port !== null && typeof intf.intf.port.isOpen !== 'undefined');

	// Update status object
	update.status('intf.up', port_status);

	typeof pass === 'function' && process.nextTick(pass);

	return status.intf.up;
}

// Check for / filter out repeat CANBUS data
function check_repeat(id, data) {
	// Bounce if the last message isn't a buffer/doesn't exist
	if (!Buffer.isBuffer(intf.intf.last[id])) return false;

	// Bounce if the new buffer doesn't equal the old buffer
	if (!intf.intf.last[id].equals(data)) return false;

	// Return true if it is a genuine repeat
	return true;
}

// Check if CANBUS ARBID is on allow list
function check_allow(id) {
	// Convert to string hexadecimal representation and format
	id = id.toString(16);
	id = '0x' + id.replace('0x', '').replace(/^0+/, '');
	id = parseInt(id);
	id = id.toString(16).toUpperCase();
	id = '0x' + id.padStart(3, 0);

	let repeat = (bus.arbids.arbids_allow.indexOf(id) > -1);

	if (repeat === true) {
		status.intf.messages_repeat++;

		if (status.intf.messages_repeat % 1000 === 0) {
			log.msg('Message count, repeated: ' + status.intf.messages_repeat);
		}
	}

	return repeat;
}


// Setup/configure interface
function init(pass, fail) {
	log.msg('Initalizing');

	check(() => {
		// Pull in rawcan library
		const can = require('rawcan');

		// Create raw CAN socket
		intf.intf.port = can.createSocket(intf.path, true);

		// Respond to incoming CAN messages
		intf.intf.port.on('message', (id, data) => {
			status.intf.messages++;

			if (status.intf.messages % 1000 === 0) {
				log.msg('Message count, total: ' + status.intf.messages);
			}

			// Bounce if this is an not an allowed message or is repeated
			if (check_repeat(id, data) || !check_allow(id)) return;

			let msg = {
				bus : app_intf,
				msg : data.toJSON().data,
				src : {
					id   : id,
					name : bus.arbids.h2n(id),
				},
			};

			// Send data to zeroMQ socket
			socket.bus_rx(msg);

			intf.intf.last[id] = data;
		});

		log.msg('Initialized');
		process.nextTick(pass);
	}, fail);
}

// Fake term function
function term(pass) {
	log.msg('Terminated');
	process.nextTick(pass);
}


// Write an object to the interface
function send(object) {
	// Object example:
	// intf.intf.port.send({
	//  id   : 0x4F8,
	//  data : Buffer.from([0x00, 0x42, 0xFE, 0x01, 0xFF, 0xFF, 0xFF, 0xFF]),
	// });

	intf.intf.port.send(object.id, object.data);

	// Lame
	return true;
}


module.exports = {
	last : {},
	port : null,

	// Start/stop functions
	init : (pass, fail) => { return init(pass, fail); },
	term : (pass, fail) => { return term(pass, fail); },

	// Data functions
	send : (object) => { return send(object); },
};
