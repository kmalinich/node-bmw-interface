/* eslint no-console       : 0 */
/* eslint no-global-assign : 0 */

app_path = __dirname;
app_name = 'bmwi';
app_intf = process.argv[2] || process.env.BMWI_INTERFACE || 'ibus';

process.title = app_name + '@' + app_intf;

terminating = false;

// node-bmw libraries
bitmask = require('bitmask');
bus     = require('bus');
hex     = require('hex');
json    = require('json');
log     = require('log-output');
socket  = require('socket');

// Class/event-based modules
update = new (require('update'))();


// Configure term event listeners
function term_config(pass) {
	process.on('SIGTERM', () => {
		console.log('');
		log.msg('Caught SIGTERM');
		process.nextTick(term);
	});

	process.on('SIGINT', () => {
		console.log('');
		log.msg('Caught SIGINT');
		process.nextTick(term);
	});

	process.on('exit', () => {
		log.msg('Terminated');
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
			cts    : collision_detection,
			dsr    : false,
			rts    : collision_detection,
			rtscts : collision_detection,
			xany   : false,
			xoff   : false,
			xon    : false,
		},
	};
}

// Function to load modules that require data from config object,
// AFTER the config object is loaded
function load_modules(pass) {
	// Vehicle data bus interface libraries
	intf = {
		config : {
			debug : process.env.BMWI_DEBUG_INTERFACE || false,
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
			debug      : process.env.BMWI_DEBUG_PROTOCOL || false,
			length_min : 5,
			length_max : 1000,
			error_max  : 50,
		},
		proto : null,
	};

	// Load vehicle interface and protocol libs
	switch (app_intf) {
		case 'can0' :
		case 'can1' : {
			intf.type = 'can';
			break;
		}

		case 'dbus' : {
			intf.type = 'bmw';
			break;
		}

		case 'ibus' :
		case 'kbus' : {
			intf.coll = true;
			intf.type = 'bmw';
			break;
		}

		case 'lcd' : {
			intf.pari = 'none';
			intf.type = 'lcd';
			break;
		}
	}

	// Populate interface, options, and protocol
	// using above rendered variables
	intf.intf = require('intf-' + intf.type);
	intf.opts = serial_opts(intf.pari, intf.coll);

	if (intf.type === 'bmw') proto.proto = require('proto-' + intf.type);

	log.module('Loaded modules');

	process.nextTick(pass);
}


// Global init
function init() {
	log.msg('Initializing interface: \'' + app_intf + '\'');

	json.read(() => { // Read JSON config and status files
		json.reset(() => { // Reset status vars pertinent to launching app
			load_modules(() => { // Load IBUS module node modules
				intf.intf.init(() => { // Open defined interface
					socket.init(() => { // Open socket server
						log.msg('Initialized interface: \'' + app_intf + '\'');
					}, term);
				}, term);
			}, term);
		}, term);
	}, term);
}


// Save-N-Exit
function bail() {
	json.status_write(() => { // Write JSON status files
		log.msg('Terminated');
		process.exit();
	});
}

// Global term
function term() {
	if (terminating === true) return;

	terminating = true;

	log.msg('Terminating');

	intf.intf.term(() => { // Close defined interface
		socket.term(() => { // Close zeroMQ server
			json.reset(bail); // Reset status vars pertinent to launching app
		}, term);
	}, bail);
}


// FASTEN SEATBELTS
term_config(init);
