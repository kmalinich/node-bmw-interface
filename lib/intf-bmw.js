const { SerialPort } = require('serialport-rs');


// Backoff bounds for reconnect attempts
const RECONNECT_DELAY_MIN = 1000;  // ms
const RECONNECT_DELAY_MAX = 30000; // ms

// Resolvers parked by waitPortOpen() while the port is closed. reconnect()
// wakes them after it has swapped a fresh, open port instance into
// intf.intf.port (a guard can't wait on one instance's 'open' event because
// reconnect replaces the instance).
const openWaiters = [];


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
	log.lib(`Checking interface '${intf.path}'`);

	if (typeof intf.path !== 'string' || intf.path === null) {
		log.lib(`Interface ${app_intf} is not enabled, exiting`);
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


// Park until the port is open again. Resolves immediately if the current
// port instance is open; the caller must re-check before writing.
function waitPortOpen() {
	if (intf.intf.port.isOpen === true) return Promise.resolve();

	return new Promise(resolve => openWaiters.push(resolve));
} // waitPortOpen()


// Wake everything parked in waitPortOpen(). Called by reconnect() after the
// fresh port instance is open and swapped into intf.intf.port.
function wakeOpenWaiters() {
	const wakers = openWaiters.splice(0);

	for (const waker of wakers) {
		waker();
	}
} // wakeOpenWaiters()


// Attach the standard listener set to a port instance. Used by
// configure_port() and by reconnect(), which re-instantiates the port on
// every reconnect and must re-attach the full set each time.
function attach_listeners(port) {
	// Send data to the parser
	port.on('data', proto.proto.pusher);

	// Open/close
	port.on('close', async closeError => {
		// Update status object
		check();

		// Re-instantiate and re-open the port. A failed write auto-closes the
		// stream, and its Writable side stays errored afterwards, so writers
		// park in waitPortOpen() until reconnect() swaps in a fresh, open
		// instance.
		if (terminating === true) return;
		await reconnect();
	});

	port.on('open', () => {
		log.lib(`Instantiated interface '${intf.path}'`);
		check();
	});
	port.on('open', check);

	// Error
	port.on('error', error => {
		// Update status object
		check();

		error_out('intf.intf.port', error);

		if (error.message === 'Error Resource temporarily unavailable Cannot lock port') {
			process.exit(8);
		}
	});
	port.on('error', portError => {
		error_out('onPortError', portError);
	});
} // attach_listeners(port)


// Reconnect the port after it has closed.
//
// The stream does not survive a failed write: after a write error the
// Writable side stays errored even if the stream is re-opened, and any later
// write parks in the Writable buffer and never reaches the binding. So each
// reconnect re-instantiates a fresh SerialPort, re-attaches the listener
// set, and swaps it into intf.intf.port before waking parked writers.
//
// openAsync() reports failure via the promise (not an 'error' event), so the
// port-lock exit from configure_port() is replicated here.
async function reconnect() {
	let reconnectDelay = RECONNECT_DELAY_MIN;

	while (true) {
		if (terminating === true) return false;

		try {
			log.lib(`Reopening interface '${intf.path}'`);

			// Fresh instance: the previous one is closed and its Writable
			// side is unusable
			const port = new SerialPort({ path : intf.path, ...intf.opts });
			attach_listeners(port);
			await port.openAsync();

			// Swap in the fresh instance, update status (the 'open' listener
			// ran while the old instance was still in intf.intf.port), then
			// wake the parked writers
			intf.intf.port = port;
			check();
			wakeOpenWaiters();

			log.lib(`Reopened interface '${intf.path}'`);
			return true;
		}
		catch (reconnectError) {
			log.lib(`Reopen of interface '${intf.path}' failed, retrying in ${reconnectDelay} ms`);
			error_out('reconnect()', reconnectError);

			if (reconnectError.message === 'Error Resource temporarily unavailable Cannot lock port') {
				process.exit(8);
			}
		}

		await new Promise(resolve => setTimeout(resolve, reconnectDelay));
		reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_DELAY_MAX);
	} // while (true)
} // async reconnect()


