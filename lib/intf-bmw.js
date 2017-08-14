/* eslint no-console: 0 */

const serialport  = require('serialport');

// Output formatted error message
function error_out(message, error) {
	let error_fmt = error.toString().replace(/Error: /, '').replace(/Error: /, '').trim();
	log.msg({ msg : 'Error '+message+': '+error_fmt });
}


// Set serial port options
function set_options(pass, fail) {
	intf.intf.port.set(intf.opts.open, (error) => {
		if (error) {
			error_out('setting options', error);
			process.nextTick(fail);
			return false;
		}

		log.msg({ msg : 'Initialized' });
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
		log.msg({ msg : 'Interface '+app_intf+' is not enabled' });

		// Update status object
		update.status('intf.up', false);
		typeof fail === 'function' && process.nextTick(fail);
		return status.intf.up;
	}

	let port_status;
	if (intf.intf.port === null || typeof intf.intf.port.isOpen === 'undefined')
		port_status = false;
	else
		port_status = intf.intf.port.isOpen;

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

			// If it isn't null...
			if (data === null) {
				console.log('port data was null');
				return;
			}

			console.log(data);

			// Loop to send it one byte at a time to the parser
			// TODO : This is probably a kludge due to not using the
			// ill-documented .setEncoding() function
			// for (let byte = 0; byte < data.length; byte++) {
			// 	proto.proto.pusher(data[byte]);
			// }
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

				log.msg({ msg : 'Opened \''+intf.path+'\'' });

				check(() => {
					set_options(pass, fail);
				}, fail);
			});
		}, fail);
	}, fail);
}

// Close serial port
function term(pass, fail) {
	log.msg({ msg : 'Terminating' });

	// Check if it's already closed
	check(() => {
		// Drain the port
		intf.intf.port.drain((error) => {
			if (error) error_out('draining', error);

			// Close the port
			intf.intf.port.close((error) => {
				if (error) {
					error_out('closing port', error);
					process.nextTick(fail);
					return false;
				}

				log.msg({ msg : 'Closed \''+intf.path+'\'' });

				check(() => {
					log.msg({ msg : 'Terminated' });
					process.nextTick(pass);
					return true;
				}, fail);
			});
		}, fail);
	}, fail);
}


// Write a buffer to the serial port
function send(buffer, waiter = false) {
	// Only write data if port is open
	if (!status.intf.up) {
		log.msg({ msg : 'Waiting for port to open' });
		return false;
	}

	if (intf.intf.draining+intf.intf.writing != 0) {
		if (waiter === false) intf.intf.waiting++;

		setImmediate(() => {
			send(buffer, true);
		});
		return;
	}

	if (waiter === true) intf.intf.waiting--;

	intf.intf.writing++;
	intf.intf.port.write(proto.proto.create(buffer), (error) => {
		intf.intf.writing--;

		if (error) error_out('writing', error);

		if (intf.intf.draining+intf.intf.writing === 0) {
			intf.intf.draining++;

			intf.intf.port.drain((error) => {
				intf.intf.draining--;

				if (error)
					error_out('draining', error);
				else
					intf.config.debug && log.msg({ msg : 'Drain success' });
			});
		}
	});
}


module.exports = {
	// Serial interface
	port : null,

	// Variables
	draining : 0,
	waiting  : 0,
	writing  : 0,

	// Start/stop functions
	init : (pass, fail) => { return init(pass, fail); },
	term : (pass, fail) => { return term(pass, fail); },

	// Serial port functions
	send : (buffer) => { return send(buffer); },
};
