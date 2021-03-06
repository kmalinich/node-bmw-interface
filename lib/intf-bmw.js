/* eslint require-atomic-updates : 0 */

const serialport = require('serialport');

// Output formatted error message
function error_out(message, error) {
	let error_string = 'Error \'' + message + '\' -';

	if (typeof error.errno   === 'number') error_string += ' errno: '   + error.errno;
	if (typeof error.code    === 'string') error_string += ' code: '    + error.code;
	if (typeof error.syscall === 'string') error_string += ' syscall: ' + error.syscall;
	if (typeof error.address === 'string') error_string += ' address: ' + error.address;
	if (typeof error.message === 'string') error_string += ' message: ' + error.message;

	log.error(error_string);

	return error_string;
}


// Set serial port options
function set_options() {
	try {
		log.lib('Setting options on interface \'' + intf.path + '\'');
		intf.intf.port.set(intf.opts.open);
		log.lib('Set options on interface \'' + intf.path + '\'');
		return true;
	}
	catch (error) {
		error_out('set_options()', error);
		return false;
	}
} // set_options()


// Check if we're configured to use the specified port
// Check if the port is open
// Update status object
//
// Handle unspecified interface path,
// interface port null,
// and port.isOpen value not existing yet
function check() {
	log.msg('Checking interface \'' + intf.path + '\'');

	if (typeof intf.path !== 'string' || intf.path === null) {
		log.lib('Interface ' + app_intf + ' is not enabled, exiting');
		process.exit(0);
	}

	let port_status = false;
	if (intf.intf.port !== null && typeof intf.intf.port.isOpen === 'boolean') {
		port_status = intf.intf.port.isOpen;
	}

	// Update status object
	update.status('intf.up', port_status, false);

	return true;
} // check()

function read_port() {
	// Get readable data from serial port
	const data = intf.intf.port.read();

	// If it isn't null
	if (data === null) {
		log.error('port data was null');
		return null;
	}

	return proto.proto.pusher(data);
} // read_port()


// Setup/configure serial port
async function configure_port() {
	log.msg('Configuring interface \'' + intf.path + '\'');

	// Don't continue unless configured to use this port
	check();

	log.msg('Instantiating interface \'' + intf.path + '\'');

	// Instantiate serial port with path and options rendered in main.js
	intf.intf.port = await new serialport(intf.path, intf.opts.init);

	// Send data to the parser
	intf.intf.port.on('readable', read_port);

	// Open/close
	intf.intf.port.on('close', check);
	intf.intf.port.on('open', () => {
		set_options();
		check();
	});

	// Error
	intf.intf.port.on('error', error => {
		// Update status object
		check();

		error_out('intf.intf.port', error);

		if (error.message === 'Error Resource temporarily unavailable Cannot lock port') {
			process.exit(8);
		}
	});

	return true;
} // async configure_port()


// Add a message to the write queue
async function send(message) {
	// Create Buffer from message
	const buffer = await proto.proto.create(message);

	if (typeof buffer === 'undefined' || buffer === null || buffer === '') return;

	await intf.intf.queue_write.unshift(buffer);

	// Start write process if need be
	if (intf.intf.writing !== true) await write();
} // async send(message)


// Write a buffer to the serial port
async function write() {
	// Update writing status
	intf.intf.writing = Boolean(intf.intf.queue_write.length > 0);

	// Bail if the write queue is empty
	if (intf.intf.writing !== true) return;

	const write_len = intf.intf.queue_write.length * -1;
	const write_buf = Buffer.concat(intf.intf.queue_write);

	try {
		await intf.intf.port.write(write_buf);

		// Drain serial port
		await intf.intf.port.drain();

		// After write, remove number of buffered elements from the end of the write queue
		await intf.intf.queue_write.splice(write_len);
	}
	catch (error) {
		// Bail and retry if there was a write error
		error_out('writing', error);
	}

	// Re-kick it
	await write();
} // async write()


// Open serial port
async function init() {
	log.msg('Initializing interface \'' + intf.path + '\'');

	// Open the port
	try {
		// Instantiate and configure the port
		log.lib('Configuring interface \'' + intf.path + '\'');
		await configure_port();
		log.lib('Configured interface \'' + intf.path + '\'');

		log.lib('Opening interface \'' + intf.path + '\'');
		await intf.intf.port.open();
		log.lib('Opened interface \'' + intf.path + '\'');

		check();

		log.msg('Initialized interface \'' + intf.path + '\'');

		return true;
	}
	catch (error) {
		error_out('opening interface', error);
		return false;
	}
} // async init()

// Close serial port
async function term() {
	log.msg('Terminating interface \'' + intf.path + '\'');

	// Check if it's already closed
	const check_result = check();

	if (!check_result) return;

	// Close the port
	try {
		log.lib('Closing interface \'' + intf.path + '\'');
		await intf.intf.port.close();
		log.lib('Closed interface \'' + intf.path + '\'');

		check();

		log.msg('Terminated interface \'' + intf.path + '\'');

		return true;
	}
	catch (error) {
		error_out('closing interface', error);
		return false;
	}
} // async term()


module.exports = {
	// Serial interface
	port : null,

	// Write queue array
	queue_write : [],

	writing : false,

	// Start/stop functions
	init,
	term,

	// Serial port functions
	send,
};
