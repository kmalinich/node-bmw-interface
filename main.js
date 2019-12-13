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


// Render serialport options object
function serial_opts(parity, collision_detection) {
	// DBUS+IBUS+KBUS : 9600 8e1

	return {
		init : {
			autoOpen : false,
			baudRate : 9600,
			parity,
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
} // serial_opts(parity, collision_detection)

// Function to load modules that require data from config object,
// AFTER the config object is loaded
async function load_modules() {
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
		}
	}

	// Populate interface, options, and protocol
	// using above rendered variables
	intf.intf = require('intf-' + intf.type);
	intf.opts = serial_opts(intf.pari, intf.coll);

	if (intf.type === 'bmw') proto.proto = require('proto-' + intf.type);

	log.msg('Loaded modules');
} // async load_modules()


// Configure term event listeners
async function term_config() {
	process.on('SIGTERM', async () => {
		if (terminating === true) return;

		console.log('');
		config.console.output = true;
		log.msg('Caught SIGTERM');
		await term();
	});

	process.on('SIGINT', async () => {
		if (terminating === true) return;

		console.log('');
		config.console.output = true;
		log.msg('Caught SIGINT');
		await term();
	});

	process.on('exit', () => {
		config.console.output = true;
		log.msg('Caught exit event');
	});
} // async term_config()

// Global init
async function init() {
	log.msg('Initializing interface: \'' + app_intf + '\'');

	await term_config();
	await json.read();      // Read JSON config and status files
	await json.reset();     // Reset status vars pertinent to launching app
	await load_modules();   // Configure interface and protocol
	await intf.intf.init(); // Open defined interface
	await socket.init();    // Open socket server

	log.msg('Initialized interface: \'' + app_intf + '\'');
} // async init()

// Global term
async function term() {
	if (terminating === true) return;

	terminating = true;

	log.msg('Terminating');

	await intf.intf.term(); // Close defined interface
	await socket.term();    // Close socket server
	await json.write();     // Write JSON config and status files

	log.msg('Terminated');

	process.exit();
} // async term()


// FASTEN SEATBELTS
init();
