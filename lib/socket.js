// Thanks
// https://gist.github.com/Xaekai/e1f711cb0ad865deafc11185641c632a

const fs   = require('fs');
const net  = require('net');
const jsoc = require('json-socket');


// Output formatted error message
function errorOut(message, error) {
	let errorString = `Error '${message}' -`;

	if (typeof error.errno   === 'number') errorString += ` errno: ${error.errno}`;
	if (typeof error.code    === 'string') errorString += ` code: ${error.code}`;
	if (typeof error.syscall === 'string') errorString += ` syscall: ${error.syscall}`;
	if (typeof error.address === 'string') errorString += ` address: ${error.address}`;
	if (typeof error.message === 'string') errorString += ` message: ${error.message}`;

	log.error(errorString);

	return errorString;
}

// Return socket URI object from config data
function getUrl() {
	switch (config.socket.type) {
		case 'path' :
			return {
				path : `${config.socket.path}/${app_name}-${app_intf}.sock`,
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
function send(event, data) {
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
	socket.conn.sendMessage(message);
} // send(event, data)

// Handle incoming messages
function recv(message) {
	switch (message.event) {
		case 'bus-tx' : {
			// Send this data to the vehicle bus if we're the intended network destination
			if (message.data.bus === app_intf) bus.data.send(message.data);
		}
	}
} // recv(message)


// Configure event handlers
function initListeners() {
	// When the socket server is up and listening
	socket.intf.on('listening', () => {
		log.lib(`Listening on '${getUrl().path}'`);
		update.status('server.connecting',   false, false);
		update.status('server.reconnecting', false, false);
	});

	socket.intf.on('close', () => {
		log.lib('close');
		update.status('server.connected', false, false);
	});

	socket.intf.on('error', error => {
		errorOut('socket.intf', error);
	});


	// When a new client connects
	socket.intf.on('connection', connection => {
		update.status('server.connected', true, false);

		// Decorate socket to be a JsonSocket
		connection = new jsoc(connection);

		log.lib('Client connected');

		// When socket client sends data
		connection.on('message', message => {
			// log.lib(message.event + ' message received from ' + message.intf + ' (' + message.data.bus + ')');
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
async function initIntf() {
	try {
		// Clean up old socket file if it exists
		const existing = await fs.statSync(getUrl().path);

		if (existing) {
			// Remove old socket file
			log.lib('Removing existing socket');
			await fs.unlinkSync(getUrl().path);
			log.lib('Removed existing socket');
		}
	}
	catch (error) {
		switch (error.errno) {
			case -2 : log.lib('Socket path OK'); break;

			default : {
				errorOut('socket fs.statSync()', error);
				process.exit(1);
			}
		}
	}

	try {
		log.lib('Opening socket');
		await socket.intf.listen(getUrl());
		log.lib('Opened socket');
	}
	catch (error) {
		// This should never happen
		errorOut('opening socket', error);
		process.exit(5);
	}
} // async initIntf()


// Initialize socket server
async function init() {
	log.lib('Initializing');

	// Create net.Socket interface
	socket.intf = new net.Server({
		allowHalfOpen : true,
		readable      : true,
		writable      : true,
	});

	await initIntf();

	// Setup events
	initListeners();

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


module.exports = {
	intf : null,
	conn : null,

	// Start/stop functions
	init,
	term,

	// Data sender-wrapper
	send,
};
