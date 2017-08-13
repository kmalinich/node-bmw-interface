const amp    = require('amp-message');
const zeromq = require('zeromq');


// Handle incoming messages
function on_data(data) {
	// console.dir(data, { showHidden: true, depth: null, colors: true});

	switch (data.event) {
		case 'bus-tx' :
			if (data.data.bus === app_type) bus.data.send(data.data);
			break;

		case 'bus-rx' :
			if (app_type == 'client') bus.data.receive(data.data.bus);
			break;

			// case 'host-data'         : on_host_data(data);          break;
		case 'host-data-request' : host_data.send();            break;
		case 'status-request'    : socket.status_tx(data.data); break;

			// case 'log-bus'     : log.bus   (data.message); break;
			// case 'log-msg'     : log.socket(data);         break; // Broken, fix this
			// case 'lcd-color'   :
			// case 'lcd-command' :
			// case 'lcd-text'    :
			// default            :
	}

	// log.socket({
	// 	method : 'rx',
	// 	type   : data.host.type,
	// 	event  : data.event,
	// 	string : data.host.host.short,
	// });
}

// Handle incoming host-data messages
// function on_host_data(data) {
// 	log.socket({
// 		method : 'rx',
// 		type   : data.data.type,
// 		event  : data.data.host.short+' => temp',
// 		string : data.data.temperature+'c',
// 	});
// }

// Send data over zeroMQ
function send(event, data) {
	// Don't bother sending anything if we're disconnected
	if (status.server.connected === false) {
		log.msg({ msg : 'Server disconnected, cannot send message' });

		return;
	}

	let message = {
		host  : status.system,
		event : event,
		data  : data,
	};

	// Encode object as AMP message
	let amp_message = new amp;
	amp_message.push(message);

	// Send AMP message over zeroMQ
	socket.interfaces[app_type].send([ app_type+'-tx', amp_message.toBuffer() ]);

	// log.socket({
	// 	method : 'tx',
	// 	type   : status.system.type,
	// 	event  : event,
	// 	string : '',
	// });
}

// Decode AMP-encoded messages from zeroMQ
function decode_amp(message) {
	let data = new amp(message).shift();
	// console.log(JSON.stringify(data, null, 2));

	// Parse received data
	on_data(data);
}


// Configure event handlers
function event_config(pass) {
	Object.keys(socket.interfaces).forEach((socket_intf) => {
		// When a peer connects
		socket.interfaces[socket_intf].on('connect', () => {
			log.module({ msg : 'Peer connected' });
		});

		// When a peer disconnects
		socket.interfaces[socket_intf].on('disconnect', () => {
			log.module({ msg : 'Peer disconnected' });
		});

		socket.interfaces[socket_intf].on('error', (error) => {
			log.module({ msg : 'Error '+error });
			// console.log(error);
		});

		socket.interfaces[socket_intf].on('message', (topic, message) => {
			log.module({ msg : topic+' message received via '+socket_intf });
			// Decode AMP message
			decode_amp(message);
		});
	});

	socket.interfaces[app_type].on('bind', () => {
		update.status('server.connected', true);

		update.status('server.connecting',   false);
		update.status('server.reconnecting', false);

		// Send this host's data to zeroMQ clients to update them
		host_data.send();
	});

	socket.interfaces[app_type].on('unbind', () => {
		update.status('server.connected', false);

		if (app_type == 'client') {
			// Reset basic vars
			json.status_reset_basic(() => {});
		}
	});

	log.module({ msg : 'Initialized event listeners' });

	pass();
	return true;
}

// Return full zeroMQ URL from config data
function get_url(socket_intf) {
	let zmq_conf = config.zeromq;
	return zmq_conf.proto+'://'+zmq_conf.urls[socket_intf]+':'+zmq_conf.ports[socket_intf];
}

// Return zeroMQ socket type from config data
function get_type(socket_intf) {
	if (socket_intf === app_type) return 'pub';
	return 'sub';
}

