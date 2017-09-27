/* eslint no-global-assign: "off", no-console: "off" */

app_path = __dirname;
app_name = 'bmwi';
app_intf = process.argv[2] || process.env.BMWI_INTERFACE || 'ibus';
app_type = app_intf;

process.title = app_name + '@' + app_type;

// npm libraries
now = require('performance-now');
os  = require('os');
pad = require('pad');

// node-bmw libraries
bitmask = require('bitmask');
bus     = require('bus');
hex     = require('hex');
json    = require('json');
log     = require('log-output');
socket  = require('socket');
update  = require('update');


// Configure term event listeners
function term_config(pass) {
	process.on('SIGTERM', () => {
		console.log('');
		log.msg({ msg : 'Caught SIGTERM' });
		process.nextTick(term);
	});

	process.on('SIGINT', () => {
		console.log('');
		log.msg({ msg : 'Caught SIGINT' });
		process.nextTick(term);
	});

	process.on('exit', () => {
		log.msg({ msg : 'Terminated' });
	});

	process.nextTick(pass);
}

// Render serialport options object
function serial_opts(parity, collision_detection) {
	// DBUS+IBUS+KBUS :  9600 8e1
	// USB serial LCD : 57600 8n1

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
	// Vehicle data bus interface libraries
	intf = {
		config : {
			debug : process.env.BMWD_DEBUG_INTERFACE || false,
		},
		intf : null,
		opts : {},
		path : config.intf[app_intf],
		pari : 'even',
		coll : false,
		type : null,
	};

	// Vehicle data bus protocol config
	proto = {
		config : {
			debug      : process.env.BMWD_DEBUG_PROTOCOL || false,
			length_min : 5,
			length_max : 1000,
			error_max  : 50,
		},
		proto : null,
	};

	// Load vehicle interface and protocol libs
	switch (app_intf) {
		case 'can0' :
		case 'can1' :
			intf.type = 'can';
			break;

		case 'dbus' :
			intf.type = 'bmw';
			break;

		case 'ibus' :
		case 'kbus' :
			intf.coll = true;
			intf.type = 'bmw';
			break;

		case 'lcd' :
			intf.pari = 'none';
			intf.type = 'lcd';
			break;
	}

	// Populate interface, options, and protocol
	// using above rendered variables
	intf.intf = require('intf-' + intf.type);
	intf.opts = serial_opts(intf.pari, intf.coll);

	if (intf.type !== 'can') { proto.proto = require('proto-' + intf.type); }

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
				intf.intf.init(() => { // Open defined interface
					socket.init(() => { // Open zeroMQ server
						host_data.init(() => { // Initialize host data object
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

	intf.intf.term(() => { // Close defined interface
		host_data.term(() => { // Terminate host data timeout
			socket.term(() => { // Close zeroMQ server
				json.reset(bail); // Reset status vars pertinent to launching app
			}, term);
		}, term);
	}, bail);
}


// FASTEN SEATBELTS
term_config(() => {
	init();
});
