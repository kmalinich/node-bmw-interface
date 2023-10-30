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
num     = require('num');
socket  = require('socket');

// Class/event-based modules
update = new (require('update'))();


// Render serial port options object
function serialOpts(baudRate, parity) {
	// DBUS+IBUS+KBUS : 9600 8e1

	return {
		autoOpen : false,
		rtscts   : true,
		// rtscts   : config.options.ctsrts_retry[app_intf],

		baudRate,
		parity,
	};
} // serialOpts(baudRate, parity)

// Function to load modules that require data from config object,
// AFTER the config object is loaded
function loadModules() {
	// Vehicle data bus interface libraries
	intf = {
		config : {
			debug : process.env.BMWI_DEBUG_INTERFACE || false,
		},

		path : config.intf[app_intf],
	};

	// Vehicle data bus protocol config
	proto = {
		config : {
			debug : process.env.BMWI_DEBUG_PROTOCOL || false,

			msg_length_min : 5,
			msg_length_max : 60,

			queue_length_max : 1000,

			error_max : 50,
		},

		proto : null,
	};


	let intfBaudRate;
	let intfParity;
	let intfType;

	// Load vehicle interface and protocol libs
	switch (app_intf) {
		case 'can0' :
		case 'can1' : {
			intfType = 'can';
			break;
		}

		case 'dbus' : {
			intfBaudRate = 9600;
			intfParity   = 'even';
			intfType     = 'bmw';
			break;
		}

		case 'ibus' :
		case 'kbus' : {
			intfBaudRate = 9600;
			intfParity   = 'even';
			intfType     = 'bmw';
			break;
		}

		case 'isp2' : {
			intfBaudRate = 19200;
			intfParity   = 'none';
			intfType     = 'isp2';
		}
	}

	// Populate interface, options, and protocol using above rendered variables
	intf.intf = require(`intf-${intfType}`);
	intf.opts = serialOpts(intfBaudRate, intfParity);

	if (intfType === 'bmw') {
		proto.proto = require(`proto-${intfType}`);
	}

	log.msg('Loaded modules');
} // loadModules()


async function signalTerm(signal = 'unknown') {
	if (terminating === true) return;

	console.log('');

	config.console.output = true;
	log.msg(`Caught signal: '${signal}'`);
	await term();
} // async signalTerm(signal)

// Global term
async function term() {
	if (terminating === true) return;

	terminating = true;

	log.msg('Terminating');

	// Close defined interface
	try {
		await intf.intf.term();
	}
	catch (intfTermError) {
		log.error(intfTermError);
	}

	await socket.term(); // Close socket server
	await json.write();  // Write JSON config and status files

	log.msg('Terminated');

	process.exit();
} // async term()


// Global init
async function init() {
	// Enable console output
	config = { console : { output : true } };

	log.msg(`Initializing network interface: '${app_intf}'`);

	// Configure term event listeners
	process.on('exit',    async () => signalTerm('exit'));
	process.on('SIGINT',  async () => signalTerm('SIGINT'));
	process.on('SIGTERM', async () => signalTerm('SIGTERM'));

	await json.read();  // Read JSON config and status files
	await json.reset(); // Reset status vars pertinent to launching app

	loadModules(); // Configure interface and protocol

	await intf.intf.init(); // Open defined interface
	await socket.init();    // Open socket server

	log.msg(`Initialized network interface '${app_intf}'`);
} // async init()

// FASTEN SEATBELTS
(async () => { await init(); })();
