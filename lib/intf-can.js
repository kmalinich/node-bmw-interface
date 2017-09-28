/* eslint no-console: 0 */

// Check if we're configured to use the specified port
// Check if the port is open
// Update status object
//
// Handle unspecified interface path,
// interface port null,
// and port.isOpen value not existing yet
function check(pass = null, fail = null) {
	if (intf.path === null) {
		log.msg({ msg : 'Interface ' + app_intf + ' is not enabled' });

		// Update status object
		update.status('intf.up', false);
		typeof fail === 'function' && process.nextTick(fail);
		return status.intf.up;
	}

	let port_status;
	if (intf.intf.port === null || typeof intf.intf.port.isOpen === 'undefined') { port_status = false; }
	else { port_status = intf.intf.port.isOpen; }

	// Update status object
	update.status('intf.up', port_status);

	typeof pass === 'function' && process.nextTick(pass);

	return status.intf.up;
}


// Setup/configure interface
function init(pass, fail) {
	log.msg({ msg : 'Initalizing' });

	check(() => {
		// Pull in rawcan library
		const can = require('rawcan');

		// Create raw CAN socket
		intf.intf.port = can.createSocket(intf.path, true);

		// Respond to incoming CAN messages
		intf.intf.port.on('message', (id, data) => {
			let msg = {
				bus : app_intf,
				msg : data,
				src : {
					id   : id,
					name : bus.arbids.h2n(id),
				},
			};

			// Send the data to the client(s) via WebSocket
			socket.bus_rx(msg);
		});

		log.msg({ msg : 'Initalized' });
		process.nextTick(pass);
	}, fail);
}

// Fake term function
function term(pass) {
	log.msg({ msg : 'Terminated' });
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
	port : null,

	// Start/stop functions
	init : (pass, fail) => { return init(pass, fail); },
	term : (pass, fail) => { return term(pass, fail); },

	// Data functions
	send : (object) => { return send(object); },
};