// Initialize zeroMQ server
function init(pass, fail) {
	log.msg({ msg : 'Initializing' });

	// Setup events
	event_config(() => {
		// Bind server
		socket.interfaces[app_type].bind(get_url(app_type), (error) => {
			if (error) {
				log.module({ msg : 'zeroMQ server bind '+error });

				fail();
				return false;
			}

			// Connect interfaces and subscribe to topics
			if (app_type == 'client') {
				// Connect to all if client
				Object.keys(socket.interfaces).forEach((socket_intf) => {
					if (socket_intf !== app_type) {
						socket.interfaces[socket_intf].connect(get_url(socket_intf));
						socket.interfaces[socket_intf].subscribe(socket_intf+'-tx');
						socket.interfaces[socket_intf].subscribe('daemon-tx');
						socket.interfaces[socket_intf].subscribe('client-tx');
						socket.interfaces[socket_intf].subscribe('bus-rx');
						update.status('server.interfaces.'+socket_intf, true);
					}
				});
			}
			else {
				// Only connect to client if not client
				let socket_intf = 'client';
				socket.interfaces[socket_intf].connect(get_url(socket_intf));
				socket.interfaces[socket_intf].subscribe(socket_intf+'-tx');
				socket.interfaces[socket_intf].subscribe('daemon-tx');
				socket.interfaces[socket_intf].subscribe('client-tx');
				socket.interfaces[socket_intf].subscribe('bus-rx');
				update.status('server.interfaces.'+socket_intf, true);
			}

			log.module({ msg : 'Initialized' });

			pass();
			return true;
		});
	});
}

// Terminate zeroMQ server
function term(pass, fail) {
	log.msg({ msg : 'Terminating' });

	// Disconnect interfaces
	if (app_type == 'client') {
		Object.keys(socket.interfaces).forEach((socket_intf) => {
			if (socket_intf !== app_type) {
				socket.interfaces[socket_intf].disconnect(get_url(socket_intf));
				update.status('server.interfaces.'+socket_intf, false);
			}
		});
	}
	else {
		// Only disconnect from client if not client
		let socket_intf = 'client';
		socket.interfaces[socket_intf].disconnect(get_url(socket_intf));
		update.status('server.interfaces.'+socket_intf, false);
	}

	if (!status.server.connected) {
		log.module({ msg : 'zeroMQ server already unbound' });
		process.nextTick(pass);
		return true;
	}

	// Unbind server
	socket.interfaces[app_type].unbind(get_url(app_type), (error) => {
		if (error) {
			log.module({ msg : 'zeroMQ server unbind '+error });

			process.nextTick(fail);
			return false;
		}

		log.msg({ msg : 'Terminated' });

		process.nextTick(pass);
		return true;
	});
}


module.exports = {
	interfaces : {
		can0   : zeromq.socket(get_type('can0')),
		can1   : zeromq.socket(get_type('can1')),
		client : zeromq.socket(get_type('client')),
		ibus   : zeromq.socket(get_type('ibus')),
		kbus   : zeromq.socket(get_type('kbus')),
		lcd    : zeromq.socket(get_type('lcd')),
	},


	// Start/stop functions
	init : (pass, fail) => { return init(pass, fail); },
	term : (pass, fail) => { return term(pass, fail); },


	// Data sender-wrapper
	send : (event, data) => { send(event, data); },


	// Send USB LCD commands/text to bmwd
	lcd_color_tx   : (data) => { send('lcd-color',   data); },
	lcd_command_tx : (data) => { send('lcd-command', data); },
	lcd_text_tx    : (data) => { send('lcd-text',    data); },


	// Send and receive vehicle bus data
	bus_rx : (bus, data) => {
		send('bus-rx', {
			bus  : bus,
			data : data,
		});
	},

	bus_tx : (bus, data) => {
		send('bus-tx', {
			bus  : bus,
			data : data,
		});
	},

	// Send status data object for use by other zeroMQ clients
	status_tx : (module) => {
		// If the entire status object was requested
		if (module == 'all') {
			log.msg({ msg : 'Sending full status' });

			send('status', status);
			host_data.send();
			return;
		}

		// log.module({ msg : 'Sending \''+module+'\' status' });

		let msg = {};
		msg[module] = status[module];
		send('status', msg);
	},


	// Send bus log messages to bmwd
	// log_bus : (data) => {
	// 	send('log-bus', data);
	// },

	// Send app log messages to bmwd
	// log_msg : (data) => {
	// 	send('log-msg', data);
	// },
};
