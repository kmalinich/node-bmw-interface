/* eslint no-console : 0 */

// Thanks
// https://gist.github.com/Xaekai/e1f711cb0ad865deafc11185641c632a


const amp = require('amp-message');
const fs  = require('fs');
const net = require('net');


// Return socket URI object from config data
function get_url() {
	return {
		path : '/usr/local/var/run/bmwi-' + app_intf + '.sock',
	};

	// return {
	// 	host   : config.socket.host,
	// 	port   : config.socket.port,
	// 	family : 4,
	// };
}


// Send data over socket
function send(event, data) {
	// Don't bother sending anything if we're disconnected
	if (status.server.connected === false) {
		// log.msg('Server disconnected, cannot send message');
		return;
	}

	let message = {
		intf  : status.system.intf,
		event : event,
		data  : data,
	};

	// Encode object as AMP message
	let amp_message = new amp();
	amp_message.push(message);

	// Send AMP message over socket
	if (socket.intf !== null) socket.intf.write(amp_message.toBuffer());
}

// Handle incoming messages
function recv(message) {
	// Decode AMP-encoded messages from socket
	let data = new amp(message).shift();

	switch (data.event) {
		case 'bus-tx' : {
			// Send this data to the vehicle bus if we're the intended network destination
			if (data.data.bus === app_intf) bus.data.send(data.data);
		}
	}
}


// Configure event handlers
function event_config(pass, fail) {
	// When the socket server is up and listening
	socket.intf.on('listening', () => {
		log.msg('Listening on \'' + get_url().path + '\'');
		update.status('server.connected',    true, false);
		update.status('server.connecting',   false, false);
		update.status('server.reconnecting', false, false);
	});

	socket.intf.on('close', () => {
		log.msg('close');
		update.status('server.connected', false, false);
	});

	socket.intf.on('error', (error) => {
		log.msg('error ' + error);
		console.error(error);
	});


	// When a new client connects
	socket.intf.on('connection', (connection) => {
		// Store connection in socket.connections object for disconnecting later
		let this_conn = Date.now();
		socket.connections[this_conn] = (connection);

		log.msg('Client \'' + this_conn + '\' connected');

		// When socket client sends data
		connection.on('data', (message) => {
			log.msg('Message received from client \'' + this_conn + '\'');
			recv(message);
		});

		// When socket client disconnects
		connection.on('end', () => {
			log.msg('Client \'' + this_conn + '\' disconnected');

			// Delete this client's connection from socket.connections object
			delete socket.connections[this_conn];
		});
	});

	log.msg('Configured event listeners');


	// Configure interfaces
	process.nextTick(() => {
		intf_listen(pass, fail);
		log.msg('Initialized');
	});
}


function intf_listen(pass) {
	log.msg('Opening socket');

	// Clean up old socket file if it exists
	fs.stat(get_url().path, (error) => {
		// No old file exists, we're good to go
		if (error) {
			socket.intf.listen(get_url());
			return;
		}

		// Remove old socket file, then start start server
		log.msg('Removing leftover socket');

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
	log.msg('Initializing');

	// Create net.Socket interface
	socket.intf = new net.Server({
		allowHalfOpen : false,
		readable      : true,
		writable      : true,
	});

	// Setup events
	process.nextTick(() => {
		event_config(pass, fail);
	});
}

// Terminate socket server
function term(pass) {
	log.msg('Terminating');

	// Disconnect any connected clients
	switch (status.server.connected) {
		case true : {
			if (Object.keys(socket.connections).length) {
				let clients = Object.keys(socket.connections);

				while (clients.length) {
					let client = clients.pop();

					log.msg('Disconnecting client ' + client);
					socket.connections[client].end();
				}
			}

			socket.intf.close();
			socket.intf = null;
			break;
		}

		case false : {
			log.msg('Socket already disconnected');
		}
	}

	setTimeout(() => {
		process.nextTick(pass);
		log.msg('Terminated');
	}, 250);
}


module.exports = {
	intf : null,

	connections : {},

	// Start/stop functions
	init : (pass, fail) => { return init(pass, fail); },
	term : (pass, fail) => { return term(pass, fail); },

	// Data sender-wrapper
	send : send,

	// Send and receive vehicle bus data
	bus_rx : (data) => { send('bus-rx', data); },
	bus_tx : (data) => { send('bus-tx', data); },
};
