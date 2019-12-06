/* eslint require-atomic-updates : 0 */


// Thanks
// https://gist.github.com/Xaekai/e1f711cb0ad865deafc11185641c632a

const fs   = require('fs');
const net  = require('net');
const jsoc = require('json-socket');


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

// Return socket URI object from config data
function get_url() {
	switch (config.socket.type) {
		case 'path' :
			return {
				path : config.socket.path + '/' + app_name + '-' + app_intf + '.sock',
			};

		case 'net' :
			return {
				host   : config.socket.host,
				port   : config.socket.port,
				family : 4,
			};
	}
}


// Send data over socket
async function send(event, data) {
	if (socket.intf === null) return;

	const message = {
		intf : status.system.intf,
		event,
		data,
	};

	// Not ready quite yet
	if (socket.conn === null) return;
	if (typeof socket.conn.sendMessage !== 'function') return;

	// Send message over socket
	await socket.conn.sendMessage(message);
} // async send(event, data)

// Handle incoming messages
async function recv(message) {
	switch (message.event) {
		case 'bus-tx' : {
			// Send this data to the vehicle bus if we're the intended network destination
			if (message.data.bus === app_intf) await bus.data.send(message.data);
		}
	}
} // async recv(message)


// Configure event handlers
function init_listeners() {
	// When the socket server is up and listening
	socket.intf.on('listening', () => {
		log.lib('Listening on \'' + get_url().path + '\'');
		update.status('server.connecting',   false, false);
		update.status('server.reconnecting', false, false);
	});

	socket.intf.on('close', () => {
		log.lib('close');
		update.status('server.connected', false, false);
	});

	socket.intf.on('error', error => {
		error_out('socket.intf', error);
	});


	// When a new client connects
	socket.intf.on('connection', (connection) => {
		update.status('server.connected', true, false);

		// Decorate socket to be a JsonSocket
		connection = new jsoc(connection);

		log.lib('Client connected');

		// When socket client sends data
		connection.on('message', (message) => {
			log.lib(message.event + ' message received from ' + message.intf + ' (' + message.data.bus + ')');
			recv(message);
		});

		// When socket client disconnects
		connection.on('end', () => {
			log.lib('Client disconnected');

			// Delete this client's connection
			socket.conn = null;
		});

		// Store connection in socket.conn for disconnecting later
		socket.conn = (connection);
	});

	log.lib('Initialized listeners');
}


// Initialize socket server
async function init_intf() {
	try {
		// Clean up old socket file if it exists
		const existing = await fs.statSync(get_url().path);

		if (existing) {
			// Remove old socket file
			log.lib('Removing existing socket');
			await fs.unlinkSync(get_url().path);
			log.lib('Removed existing socket');
		}
	}
	catch (error) {
		switch (error.errno) {
			case -2 : log.lib('Socket path OK'); break;

			default : {
				error_out('socket fs.statSync()', error);
				process.exit(error.code);
			}
		}
	}

	try {
		log.lib('Opening socket');
		await socket.intf.listen(get_url());
		log.lib('Opened socket');
	}
	catch (error) {
		// This should never happen
		error_out('opening socket', error);
		process.exit(5);
	}
} // async init_intf()


// Initialize socket server
async function init() {
	log.lib('Initializing');

	// Create net.Socket interface
	socket.intf = new net.Server({
		allowHalfOpen : true,
		readable      : true,
		writable      : true,
	});

	// Setup events
	await init_intf();
	await init_listeners();

	log.lib('Initialized');
} // async init()

// Terminate socket server
async function term() {
	log.lib('Terminating');

	// Disconnect any connected clients
	switch (status.server.connected) {
		case true : {
			if (socket.conn !== null) {
				log.lib('Disconnecting client');
				await socket.conn.end();
				socket.conn = null;
			}

			log.lib('Disconnecting socket');
			socket.intf.close();
			socket.intf = null;
			break;
		}

		case false : {
			log.lib('Socket already disconnected');
		}
	}
} // async term()


async function bus_rx(data) {
	await send('bus-rx', data);
} // async bus_rx(data)

async function bus_tx(data) {
	await send('bus-tx', data);
} // async bus_tx(data)


module.exports = {
	intf : null,
	conn : null,

	// Start/stop functions
	init,
	term,

	// Data sender-wrapper
	send,

	// Send and receive vehicle bus data
	bus_rx,
	bus_tx,
};
