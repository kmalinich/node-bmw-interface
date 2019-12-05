/* eslint require-atomic-updates : 0 */


const serialport = require('serialport');


// Output formatted error message
function error_out(message, error) {
	const error_fmt = error.toString().replace(/Error: /, '').replace(/Error: /, '').trim();
	log.lib('Error ' + message + ': ' + error_fmt);
}


// Set serial port options
async function set_options() {
	try {
		await intf.intf.port.set(intf.opts.open);
		log.lib('Initialized');
		return true;
	}
	catch (error) {
		error_out('setting options', error);
		return false;
	}
} // async set_options()


// Check if we're configured to use the specified port
// Check if the port is open
// Update status object
//
// Handle unspecified interface path,
// interface port null,
// and port.isOpen value not existing yet
function check() {
	if (intf.path === null) {
		log.lib('Interface ' + app_intf + ' is not enabled');

		// Update status object
		update.status('intf.up', false, false);

		return false;
	}

	let port_status = false;
	if (intf.intf.port !== null && typeof intf.intf.port.isOpen === 'boolean') {
		port_status = intf.intf.port.isOpen;
	}

	// Update status object
	update.status('intf.up', port_status, false);

	return true;
} // check()


// Setup/configure serial port
async function configure_port() {
	// Don't continue unless configured to use this port
	const check_result = await check();

	if (!check_result) return false;

	// Instantiate serial port,
	// with path and options rendered in main.js
	intf.intf.port = await new serialport(intf.path, intf.opts.init);

	// Send data to the parser
	intf.intf.port.on('readable', async () => {
		// Get readable data from serial port
		const data = await intf.intf.port.read();

		// If it isn't null
		if (data === null) {
			log.lib('port data was null');
			return;
		}

		// Loop to send it one byte at a time to the protocol parser
		for (let byte = 0; byte < data.length; byte++) {
			await proto.proto.pusher(data.readUIntBE(byte, 1));
		}
	});

	// Error
	intf.intf.port.on('error', async (error) => {
		// Update status object
		await check();

		error_out('in port', error);
	});

	// Open/close
	intf.intf.port.on('open',  check);
	intf.intf.port.on('close', check);

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

	// Bail if the write queue is invalid
	if (intf.intf.writing !== true) return;

	const write_len = intf.intf.queue_write.length * -1;
	const write_buf = Buffer.concat(intf.intf.queue_write);

	try {
		await intf.intf.port.write(write_buf);

		// Drain serial port
		// await intf.intf.port.drain();

		// After write, remove number of buffered elements from the end of the write queue
		await intf.intf.queue_write.splice(write_len);

		// Re-kick it
		write();

		// Re-kick it with a delay assumed based on 9600 baud
		// setTimeout(write, (1 / 9.6));
	}
	catch (error) {
		// Bail and retry if there was a write error
		error_out('writing', error);

		// Re-kick it
		write();

		// Re-kick it with a delay assumed based on 9600 baud
		// setTimeout(write, (1 / 9.6));
	}
} // async write()


// Open serial port
async function init() {
	// Open the port
	try {
		// Instantiate and configure the port
		await configure_port();

		log.lib('Opening interface \'' + intf.path + '\'');
		await intf.intf.port.open();
		log.lib('Opened interface \'' + intf.path + '\'');

		await check();
		await set_options();
	}
	catch (error) {
		error_out('opening interface', error);
		return false;
	}
} // async init()

// Close serial port
async function term() {
	log.lib('Terminating');

	// Check if it's already closed
	const check_result = await check();

	if (!check_result) return;

	// Close the port
	try {
		await intf.intf.port.close();

		log.lib('Closed \'' + intf.path + '\'');

		await check();
		log.lib('Terminated');
		return true;
	}
	catch (error) {
		error_out('closing port', error);
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