// Setup/configure serial port
async function configure_port() {
	// Don't continue unless configured to use this port
	check();

	log.lib(`Instantiating interface '${intf.path}'`);

	// Instantiate serial port with path and options rendered in main.js
	intf.intf.port = await new SerialPort({ path : intf.path, ...intf.opts });

	attach_listeners(intf.intf.port);

	return true;
} // async configure_port()


// Send a message
function send(message) {
	if (config.options.debug[app_intf] === true) {
		log.lib(`qLen: ${intf.intf.queue.length} :: ${message.src}>${message.dst} :: aC: 0 :: Queuing`);
	}

	const frameData = proto.proto.create(message);

	const queueItem = {
		attemptCount : 0,

		handled : false,

		frameData,

		src : message.src,
		dst : message.dst,
	};

	intf.intf.queue.push(queueItem);

	if (intf.intf.writing === true) return;
	(async () => { await write(); })();
} // send(message)

async function write() {
	if (intf.intf.writing === true) {
		log.lib(`qLen: ${intf.intf.queue.length} :: writing: ${intf.intf.writing} :: write() called inappropriately`);
		return;
	}

	if (config.options.debug[app_intf] === true) {
		log.lib(`qLen: ${intf.intf.queue.length} :: writing: ${intf.intf.writing} :: queue loop start`);
	}

	while (intf.intf.queue.length > 0) {
		intf.intf.writing = true;

		if (config.options.debug[app_intf] === true) {
			log.lib(`qLen: ${intf.intf.queue.length} :: writing: ${intf.intf.writing} :: queue loop iterate`);
		}


		const queueItem = intf.intf.queue[0];

		if (config.options.debug[app_intf] === true) {
			log.lib(`qLen: ${intf.intf.queue.length} :: ${queueItem.src}>${queueItem.dst} :: aC: ${queueItem.attemptCount} :: queueItem loop start`);
		}

		while (queueItem.handled === false) {
			if (config.options.debug[app_intf] === true) {
				log.lib(`qLen: ${intf.intf.queue.length} :: ${queueItem.src}>${queueItem.dst} :: aC: ${queueItem.attemptCount} :: queueItem loop iterate`);
			}

			queueItem.attemptCount++;

			if (queueItem.attemptCount > config.options.attemptLimit[app_intf]) {
				log.error(`qLen: ${intf.intf.queue.length} :: ${queueItem.src}>${queueItem.dst} :: aC: ${queueItem.attemptCount} :: Failed after ${config.options.attemptLimit[app_intf]} attempts to send message`);
				queueItem.handled = true;
				break;
			}

			if (config.options.ctsrts_retry[app_intf] === true) {
				// Check serialport's CTS value before sending
				try {
					const modemStatus = await new Promise((resolve, reject) => {
						intf.intf.port.get((getError, modemStatusData) => {
							if (getError !== null) return reject(getError);
							resolve(modemStatusData);
						});
					});

					if (config.options.debug[app_intf] === true) {
						log.lib(`qLen: ${intf.intf.queue.length} :: ${queueItem.src}>${queueItem.dst} :: aC: ${queueItem.attemptCount} :: modemStatus: { cts: ${modemStatus.cts}, dsr: ${modemStatus.dsr} }`);
					}

					if (modemStatus.cts !== true) {
						if (config.options.debug[app_intf] === true) {
							log.lib(`qLen: ${intf.intf.queue.length} :: ${queueItem.src}>${queueItem.dst} :: aC: ${queueItem.attemptCount} :: Reattempting write with cts: true (after cts: false)`);
						}
						break;
					}
				}
				catch (serialportGetError) {
					log.lib(`qLen: ${intf.intf.queue.length} :: ${queueItem.src}>${queueItem.dst} :: aC: ${queueItem.attemptCount} :: Reattempting write with cts: true (after serialportGetError)`);
					error_out('write() :: serialportGetError', serialportGetError);
					break;
				}
			} // if (config.options.ctsrts_retry[app_intf] === true)


			// A failed write auto-closes the port, and a stream's Writable
			// side stays errored after a write error even if the stream is
			// re-opened, so never write to the current instance while it's
			// closed (a write would park in the Writable buffer and never
			// settle). Park until reconnect() swaps in a fresh, open port;
			// each wake counts as an attempt (incremented above), so the loop
			// stays bounded.
			if (intf.intf.port.isOpen !== true) {
				if (config.options.debug[app_intf] === true) {
					log.lib(`qLen: ${intf.intf.queue.length} :: ${queueItem.src}>${queueItem.dst} :: aC: ${queueItem.attemptCount} :: Reattempting write (port closed, awaiting reconnect)`);
				}
				await waitPortOpen();
				continue;
			}

			try {
				await intf.intf.port.writeAsync(queueItem.frameData);
				// await intf.intf.port.drainAsync();

				// Only log after multiple attempts
				if (queueItem.attemptCount > 1 || config.options.debug[app_intf] === true) {
					log.lib(`qLen: ${intf.intf.queue.length} :: ${queueItem.src}>${queueItem.dst} :: aC: ${queueItem.attemptCount} :: Wrote`);
				}

				queueItem.handled = true;
			}
			catch (serialportWriteError) {
				// Bail and retry if there was a write error
				log.lib(`qLen: ${intf.intf.queue.length} :: ${queueItem.src}>${queueItem.dst} :: aC: ${queueItem.attemptCount} :: Reattempting write after serialportWriteError`);
				error_out('write() :: serialportWriteError', serialportWriteError);
			}
		} // while (queueItem.handled === false)

		if (config.options.debug[app_intf] === true) {
			log.lib(`qLen: ${intf.intf.queue.length} :: ${queueItem.src}>${queueItem.dst} :: aC: ${queueItem.attemptCount} :: queueItem loop complete`);
		}

		if (queueItem.handled === true) {
			await intf.intf.queue.shift();
		}
	} // while (intf.intf.queue.length > 0)

	if (config.options.debug[app_intf] === true) {
		log.lib(`qLen: ${intf.intf.queue.length} :: writing: ${intf.intf.writing} :: queue loop complete`);
	}

	intf.intf.writing = false;
} // async write()

