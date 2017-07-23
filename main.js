const module_name = __filename.slice(__dirname.length + 1, -3);

app_path = __dirname;
app_name = 'bmwi';
app_type = 'interface';
app_intf = process.argv[2] || process.env.BMWI_INTERFACE || null;

// npm libraries
now = require('performance-now');
os  = require('os');
pad = require('pad');

// node-bmw libraries
bitmask = require('bitmask');
hex     = require('hex');
json    = require('json');
log     = require('log-output');
socket  = require('socket');

bus_arbids  = require('bus-arbids');  // CANBUS ARBIDs
bus_data    = require('bus-data');    // Data sender/router (based on dst)
bus_modules = require('bus-modules'); // DBUS/IBUS/KBUS module IDs


// Configure shutdown event listeners
function shutdown_config(shutdown_config_callback = null) {
	process.on('SIGTERM', () => {
		log.msg({
			src : module_name,
			msg : 'Received SIGTERM, launching shutdown()',
		});
		shutdown();
	});

	process.on('SIGINT', () => {
		log.msg({
			src : module_name,
			msg : 'Received SIGINT, launching shutdown()',
		});
		shutdown();
	});

	process.on('exit', () => {
		log.msg({
			src : module_name,
			msg : 'Shut down',
		});
	});

	if (typeof shutdown_config_callback === 'function') { shutdown_config_callback(); }
	shutdown_config_callback = undefined;
}

// Render serialport options object
function serial_options(parity, collision_detection) {
	// Trick Daddy - I'm a Thug
	let baud_rate;
	switch (parity) {
		case 'even' : baud_rate = 9600; break;
		default     : baud_rate = 57600;
	}

	return {
		init : {
			autoOpen : false,
			baudRate : baud_rate,
			parity   : parity,
			rtscts   : collision_detection,
		},
		open_new : {
			cts  : collision_detection,
			dsr  : collision_detection,
			rts  : false,
			xon  : false,
			xoff : false,
			xany : false,
		},
		open : {
			cts  : collision_detection,
			dsr  : false,
			rts  : collision_detection,
			xon  : false,
			xoff : false,
			xany : false,
		},
	};
}

// Function to load modules that require data from config object,
// AFTER the config object is loaded
function load_modules(load_modules_callback = null) {
	// Vehicle data bus protocol config
	protocol = {
		config : {
			debug      : process.env.BMWD_DEBUG_PROTOCOL,
			length_min : 5,
			length_max : 1000,
			error_max  : 50,
		},
	};

	// Vehicle data bus interface libraries
	interface = {
		config : {
			debug : process.env.BMWD_DEBUG_INTERFACE,
		},
		options : {
			dbus : serial_options('even', false),
			ibus : serial_options('even',  true),
			kbus : serial_options('even',  true),
			lcd  : serial_options('none', false),
		},
	};

	// Vehicle data bus protocol and interface libraries
	// Load these after as they depend on config values above
	protocol.dbus = require('./protocol/dbus');
	protocol.ibus = require('./protocol/ibus');
	protocol.kbus = require('./protocol/kbus');

	interface.can0 = require('./interface/can0');
	interface.can1 = require('./interface/can1');
	interface.dbus = require('./interface/dbus');
	interface.ibus = require('./interface/ibus');
	interface.kbus = require('./interface/kbus');
	interface.lcd  = require('./interface/lcd');

	// Host data object (CPU, memory, etc.)
	host_data = require('host-data');

	if (typeof load_modules_callback === 'function') { load_modules_callback(); }
	load_modules_callback = undefined;
}


// Global startup
function startup(startup_callback = null) {
	log.msg({
		src : module_name,
		msg : 'Starting',
	});

	json.read(() => { // Read JSON config and status files
		json.reset(() => { // Reset status vars pertinent to launching app
			load_modules(() => { // Load IBUS module node modules
				host_data.init(() => { // Initialize host data object
					socket.startup(() => { // Open WebSocket server

						interface[app_intf].startup(() => { // Open defined interface

							if (typeof startup_callback === 'function') { startup_callback(); }
							startup_callback = undefined;

							log.msg({ src : module_name, msg : 'Started' });

						});
					});
				});
			});
		});
	});
}

// Global shutdown
function shutdown(shutdown_callback = null) {
	log.msg({
		src : module_name,
		msg : 'Stopping',
	});

	json.reset(() => { // Reset status vars pertinent to launching app
		json.write(() => { // Write JSON config and status files
			interface.kbus.shutdown(() => { // Close KBUS serial port
				interface.lcd.shutdown(() => { // Close USB LCD serial port
					interface.ibus.shutdown(() => { // Close IBUS serial port
						interface.dbus.shutdown(() => { // Close IBUS serial port
							socket.shutdown(() => { // Close WebSocket server
								host_data.term(() => { // Terminate host data timeout

									if (typeof shutdown_callback === 'function') { shutdown_callback(); }
									shutdown_callback = undefined;

									log.msg({ src : module_name, msg : 'Stopped' });
									process.exit();

								});
							});
						});
					});
				});
			});
		});
	});
}


// FASTEN SEATBELTS
shutdown_config(() => {
	startup();
});
