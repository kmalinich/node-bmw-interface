const serialport = require('serialport');


// Output formatted error message
function error_out(message, error) {
	let error_fmt = error.toString().replace(/Error: /, '').replace(/Error: /, '').trim();
	log.msg('Error ' + message + ': ' + error_fmt);
}


// Set serial port options
function set_options(pass, fail) {
	intf.intf.port.set(intf.opts.open, (error) => {
		if (error) {
			error_out('setting options', error);
			process.nextTick(fail);

			return false;
		}

		log.msg('Initialized');
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
		log.msg('Interface ' + app_intf + ' is not enabled');

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
				log.msg('port data was null');

				return;
			}

			// Loop to send it one byte at a time to the parser
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
		intf.intf.port.on('open', check);
		intf.intf.port.on('close', check);

		process.nextTick(pass);

		return true;
	}, fail);
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

				log.msg('Opened \'' + intf.path + '\'');

				check(() => {
					set_options(pass, fail);
				}, fail);
			});
		}, fail);
	}, fail);
}

// Close serial port
function term(pass, fail) {
	log.msg('Terminating');

	// Check if it's already closed
	check(() => {
		// Close the port
		intf.intf.port.close((error) => {
			if (error) {
				error_out('closing port', error);
				process.nextTick(fail);

				return false;
			}

			log.msg('Closed \'' + intf.path + '\'');

			check(() => {
				log.msg('Terminated');
				process.nextTick(pass);

				return true;
			}, fail);
		});
	}, fail);
}


// Check the write queue length
function check_queue_write() {
	if (intf.intf.queue_write.length < 1) {
		intf.intf.writing = false;
		return false;
	}

	intf.intf.writing = true;
	return true;
}


// Add a buffer to the write queue
function send(buffer) {
	// Add buffer to the beginning of the write queue
	intf.intf.queue_write.unshift(buffer);

	// Start write process if need be
	if (intf.intf.writing === false) write();
}

// Write a buffer to the serial port
function write() {
	// Bail if the write queue is invalid
	if (!check_queue_write()) return;

	// Create message from buffer
	let buffer = proto.proto.create(intf.intf.queue_write[intf.intf.queue_write.length - 1]);

	intf.intf.port.write(buffer, (error) => {
		// Bail and retry if there was a write error
		if (error) {
			error_out('writing', error);

			// Re-kick it
			setImmediate(write);

			return;
		}

		intf.intf.port.drain(() => {
			// After a successful write and drain, remove the last element from the write queue
			intf.intf.queue_write.pop();

			// Re-kick it
			// setImmediate(write);
			process.nextTick(write);
		});
	});
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
