const module_name = __filename.slice(__dirname.length + 1, -3);

const socket_io = require('socket.io');

// Handle incoming client messages
function on_client_tx(client, data) {
	// log.socket({
	// 	method : 'rx',
	// 	type   : data.host.type,
	// 	event  : data.event,
	// 	string : data.host.host.short,
	// });

	// Hairpin the message so other WebSocket clients can see it, too
	send_except('client-tx', data, client.client.id);

	switch (data.event) {
		case 'status-request'    : status_tx     (); break;
		case 'host-data-request' : host_data.send(); break;

		case 'bus-tx'      : bus_data.send        (data.data); break;
		case 'lcd-text'    : interface.lcd.text   (data.data); break;
		case 'lcd-color'   : interface.lcd.color  (data.data); break;
		case 'lcd-command' : interface.lcd.command(data.data); break;
		case 'log-bus'     : log.bus              (data.data); break;
		case 'log-msg'     : log.socket           (data);      break; // Broken, fix this
		case 'host-data'   : on_host_data         (data);      break;
	}
}


// Handle incoming host-data messages
function on_host_data(data) {
	return;

	log.socket({
		method : 'rx',
		type   : data.data.type,
		event  : data.data.host.short+' => temp',
		string : data.data.temperature+'c',
	});
}

// Send data over WebSocket
function send(event, data) {
	// Don't bother sending anything if there aren't any clients
	if (socket.counts.clients === 0 || status.server.up === false) return;

	// log.socket({
	// 	method : 'tx',
	// 	type   : status.system.type,
	// 	event  : event,
	// 	string : '',
	// });

	let message = {
		host  : status.system,
		event : event,
		data  : data,
	};

	socket.io.emit('daemon-tx', message);
}

// Send to everyone except a specified client ID
function send_except(event, data, client_id) {
	Object.keys(socket.clients).forEach((key) => {
		if (key !== client_id) socket.clients[key].emit(event, data);
	});
}

// Handle a new client connection
function on_connection(client) {
	socket.clients[client.id] = client;
	socket.counts.clients++;

	host_data.send();

	// Add querying the client's type here

	client.id_short = client.id.substring(0, 14);

	interface.lcd.text({
		upper : 'bmwcd connect',
		lower : client.id_short,
	});

	log.msg({
		src : module_name,
		msg : 'Client ID '+client.id_short+' connected'
	});

	// Receive from bmwcd
	client.on('client-tx', (data) => { on_client_tx(client, data); });

	client.on('disconnect', () => {
		socket.counts.clients--;
		delete socket.clients[client.id];

		interface.lcd.text({
			upper : 'bmwcd disconnect',
			lower : client.id_short,
		});

		log.msg({
			src : module_name,
			msg : 'Client ID '+client.id_short+' disconnected'
		});
	});
}

// Initialize WebSocket server
function startup(startup_callback = null) {
	socket.io = new socket_io(config.server.port, socket.options);
	// socket.io = new socket_io(config.server.port);

	status.server.up = true;

	log.msg({
		src : module_name,
		msg : 'Listening on port '+config.server.port,
	});

	// When a client connects
	socket.io.on('connection', (client) => { on_connection(client); });

	socket.io.on('error', (error) => {
		log.msg({
			src : module_name,
			msg : 'Error '+error,
		});
	});

	if (typeof startup_callback === 'function') { startup_callback(); }
	startup_callback = undefined;
}

// Terminate WebSocket server
function shutdown(shutdown_callback = null) {
	socket.io.close(() => {
		status.server.up = false;

		// Call function to reset the timeout
		host_data.send();

		log.msg({
			src : module_name,
			msg : 'Port closed',
		});

		if (typeof shutdown_callback === 'function') { shutdown_callback(); }
		shutdown_callback = undefined;
	}, shutdown_callback);
}


module.exports = {
	io     : null,
	server : null,

	options : {
		httpCompression   : false,
		perMessageDeflate : false,
		pingInterval      : 2500,
		pingTimeout       : 10000,
	},

	options_old : {
		autoConnect          : false,
		httpCompression      : false,
		path                 : '/socket.io',
		perMessageDeflate    : false,
		pingInterval         : 2500,
		pingTimeout          : 10000,
		randomizationFactor  : 0.5,
		reconnection         : true,
		reconnectionAttempts : Infinity,
		reconnectionDelay    : 250,
		reconnectionDelayMax : 1000,
		rememberUpgrade      : true,
		timeout              : 2500,
		transports           : ['websocket'],
	},

	clients    : {},
	interfaces : {},

	counts : {
		clients    : 0,
		interfaces : 0,
	},

	startup  : (startup_callback)  => { startup(startup_callback);   },
	shutdown : (shutdown_callback) => { shutdown(shutdown_callback); },

	// Send data recived from vehicle data bus to bmwcd
	bus_rx : (data) => { send('bus-rx', data); },

	// Send status data object for use by other WebSocket clients
	status_tx : () => { send('status', status); },

	send : (event, data) => { send(event, data); },
};
