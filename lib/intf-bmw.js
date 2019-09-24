const serialport = require('serialport');


// Output formatted error message
function error_out(message, error) {
	let error_fmt = error.toString().replace(/Error: /, '').replace(/Error: /, '').trim();
	log.lib('Error ' + message + ': ' + error_fmt);
}


// Set serial port options
function set_options(pass, fail) {
	intf.intf.port.set(intf.opts.open, (error) => {
		if (error) {
			error_out('setting options', error);
			process.nextTick(fail);

			return false;
		}

		log.lib('Initialized');
		process.nextTick(pass);

		return true;
	});
}

// Check if we're configured to use the specified port
// Check if the port is open
// Update status object
//
// Handle unspecified interface path,
// interface port null,
// and port.isOpen value not existing yet
function check(pass = null, fail = null) {
	if (intf.path === null) {
		log.lib('Interface ' + app_intf + ' is not enabled');

		// Update status object
		update.status('intf.up', false, false);
		typeof fail === 'function' && process.nextTick(fail);

		return status.intf.up;
	}

	let port_status = false;
	if (intf.intf.port !== null && typeof intf.intf.port.isOpen === 'boolean') {
		port_status = intf.intf.port.isOpen;
	}

	// Update status object
	update.status('intf.up', port_status, false);

	typeof pass === 'function' && process.nextTick(pass);

	return status.intf.up;
}

// Setup/configure serial port
function configure_port(pass, fail) {
	// Don't continue unless configured to use this port
	check(() => {
		// Instantiate serial port,
		// with path and options rendered in main.js
		intf.intf.port = new serialport(intf.path, intf.opts.init);

		// Send data to the parser
		intf.intf.port.on('readable', () => {
			// Get readable data from serial port
			let data = intf.intf.port.read();

			// If it isn't null
			if (data === null) {
				log.lib('port data was null');

				return;
			}

			// Loop to send it one byte at a time to the protocol parser
			for (let byte = 0; byte < data.length; byte++) {
				proto.proto.pusher(data.readUIntBE(byte, 1));
			}
		});

		// Error
		intf.intf.port.on('error', (error) => {
			// Update status object
			check();

			error_out('in port', error);
		});

		// Open/close
		intf.intf.port.on('open',  check);
		intf.intf.port.on('close', check);

		process.nextTick(pass);

		return true;
	}, fail);
}

// Add a message to the write queue
function send(message) {
	// Create Buffer from message
	let buffer = proto.proto.create(message);

	if (typeof buffer === 'undefined' || buffer === null || buffer === '') return;

	intf.intf.queue_write.unshift(buffer);

	// Start write process if need be
	if (intf.intf.writing !== true) write();
}

// Write a buffer to the serial port
function write() {
	// Update writing status
	intf.intf.writing = Boolean(intf.intf.queue_write.length > 0);

	// Bail if the write queue is invalid
	if (intf.intf.writing !== true) return;

	let write_len = intf.intf.queue_write.length * -1;
	let write_buf = Buffer.concat(intf.intf.queue_write);

	intf.intf.port.write(write_buf, (error) => {
		// Bail and retry if there was a write error
		if (error) {
			error_out('writing', error);

			// Re-kick it
			// setImmediate(write);
			// process.nextTick(write);
			return write();
		}

		// After a successful write and drain, remove number of buffered elements from the end of the write queue
		intf.intf.queue_write.splice(write_len);

		// Re-kick it
		// setImmediate(write);
		// process.nextTick(write);
		setTimeout(write, (1/9.6));
		// write();

		// intf.intf.port.drain(() => {
		// 	intf.intf.queue_write.pop();

		// 	// After a successful write and drain, remove number of buffered elements from the end of the write queue
		// 	intf.intf.queue_write.splice(write_len);

		// 	// Re-kick it
		// 	// setImmediate(write);
		// 	// process.nextTick(write);
		// 	write();
		// });
	});
}


// Open serial port
function init(pass, fail) {
	// Instantiate and configure the port
	configure_port(() => {
		// Check if it's already open
		check(() => {
			// Open the port
			intf.intf.port.open((error) => {
				if (error) {
					error_out('opening interface', error);
					process.nextTick(fail);

					return false;
				}

				log.lib('Opened \'' + intf.path + '\'');

				check(() => { set_options(pass, fail); }, fail);
			});
		}, fail);
	}, fail);
}

// Close serial port
function term(pass, fail) {
	log.lib('Terminating');

	// Check if it's already closed
	check(() => {
		// Close the port
		intf.intf.port.close((error) => {
			if (error) {
				error_out('closing port', error);
				process.nextTick(fail);

				return false;
			}

			log.lib('Closed \'' + intf.path + '\'');

			check(() => {
				log.lib('Terminated');
				process.nextTick(pass);

				return true;
			}, fail);
		});
	}, fail);
}


module.exports = {
	// Serial interface
	port : null,

	// Write queue array
	queue_write : [],

	writing : false,

	// Start/stop functions
	init : (pass, fail) => { return init(pass, fail); },
	term : (pass, fail) => { return term(pass, fail); },

	// Serial port functions
	send : send,
};
