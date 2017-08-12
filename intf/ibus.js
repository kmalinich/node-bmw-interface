/* eslint no-console: 0 */

const module_name = __filename.slice(__dirname.length + 1, -3);
const serialport  = require('serialport');

const status_path = 'intf.'+module_name+'.';
const status_conf = status_path+'configured';
const status_up   = status_path+'up';


// Output formatted error message
function error_out(message, error, callback = null) {
	let error_fmt = error.toString().replace(/Error: /, '').replace(/Error: /, '').trim();

	log.msg({ msg : 'Error '+message+': '+error_fmt });

	if (typeof callback === 'function') callback();
	return true;
}


// Check if we're configured to use this bus, set status var, and return
function check_config() {
	if (config.intf[module_name] === null) {
		update.status(status_conf, false);
		update.status(status_up, false);
		return false;
	}
	return true;
}

// Check if the port is open, set status var, and return
function check_open() {
	update.status(status_path+'up', intf[module_name].serial_port.isOpen);
	return status.intf[module_name].up;
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

	// Send data to the parser
	intf[module_name].serial_port.on('data', (data) => {
		// Get readable data from serial port
		// let data = intf[module_name].serial_port.read();

		// If it isn't null...
		if (data !== null) {
			// Loop to send it one byte at a time to the parser
			// TODO : This is probably a kludge due to not using the
			// ill-documented .setEncoding() function
			for (let byte = 0; byte < data.length; byte++) {
				protocol[module_name].pusher(data[byte]);
			}
		}
	});

	// On port close
	intf[module_name].serial_port.on('close', () => {
		// Make sure it's closed
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

	if (intf[module_name].draining+intf[module_name].writing != 0) {
		if (waiter === false) { intf[module_name].waiting++; }

		setImmediate(() => {
			send(buffer, true, callback);
		});
		return;
	}

	if (waiter === true) { intf[module_name].waiting--; }

	intf[module_name].writing++;
	intf[module_name].serial_port.write(protocol[module_name].create(buffer), (error) => {
		intf[module_name].writing--;

		if (error) error_out('writing', error);

		if (intf[module_name].draining+intf[module_name].writing === 0) {
			intf[module_name].draining++;

			intf[module_name].serial_port.drain((error) => {
				intf[module_name].draining--;

				if (error) error_out('draining', error);

				if (intf.config.debug == true) {
					log.msg({
						msg : 'Drain success',
					});
				}
			});
		}
	});
}

// Set serial port options
function set_options(callback = null) {
	intf[module_name].serial_port.set(intf.options[module_name].open, (error) => {
		if (error) {
			error_out('setting options', error);

			process.nextTick(callback);
			return;
		}

		log.msg({
			msg : 'Interface options set',
		});

		process.nextTick(callback);
		return;
	});
}

// Open serial port
function init(callback = null) {
	// Don't continue unless configured to use this port
	if (!configure_port()) {
		process.nextTick(callback);
		return;
	}

	// Check if it's already open
	if (check_open()) {
		process.nextTick(callback);
		return;
	}

	// Open the port
	intf[module_name].serial_port.open((error) => {
		check_open();

		if (error) {
			error_out('opening interface', error);

			process.nextTick(callback);
			return;
		}

		set_options(() => {
			process.nextTick(callback);
			return;
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
}

module.exports = {
	// Serial interface
	serial_port : null,

	// Variables
	draining : 0,
	waiting  : 0,
	writing  : 0,

	// Functions
	check_config : () => { check_config(); },
	check_open   : () => { check_open();   },

	send : (buffer, callback) => { send(buffer, callback); },
	term : (callback)         => { term(callback);         },
	init : (callback)         => { init(callback);         },
};
