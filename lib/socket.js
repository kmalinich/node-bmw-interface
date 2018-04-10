/* eslint no-console     : 0 */
/* eslint no-undef       : 0 */
/* eslint no-unused-vars : 0 */

const amp    = require('amp-message');
const zeromq = require('zeromq');


// Return zeroMQ socket type from config data
function get_type() {
	return (app_intf === 'client' && 'router' || 'dealer');
}

// Return full zeroMQ URL from config data
function get_url() {
	return config.zeromq.proto + '://' + config.zeromq.host + ':' + config.zeromq.port;
}


// Send data over zeroMQ
function send(event, data) {
	// Don't bother sending anything if we're disconnected
	if (status.server.connected === false) {
		// log.msg('Server disconnected, cannot send message');
		return;
	}

	let message = {
		host  : status.system,
		event : event,
		data  : data,
	};

	// Encode object as AMP message
	let amp_message = new amp();
	amp_message.push(message);

	// Send AMP message over zeroMQ
	if (socket.intf !== null) socket.intf.send([ app_intf + '-tx', amp_message.toBuffer() ]);
}

// Handle incoming messages
function recv(message) {
	// Decode AMP-encoded messages from zeroMQ
	let data = new amp(message).shift();
	// console.dir(data, { showHidden: true, depth: null, colors: true});

	switch (data.event) {
		case 'bus-tx' : {
			if (data.data.bus === app_intf) bus.data.send(data.data);
			break;
		}

		case 'host-data-request' : {
			host_data.send();
			break;
		}

		case 'status-request' : {
			socket.status_tx(data.data);
			break;
		}
	}
}


// Configure event handlers
function event_config(pass, fail) {
	socket.intf.on('accept', () => {
		log.msg('accept');
	});

	socket.intf.on('accept_error', (error) => {
		log.msg('accept error ' + error);
		console.error(error);
	});

	socket.intf.on('bind', () => {
		log.msg('bind');
		update.status('server.connected', true);

		update.status('server.connecting',   false);
		update.status('server.reconnecting', false);

		// Send this host's data to zeroMQ clients to update them
		host_data.send();
	});

	socket.intf.on('bind_error', (error) => {
		log.msg('bind error ' + error);
		console.error(error);
		update.status('server.connected', false);
	});

	socket.intf.on('close', () => {
		// log.msg('close');
		update.status('server.connected', false);
	});

	socket.intf.on('close_error', (error) => {
		log.msg('close error ' + error);
		console.error(error);
		update.status('server.connected', false);
	});

	socket.intf.on('connect', () => {
		log.msg('connect');
		update.status('server.connected',    true);
		update.status('server.connecting',   false);
		update.status('server.reconnecting', false);

		// Send this host's data to zeroMQ clients to update them
		host_data.send();
	});

	// socket.intf.on('connect_delay', () => {
	//   log.msg('connect_delay');
	// });

	socket.intf.on('connect_retry', () => {
		// log.msg('connect_retry');
		update.status('server.connected',    false);
		update.status('server.connecting',   true);
		update.status('server.reconnecting', true);
	});

	socket.intf.on('disconnect', () => {
		log.msg('disconnect');
		update.status('server.connected', false);
	});

	socket.intf.on('error', (error) => {
		log.msg('error ' + error);
		console.error(error);
	});

	socket.intf.on('listen', () => {
		log.msg('listen');
	});

	socket.intf.on('monitor_error', (error) => {
		log.msg('monitor_error ' + error);
		console.error(error);
	});

	socket.intf.on('unbind', () => {
		log.msg('unbind');
		update.status('server.connected', false);

		// Reset basic vars
		json.status_reset();
	});

	socket.intf.on('message', (topic, message) => {
		log.msg(topic + ' message received');
		// Decode AMP message
		recv(message);
	});

	// Enable monitor to utilize events
	socket.intf.monitor();

	log.msg('Configured event listeners');

	// Configure interfaces
	process.nextTick(() => {
		intf_config(pass, fail);
		log.msg('Initialized');
	});
}

function intf_config(pass, fail) {
	// Connect interface
	socket.intf.identity = app_intf;
	log.msg('Set ' + get_type(app_intf) + ' identity: \'' + app_intf + '\'');

	log.msg('Connecting interface');
	socket.intf.connect(get_url());

	process.nextTick(pass);
}


// Initialize zeroMQ server
function init(pass, fail) {
	log.msg('Initializing');

	// Setup events
	process.nextTick(() => {
		event_config(pass, fail);
	});
}

// Terminate zeroMQ server
function term(pass, fail) {
	log.msg('Terminating');

	// Disconnect interfaces
	switch (status.server.connected) {
		case true : {
			// socket.intf.close();
			socket.intf = null;
			break;
		}

		case false : {
			log.msg('zeroMQ dealer socket already disconnected');
		}
	}

	setTimeout(() => {
		process.nextTick(pass);
		log.msg('Terminated');
	}, 250);
}


module.exports = {
	intf : zeromq.socket(get_type()),

	// Start/stop functions
	init : (pass, fail) => { return init(pass, fail); },
	term : (pass, fail) => { return term(pass, fail); },

	// Data sender-wrapper
	send : send,

	// Send and receive vehicle bus data
	bus_rx : (data) => { send('bus-rx', data); },
	bus_tx : (data) => { send('bus-tx', data); },

	// Send status data object for use by other zeroMQ clients
	status_tx : (module) => {
		// If the entire status object was requested
		if (module === 'all') {
			log.msg('Sending full status');

			send('status', status);
			host_data.send();
			return;
		}

		// log.msg('Sending \'' + module + '\' status');

		let msg = {};
		msg[module] = status[module];
		send('status', msg);
	},
};
