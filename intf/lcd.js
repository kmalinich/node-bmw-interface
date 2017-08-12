const module_name = __filename.slice(__dirname.length + 1, -3);
const status_path = 'intf.'+module_name+'.';

// const align      = require('multipad');
const serialport = require('serialport');


// Output formatted error message
function error_out(message, error, callback = null) {
	let error_fmt = error.toString().replace(/Error: /, '').replace(/Error: /, '').trim();

	log.msg({
		src : module_name,
		msg : 'Error '+message+': '+error_fmt,
	});

	if (typeof callback === 'function') callback();
	return true;
}


// Check if we're configured to use this bus, set status var, and return
function check_config(callback = null) {
	if (config.intf[module_name] === null) {
		update.status(status_path+'configured', false);
		if (typeof callback === 'function') callback();
		return false;
	}

	if (typeof callback === 'function') callback();
	return true;
}

// Check if the serial port has been initialized yet
function check_configured(callback = null) {
	if (!check_config()) {
		if (typeof callback === 'function') callback();
		return update.status(status_path+'configured', false);
	}

	if (status.intf[module_name].configured === false) {
		if (typeof callback === 'function') callback();
		return update.status(status_path+'configured', false);
	}

	if (typeof callback === 'function') callback();
	return true;
}

// Check if the port is open, set status var, and return
function check_open(callback = null) {
	if (!check_configured()) return false;
	if (typeof callback === 'function') callback();

	if (intf[module_name].serial_port !== null) {
		return update.status(status_path+'up', intf[module_name].serial_port.isOpen);
	}

	return update.status(status_path+'up', false);
}

// Setup/configure serial port
function configure_port(callback = null) {
	if (!check_config()) {
		if (typeof callback === 'function') callback();
		return false;
	}

	let intf_path = config.intf[module_name];
	let intf_opts = intf.options[module_name].init;
	intf[module_name].serial_port = new serialport(intf_path, intf_opts);

	// Events
	intf[module_name].serial_port.on('error', (error) => {
		// On port error
		check_open();
		error_out('in port', error);
	});

	intf[module_name].serial_port.on('close', () => {
		// On port close
		check_open();
	});

	// Set init status var
	update.status(status_path+'configured', true);

	if (typeof callback === 'function') callback();
	return true;
}

// Write a buffer to the serial port
function send(buffer, waiter = false, callback = null) {
	if (!check_config()) {
		if (typeof callback === 'function') callback();
		return false;
	}

	// Only write data if port is open
	if (!check_open()) {
		log.msg({ src : module_name, msg : 'Waiting for port to open' });
		if (typeof callback === 'function') callback();
		return false;
	}

	// Convert input to Buffer
	buffer = Buffer.from(buffer);

	if (intf[module_name].draining+intf[module_name].writing != 0) {
		if (waiter === false) { intf[module_name].waiting++; }

		setImmediate(() => {
			send(buffer, true, callback);
		});
		return;
	}

	if (waiter === true) { intf[module_name].waiting--; }

	intf[module_name].writing++;
	intf[module_name].serial_port.write(buffer, (error) => {
		intf[module_name].writing--;

		if (error) error_out('writing', error);

		if (intf[module_name].draining+intf[module_name].writing === 0) {
			intf[module_name].draining++;

			intf[module_name].serial_port.drain((error) => {
				intf[module_name].draining--;

				if (error) error_out('draining', error);

				if (intf.config.debug === true) {
					log.msg({
						src : module_name,
						msg : 'Drain success '+buffer,
					});
				}

				if (typeof callback === 'function') callback();
				return true;
			});
		}
	});
}

// A selection of Matrox Orbital commands to command the USB LCD
function command(cmd, value = null, callback = null) {
	if (!check_config()) {
		if (typeof callback === 'function') callback();
		return false;
	}

	// Only write data if port is open
	if (!check_open()) {
		log.msg({ src : module_name, msg : 'Waiting for port to open' });
		if (typeof callback === 'function') callback();
		return false;
	}

	log.module({
		src : module_name,
		msg : 'Command: '+cmd,
	});

	switch (cmd) {
		case 'autoscroll-off' : cmd = [0x52]; break;
		case 'autoscroll-on'  : cmd = [0x51]; break;
		case 'block-off'      : cmd = [0x53]; break;
		case 'block-on'       : cmd = [0x54]; break;
		case 'clear'          : cmd = [0x58]; break;
		case 'home'           : cmd = [0x48]; break;
		case 'off'            : cmd = [0x46]; break;
		case 'on'             : cmd = [0x42]; break;
		case 'set-splash'     : cmd = [0x40]; break;
		case 'underline-off'  : cmd = [0x4A]; break;
		case 'underline-on'   : cmd = [0x4B]; break;

		case 'brightness'     : cmd = [0x99, value]; break;
		case 'contrast'       : cmd = [0x50, value]; break;

		default: cmd = [0x58]; // Default is clear display
	}

	// Add 0xFE (cmd code) at beginning of array
	cmd.unshift(0xFE);

	// Send command
	intf[module_name].send(cmd, false, callback);
}

