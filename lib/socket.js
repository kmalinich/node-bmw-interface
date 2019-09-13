/* eslint no-console : 0 */

// Thanks
// https://gist.github.com/Xaekai/e1f711cb0ad865deafc11185641c632a


const fs   = require('fs');
const net  = require('net');
const jsoc = require('json-socket');


// Return socket URI object from config data
function get_url() {
	switch (config.socket.type) {
		case 'path' :
			return {
				path : config.socket.path + '/bmwi-' + app_intf + '.sock',
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

	let message = {
		intf  : status.system.intf,
		event : event,
		data  : data,
	};

	// Not ready quite yet
	if (socket.conn === null) return;
	if (typeof socket.conn.sendMessage !== 'function') return;

	// Send message over socket
	socket.conn.sendMessage(message);
}

// Handle incoming messages
function recv(message) {
	switch (message.event) {
		case 'bus-tx' : {
			// Send this data to the vehicle bus if we're the intended network destination
			if (message.data.bus === app_intf) bus.data.send(message.data);
		}
	}
}


// Configure event handlers
function init_listeners(pass, fail) {
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

	socket.intf.on('error', (error) => {
		log.lib('error ' + error);
		console.error(error);
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

		// Store connectio in socket.conn for disconnecting later
		socket.conn = (connection);
	});

	log.lib('Initialized listeners');

	process.nextTick(() => {
		init_intf(pass, fail);
		log.lib('Initialized');
	});
}


// Initialize socket server
function init_intf(pass) {
	log.lib('Opening socket');

	// Clean up old socket file if it exists
	fs.stat(get_url().path, (error) => {
		// No old file exists, we're good to go
		if (error) {
			socket.intf.listen(get_url());
			return;
		}

		// Remove old socket file, then start start server
		log.lib('Removing leftover socket');

		fs.unlink(get_url().path, (error) => {
			if (error) {
				// This should never happen
				console.error(error);
				process.exit(5);
			}

			socket.intf.listen(get_url());
		});
	});


	process.nextTick(pass);
}


// Initialize socket server
function init(pass, fail) {
	log.lib('Initializing');

	// Create net.Socket interface
	socket.intf = new net.Server({
		allowHalfOpen : true,
		readable      : true,
		writable      : true,
	});

	// Setup events
	process.nextTick(() => {
		init_listeners(pass, fail);
	});
}

// Terminate socket server
function term(pass) {
	log.lib('Terminating');

	// Disconnect any connected clients
	switch (status.server.connected) {
		case true : {
			if (socket.conn !== null) {
				log.lib('Disconnecting client');
				socket.conn.end();
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

	setTimeout(() => {
		process.nextTick(pass);
		log.lib('Terminated');
	}, 250);
}


module.exports = {
	intf : null,
	conn : null,

	// Start/stop functions
	init : (pass, fail) => { return init(pass, fail); },
	term : (pass, fail) => { return term(pass, fail); },

	// Data sender-wrapper
	send : send,

	// Send and receive vehicle bus data
	bus_rx : (data) => { send('bus-rx', data); },
	bus_tx : (data) => { send('bus-tx', data); },
};