/* eslint no-unused-vars: 0 */
async function setInterfaceOptions() {
	try {
		log.lib(`Setting options for interface '${intf.path}'`);

		await new Promise((resolve, reject) => {
			intf.intf.port.set({ lowLatency : true }, setError => {
				if (setError !== null) return reject(setError);
				resolve();
			});
		});

		log.lib(`Set options for interface '${intf.path}'`);
	}
	catch (interfacePortSetError) {
		error_out('setting interface options', interfacePortSetError);
		return false;
	}
} // async setInterfaceOptions()


// Open serial port
async function init() {
	log.lib(`Initializing interface '${intf.path}'`);

	try {
		// Instantiate and configure the port
		log.lib(`Configuring interface '${intf.path}'`);
		await configure_port();
		log.lib(`Configured interface '${intf.path}'`);
	}
	catch (interfacePortConfigureError) {
		error_out('configuring interface', interfacePortConfigureError);
		return false;
	}

	// Open the port
	try {
		log.lib(`Opening interface '${intf.path}'`);
		await intf.intf.port.open();
		log.lib(`Opened interface '${intf.path}'`);
	}
	catch (interfacePortOpenError) {
		error_out('opening interface', interfacePortOpenError);
		return false;
	}

	// check();

	log.lib(`Initialized interface '${intf.path}'`);
	return true;
} // async init()


// Close serial port
async function term() {
	log.lib(`Terminating interface '${intf.path}'`);

	// Check if it's already closed
	if (!check()) return;

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
	queue   : [],
	writing : false,

	// Serial interface
	port : null,

	// Start/stop functions
	init,
	term,

	// Serial port functions
	send,
};
