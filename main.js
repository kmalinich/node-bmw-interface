/* eslint no-global-assign: "off", no-console: "off" */

app_path = __dirname;
app_name = 'bmwi';
app_intf = process.argv[2] || process.env.BMWI_INTERFACE || null;
app_type = app_intf;

process.title = app_name+'@'+app_type;

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
update  = require('update');

bus = {
	arbids  : require('bus-arbids'),  // CANBUS ARBIDs
	data    : require('bus-data'),    // Data sender/router (based on dst)
	modules : require('bus-modules'), // DBUS/IBUS/KBUS module IDs
};


// Configure term event listeners
function term_config(pass) {
	process.on('SIGTERM', () => {
		console.log('');
		log.msg({ msg : 'Caught SIGTERM' });
		term();
	});

	process.on('SIGINT', () => {
		console.log('');
		log.msg({ msg : 'Caught SIGINT' });
		term();
	});

	process.on('exit', () => {
		log.msg({ msg : 'Terminated' });
	});

	process.nextTick(pass);
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
function load_modules(pass) {
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
	intf = {
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

	intf.can0 = require('./intf/can0');
	intf.can1 = require('./intf/can1');
	intf.dbus = require('./intf/dbus');
	intf.ibus = require('./intf/ibus');
	intf.kbus = require('./intf/kbus');
	intf.lcd  = require('./intf/lcd');

	// Host data object (CPU, memory, etc.)
	host_data = require('host-data');

	log.module({ msg : 'Loaded modules' });

	process.nextTick(pass);
}


// Global init
function init() {
	log.msg({ msg : 'Initializing' });

	json.read(() => { // Read JSON config and status files
		json.reset(() => { // Reset status vars pertinent to launching app
			load_modules(() => { // Load IBUS module node modules
				socket.init(() => { // Open zeroMQ server
					host_data.init(() => { // Initialize host data object
						intf[app_intf].init(() => { // Open defined interface
							log.msg({ msg : 'Initialized' });
						}, term);
					}, term);
				}, term);
			}, term);
		}, term);
	}, term);
}


// Save-N-Exit
function bail() {
	json.write(() => { // Write JSON config and status files
		process.exit();
	});
}

// Global term
function term() {
	log.msg({ msg : 'Terminating' });

	intf[app_intf].term(() => { // Close defined interface
		host_data.term(() => { // Terminate host data timeout
			socket.term(() => { // Close zeroMQ server
				json.reset(bail); // Reset status vars pertinent to launching app
			}, term);
		}, term);
	}, term);
}


// FASTEN SEATBELTS
term_config(() => {
	init();
});