// Separate set-color function for LCD since it has more input
function color(values) {
	if (!check_config()) {
		return false;
	}

	// Only write data if port is open
	if (!check_open()) {
		log.msg({ src : module_name, msg : 'Waiting for port to open' });
		return false;
	}

	let cmd = [0xD0, values.r, values.g, values.b];

	// Add 0xFE (cmd code) at beginning of array
	cmd.unshift(0xFE);

	// Send command
	intf[module_name].send(cmd, false);
}

function text(data, callback = null) {
	// Validate input
	if (typeof data.upper === 'undefined') return;
	if (typeof data.lower === 'undefined') return;

	if (!check_config()) {
		if (typeof callback === 'function') callback();
		return false;
	}

	// Only write data if port is open
	if (!check_open()) {
		log.msg({ src : module_name, msg : 'Waiting for port to open' });
		if (typeof callback === 'function') callback();
		return false;
	}

	// Replace weird IKE degree symbol
	data.upper = data.upper.replace(/¨/, 'C').trim();
	data.lower = data.lower.replace(/¨/, 'C').trim();
	data.upper = data.lower;
	data.lower = status.system.temperature+'C|'+status.system.cpu.load_pct+'%';

	log.msg({
		src : module_name,
		msg : 'Text: \''+data.upper+' '+data.lower+'\'',
	});

	// This data needs to be put in status variable like MID text
	// tder string + trim to 16 chars
	data.upper = pad(data.upper.substring(0, 16), 16);
	data.lower = pad(16, data.lower.substring(0, 16));

	// Center string + trim to 16 chars
	// data.upper = align.center(data.upper.substring(0, 16), 16, ' ');
	// data.lower = align.center(data.lower.substring(0, 16), 16, ' ');

	let string;
	string = data.upper+data.lower;

	intf[module_name].command('clear', null, () => {
		intf[module_name].command('home', null, () => {
			intf[module_name].send(string, null, () => {
				if (typeof callback === 'function') callback();
				return true;
			});
		});
	});
}

// Configure LCD settings
function set_options(callback = null) {
	intf[module_name].command('on', null, () => {
		intf[module_name].command('brightness', 0xFF, () => {
			intf[module_name].command('contrast', 0xB0, () => {
				intf[module_name].command('autoscroll-off', null, () => {
					intf[module_name].command('home', null, () => {
						intf[module_name].command('clear', null, () => {

							intf.lcd.text({
								upper : 'bmwi@lcd',
								lower : 'initialized',
							});

							// Turn the LCD back off after a few seconds
							// setTimeout(() => {
							// 	intf[module_name].command('clear', null, () => {
							// 		intf[module_name].command('off', null, () => {
							// 		});
							// 	});
							// }, 10000);

							log.msg({
								src : module_name,
								msg : 'LCD configured',
							});

							if (typeof callback === 'function') callback();
							return true;
						});
					});
				});
			});
		});
	});
}

// Open serial port
function init(callback = null) {
	// Don't continue unless configured to use this port
	if (!configure_port()) {
		if (typeof callback === 'function') callback();
		return false;
	}

	// Check if it's already open
	if (check_open()) {
		if (typeof callback === 'function') callback();
		return false;
	}

	// Open the port
	intf[module_name].serial_port.open((error) => {
		check_open();

		if (error) {
			error_out('opening interface', error);

			if (typeof callback === 'function') callback();
			return false;
		}

		set_options(() => {
			if (typeof callback === 'function') callback();
			return true;
		});
	});
}

// Close serial port
function term(callback = null) {
	if (!check_config()) {
		if (typeof callback === 'function') callback();
		return false;
	}

	// Check if it's already closed
	if (!check_open()) {
		if (typeof callback === 'function') callback();
		return false;
	}

	intf[module_name].command('clear', null, () => {
		intf[module_name].command('off', null, () => {

			// Drain the port
			intf[module_name].serial_port.drain((error) => {
				if (error) error_out('draining', error);

				// Close the port
				intf[module_name].serial_port.close((error) => {
					check_open();

					if (error) {
						error_out('closing port', error);

						if (typeof callback === 'function') callback();
						return false;
					}

					if (typeof callback === 'function') callback();
					return true;
				});
			});
		});
	});
}

module.exports = {
	// Serial interface
	serial_port : null,

	// Variables
	draining : 0,
	waiting  : 0,
	writing  : 0,

	// Functions
	check_config : (callback)         => { check_config(callback); },
	check_open   : (callback)         => { check_open(callback);   },
	term         : (callback)         => { term(callback);         },
	init         : (callback)         => { init(callback);         },

	send : (buffer, waiter, callback) => { send(buffer, waiter, callback); },

	// LCD functions
	color   : (values, callback)     => { color(values, callback);       },
	command : (cmd, value, callback) => { command(cmd, value, callback); },
	text    : (data, callback)       => { text(data, callback);          },
};
