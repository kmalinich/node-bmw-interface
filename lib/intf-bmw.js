const serialport = require('serialport');

const attemptLimit    = 250;
const attemptInterval = 1;


// Output formatted error message
function error_out(message, error) {
	let errorString = `Error '${message}' -`;

	if (typeof error.errno   === 'number') errorString += ` errno: ${error.errno}`;
	if (typeof error.code    === 'string') errorString += ` code: ${error.code}`;
	if (typeof error.syscall === 'string') errorString += ` syscall: ${error.syscall}`;
	if (typeof error.address === 'string') errorString += ` address: ${error.address}`;
	if (typeof error.message === 'string') errorString += ` message: ${error.message}`;

	log.error(errorString);

	return errorString;
}


// Check if we're configured to use the specified port
// Check if the port is open
// Update status object
//
// Handle unspecified interface path,
// interface port null,
// and port.isOpen value not existing yet
function check() {
	log.lib('Checking interface \'' + intf.path + '\'');

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


// Setup/configure serial port
async function configure_port() {
	// Don't continue unless configured to use this port
	check();

	log.lib('Instantiating interface \'' + intf.path + '\'');

	// Instantiate serial port with path and options rendered in main.js
	intf.intf.port = await new serialport(intf.path, intf.opts.init);

	// Send data to the parser
	intf.intf.port.on('data', proto.proto.pusher);

	// Open/close
	intf.intf.port.on('close', check);

	intf.intf.port.on('open', () => {
		log.lib('Instantiated interface \'' + intf.path + '\'');
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


// Send a message
async function send(message) {
	const frameData = await proto.proto.create(message);
	await write(frameData);
} // async send(message)

async function write(frameData, attemptCount = 0) {
	// Check serialport's CTS value before sending
	try {
		const modemStatus = await new Promise((resolve, reject) => {
			intf.intf.port.get((getError, mStat) => {
				if (getError !== null) return reject(getError);
				resolve(mStat);
			});
		});

		// log.lib(`modemStatus: ${JSON.stringify(modemStatus)}`);

		if (modemStatus.cts !== true) {
			if (attemptCount > attemptLimit) {
				log.error(`Failed after ${attemptLimit} attempts to send message with cts: true, src: ${frameData[0]}, dst: ${frameData[2]}`);
				return false;
			}

			attemptCount++;

			log.lib(`Queuing attempt ${attemptCount} (after modemStatus.cts !== true) to send message with cts: true, src: ${hex.i2s(frameData[0])}, dst: ${hex.i2s(frameData[2])}`);
			await new Promise(resolve => setTimeout(resolve, attemptInterval));
			// Line below had await, removed it for testing
			await write(frameData, attemptCount);
			return true;
		}
	}
	catch (serialportGetError) {
		error_out('write() :: serialportGetError', serialportGetError);
		// return false;

		attemptCount++;

		log.lib(`Queuing attempt ${attemptCount} (after serialportGetError) to send message with cts: true, src: ${hex.i2s(frameData[0])}, dst: ${hex.i2s(frameData[2])}`);
		await new Promise(resolve => setTimeout(resolve, attemptInterval));
		// Line below had await, removed it for testing
		await write(frameData, attemptCount);
		return true;
	}

	if (attemptCount > 0) {
		log.lib(`Attempt ${attemptCount} to send message with cts: true, src: ${hex.i2s(frameData[0])}, dst: ${hex.i2s(frameData[2])}`);
	}


	try {
		await new Promise((resolve, reject) => intf.intf.port.write(frameData, resolve, reject));
		await new Promise((resolve, reject) => intf.intf.port.drain(resolve, reject));

		// log.lib('port.write() wrote', frameData);
		return true;
	}
	catch (serialportWriteError) {
		// Bail and retry if there was a write error
		error_out('write() :: serialportWriteError', serialportWriteError);
		return false;
	}
} // async write(frameData, attemptCount)

// Open serial port
async function init() {
	log.lib(`Initializing interface '${intf.path}'`);

	// Open the port
	try {
		// Instantiate and configure the port
		log.lib(`Configuring interface '${intf.path}'`);
		await configure_port();
		log.lib(`Configured interface '${intf.path}'`);

		intf.intf.port.on('error', error => {
			error_out('onPortError', error);
		});

		log.lib(`Opening interface '${intf.path}'`);
		await intf.intf.port.open();
		log.lib(`Opened interface '${intf.path}'`);

		check();

		log.lib(`Initialized interface '${intf.path}'`);

		return true;
	}
	catch (error) {
		error_out('opening interface', error);
		return false;
	}
} // async init()


// Close serial port
async function term() {
	log.lib(`Terminating interface '${intf.path}'`);

	// Check if it's already closed
	const check_result = check();

	if (!check_result) return;

	// Close the port
	try {
		log.lib(`Closing interface '${intf.path}'`);
		await intf.intf.port.close();
		log.lib(`Closed interface '${intf.path}'`);

		check();

		log.lib(`Terminated interface '${intf.path}'`);

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

	// Start/stop functions
	init,
	term,

	// Serial port functions
	send,
};
