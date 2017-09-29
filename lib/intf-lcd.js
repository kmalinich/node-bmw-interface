/* eslint no-console: 0 */

const serialport  = require('serialport');

// A selection of Matrox Orbital commands to command the USB LCD
function command(cmd, value = null, callback = null) {
	// Check if we're OK
	check(() => {
		log.module({ msg : 'Command: ' + cmd });

		switch (cmd) {
			case 'autoscroll-off' : cmd = [ 0x52 ]; break;
			case 'autoscroll-on'  : cmd = [ 0x51 ]; break;
			case 'block-off'      : cmd = [ 0x53 ]; break;
			case 'block-on'       : cmd = [ 0x54 ]; break;
			case 'clear'          : cmd = [ 0x58 ]; break;
			case 'home'           : cmd = [ 0x48 ]; break;
			case 'off'            : cmd = [ 0x46 ]; break;
			case 'on'             : cmd = [ 0x42 ]; break;
			case 'set-splash'     : cmd = [ 0x40 ]; break;
			case 'underline-off'  : cmd = [ 0x4A ]; break;
			case 'underline-on'   : cmd = [ 0x4B ]; break;

			case 'brightness'     : cmd = [ 0x99, value ]; break;
			case 'contrast'       : cmd = [ 0x50, value ]; break;

			default : cmd = [ 0x58 ]; // Default is clear display
		}

		// Add 0xFE (cmd code) at beginning of array
		cmd.unshift(0xFE);

		// Send command
		intf.intf.send(cmd, false, callback);
	});
}

// Separate set-color function for LCD since it has more input
function color(values) {
	// Check if we're OK
	check(() => {
		let cmd = [ 0xD0, values.r, values.g, values.b ];

		// Add 0xFE (cmd code) at beginning of array
		cmd.unshift(0xFE);

		// Send command
		intf.intf.send(cmd, false);
	});
}

function text(data, callback = null) {
	// Validate input
	if (typeof data.upper === 'undefined') return;
	if (typeof data.lower === 'undefined') return;

	// Check if we're OK
	check(() => {
		// Replace weird IKE degree symbol
		data.upper = data.upper.replace(/¨/, 'C').trim();
		data.lower = data.lower.replace(/¨/, 'C').trim();
		data.upper = data.lower;
		data.lower = status.system.temperature + 'C|' + status.system.cpu.load_pct + '%';

		log.msg({ msg : 'Text: \'' + data.upper + ' ' + data.lower + '\'' });

		// This data needs to be put in status variable like MID text
		// tder string + trim to 16 chars
		data.upper = pad(data.upper.substring(0, 16), 16);
		data.lower = pad(16, data.lower.substring(0, 16));

		// Center string + trim to 16 chars
		// data.upper = align.center(data.upper.substring(0, 16), 16, ' ');
		// data.lower = align.center(data.lower.substring(0, 16), 16, ' ');

		let string;
		string = data.upper + data.lower;

		intf.intf.command('clear', null, () => {
			intf.intf.command('home', null, () => {
				intf.intf.send(string, null, () => {
					if (typeof callback === 'function') callback();
					return true;
				});
			});
		});
	});
}

// Configure LCD settings
function set_options(pass, fail) {
	intf.intf.port.set(intf.opts.open, (error) => {
		if (error) {
			error_out('setting options', error);
			process.nextTick(fail);
			return false;
		}

		log.msg({ msg : 'Initialized' });

		intf.intf.command('on', null, () => {
			intf.intf.command('brightness', 0xFF, () => {
				intf.intf.command('contrast', 0xB0, () => {
					intf.intf.command('autoscroll-off', null, () => {
						intf.intf.command('home', null, () => {
							intf.intf.command('clear', null, () => {
								intf.lcd.text({
									upper : 'bmwi@lcd',
									lower : 'initialized',
								});

								// Turn the LCD back off after a few seconds
								// setTimeout(() => {
								// 	intf.intf.command('clear', null, () => {
								// 		intf.intf.command('off', null, () => {
								// 		});
								// 	});
								// }, 10000);

								log.msg({ msg : 'LCD configured' });

								process.nextTick(pass);
								return true;
							});
						});
					});
				});
			});
		});
	});
}

// Output formatted error message
function error_out(message, error) {
	let error_fmt = error.toString().replace(/Error: /, '').replace(/Error: /, '').trim();
	log.msg({ msg : 'Error ' + message + ': ' + error_fmt });
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

// Setup/configure serial port
function configure_port(pass, fail) {
	// Don't continue unless configured to use this port
	check(() => {
		// Instantiate serial port,
		// with path and options rendered in main.js
		intf.intf.port = new serialport(intf.path, intf.opts.init);

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

				log.msg({ msg : 'Opened \'' + intf.path + '\'' });

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
		// Close the port
		intf.intf.port.close((error) => {
			if (error) {
				error_out('closing port', error);
				process.nextTick(fail);
				return false;
			}

			log.msg({ msg : 'Closed \'' + intf.path + '\'' });

			check(() => {
				log.msg({ msg : 'Terminated' });
				process.nextTick(pass);
				return true;
			}, fail);
		});
	}, fail);
}


// Write a buffer to the serial port
function send(buffer, waiter = false, callback = null) {
	// Only write data if port is open
	if (!status.intf.up) {
		log.msg({ msg : 'Waiting for port to open' });
		return false;
	}

	if (intf.intf.draining + intf.intf.writing != 0) {
		if (waiter === false) intf.intf.waiting++;

		setImmediate(() => {
			send(buffer, true, callback);
		});
		return;
	}

	if (waiter === true) intf.intf.waiting--;

	intf.intf.writing++;
	intf.intf.port.write(buffer, (error) => {
		intf.intf.writing--;

		if (error) error_out('writing', error);

		if (intf.intf.draining + intf.intf.writing === 0) {
			intf.intf.draining++;

			intf.intf.port.drain((error) => {
				intf.intf.draining--;

				if (error) { error_out('draining', error); }
				else { intf.config.debug && log.msg({ msg : 'Drain success' }); }

				typeof callback === 'function' && process.nextTick(callback);
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

	// LCD functions
	color   : (values, cb)     => { color(values, cb);       },
	command : (cmd, value, cb) => { command(cmd, value, cb); },
	text    : (data, cb)       => { text(data, cb);          },
};
