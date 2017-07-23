const module_name = __filename.slice(__dirname.length + 1, -3);
const serialport  = require('serialport');


// Output formatted error message
function error_out(message, error, callback = null) {
	var error_fmt = error.toString().replace(/Error:\ /, '').replace(/Error:\ /, '').trim();

	log.msg({
		src : module_name,
		msg : 'Error '+message+': '+error_fmt,
	});

	if (typeof callback === 'function') callback();
	return true;
}

// Check if we're configured to use this bus, set status var, and return
function check_config(callback = null) {
	if (config.interface[module_name] === null) {
		update_configured(false);
		if (typeof callback === 'function') callback();
		return update_status(false);
	}

	if (typeof callback === 'function') callback();
	return true;
}

// Check if the serial port has been initialized yet
function check_configured(callback = null) {
	if (!check_config()) {
		if (typeof callback === 'function') callback();
		return update_configured(false);
	}

	if (status.interface[module_name].configured === false) {
		if (typeof callback === 'function') callback();
		return update_configured(false);
	}

	if (typeof callback === 'function') callback();
	return true;
}

// Check if the port is open, set status var, and return
function check_open(callback = null) {
	if (!check_configured()) return false;
	if (typeof callback === 'function') callback();
	if (interface[module_name].serial_port !== null) {
		return update_status(interface[module_name].serial_port.isOpen);
	}
	return update_status(false);
}

// Check if the interface configured is changed before setting,
// if changed, show message
function update_configured(new_configured, callback = null) {
	if (status.interface[module_name].configured !== new_configured) {
		if (interface.config.debug === true) {
			log.change({
				src   : module_name,
				value : 'Interface configured',
				old   : status.interface[module_name].configured,
				new   : new_configured,
			});
		}

		// Update status var
		status.interface[module_name].configured = new_configured;
	}

	if (typeof callback === 'function') callback();
	return status.interface[module_name].configured;
}

// Check if the interface status is changed before setting,
// if changed, show message
function update_status(new_status, callback = null) {
	if (status.interface[module_name].up !== new_status) {
		log.change({
			src   : module_name,
			value : 'Interface open',
			old   : status.interface[module_name].up,
			new   : new_status,
		});

		// Update status var
		status.interface[module_name].up = new_status;

		if (status.interface[module_name].up === false) {
			log.msg({
				src : module_name,
				msg : 'Port closed',
			});
		}
	}

	if (typeof callback === 'function') callback();
	return status.interface[module_name].up;
}

// Setup/configure serial port
function configure_port(callback = null) {
	if (!check_config()) {
		if (typeof callback === 'function') callback();
		return false;
	}

	let intf_path = config.interface[module_name];
	let intf_opts = interface.options[module_name].init;
	interface[module_name].serial_port = new serialport(intf_path, intf_opts);

	// Events
	interface[module_name].serial_port.on('error', (error) => {
		// On port error
		check_open();
		error_out('in port', error);
	});

	// Send data to the parser
	interface[module_name].serial_port.on('data', (data) => {
		// Loop to send it one byte at a time
		for (var byte = 0; byte < data.length; byte++) {
			protocol[module_name].pusher(data[byte]);
		}
	});

	interface[module_name].serial_port.on('close', () => {
		// On port close
		check_open();
	});

	// Set init status var
	update_configured(true);

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

	if (interface[module_name].draining+interface[module_name].writing != 0) {
		if (waiter === false) { interface[module_name].waiting++; }

		setImmediate(() => {
			send(buffer, true, callback);
		});
		return;
	}

	if (waiter === true) { interface[module_name].waiting--; }

	interface[module_name].writing++;
	interface[module_name].serial_port.write(protocol[module_name].create(buffer), (error) => {
		interface[module_name].writing--;

		if (error) error_out('writing', error);

		if (interface[module_name].draining+interface[module_name].writing === 0) {
			interface[module_name].draining++;

			interface[module_name].serial_port.drain((error) => {
				interface[module_name].draining--;

				if (error) error_out('draining', error);

				if (interface.config.debug === true) {
					log.msg({
						src : module_name,
						msg : 'Drain success '+buffer,
					});
				}
			});
		}
	});
}

// Open serial port
function startup(callback = null) {
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
	interface[module_name].serial_port.open((error) => {
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

// Set serial port options
function set_options(callback = null) {
	interface[module_name].serial_port.set(interface.options[module_name].open, (error) => {
		if (error) {
			error_out('setting options', error);

			if (typeof callback === 'function') callback();
			return false;
		}

		log.msg({
			src : module_name,
			msg : 'Interface options set',
		});

		if (typeof callback === 'function') callback();
		return true;
	});
}

// Close serial port
function shutdown(callback = null) {
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
	interface[module_name].serial_port.drain((error) => {
		// Close the port
		interface[module_name].serial_port.close((error) => {
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
	check_config : (callback)         => { check_config(callback); },
	check_open   : (callback)         => { check_open(callback);   },
	send         : (buffer, callback) => { send(buffer, callback); },
	shutdown     : (callback)         => { shutdown(callback);     },
	startup      : (callback)         => { startup(callback);      },
};
