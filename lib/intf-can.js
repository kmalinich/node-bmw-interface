/* eslint require-atomic-updates : 0 */

// TODO: Make this a class


// Check if CANBUS ARBID is on allow list
// return false : not disallowed (allowed)
// return true  : disallowed (NOT allowed)
function check_disallow(message) {
	// Convert to string hexadecimal representation and format
	const hexstr = hex.i2s(message.id, true, 3);
	return (bus.arbids.arbids_allow.indexOf(hexstr) === -1);
} // check_disallow(message)

// Check for / filter out repeat CANBUS data
// return false : NOT a repeat
// return true  : is a repeat
function check_repeat(message) {
	// Pull out data and store as Buffer
	const data = Buffer.from(message.data.toJSON().data);

	// If old buffer is not a buffer/doesn't exist, populate it, then return false
	if (!Buffer.isBuffer(intf.intf.last[message.id])) {
		intf.intf.last[message.id] = data;
		return false;
	}

	// Compare new buffer to old buffer
	return intf.intf.last[message.id].equals(data);
} // check_repeat(message)


// Handle incoming CAN messages
function message_handler(message) {
	// If enabled, return now if this is a disallowed message
	if (config.can.check.allow && check_disallow(message)) return;

	// If enabled, return now if this is a repeated message
	if (config.can.check.repeat && check_repeat(message)) return;

	// Send data received from vehicle bus to socket
	socket.bus_rx({
		bus : app_intf,
		msg : message.data.toJSON().data,
		src : {
			id   : message.id,
			name : bus.arbids.h2n(message.id),
		},
	});
} // message_handler(message)


// Setup/configure interface
async function init() {
	log.lib('Initalizing');

	if (intf.path === null) {
		log.lib('Interface ' + app_intf + ' is not enabled');
		update.status('intf.up', false, false);
		return;
	}

	// Pull in socketcan library
	const can = require('socketcan');

	// Create raw socketcan channel, timestamps disabled
	// eslint require-atomic-updates
	intf.intf.port = await can.createRawChannel(intf.path, false);

	intf.intf.network = await can.parseNetworkDescription('./can-definitions/bmw-e39.kcd');

	intf.intf.db = {
		ptcan : await new can.DatabaseService(intf.intf.port, intf.intf.network.buses.PTCAN),
	};

	// Add listener for DME_720 event
	// intf.intf.db.ptcan.messages.DME_720.signals.temperature_coolant_c.onChange(message => {
	// 	console.dir({ [message.name] : message.value });
	// });
	// intf.intf.db.ptcan.messages.DME_720.signals.temperature_oil_c.onChange(message => {
	// 	console.dir({ [message.name] : message.value });
	// });
	// intf.intf.db.ptcan.messages.DME_720.signals.temperature_intake_c.onChange(message => {
	// 	console.dir({ [message.name] : message.value });
	// });
	// intf.intf.db.ptcan.messages.DME_720.signals.temperature_exhaust_c.onChange(message => {
	// 	console.dir({ [message.name] : message.value });
	// });

	// intf.intf.db.ptcan.messages.DME_720.signals.vehicle_speed.onChange(message => {
	// 	console.dir({ [message.name] : message.value });
	// });
	// intf.intf.db.ptcan.messages.DME_720.signals.battery_voltage.onChange(message => {
	// 	console.dir({ [message.name] : message.value });
	// });
	// intf.intf.db.ptcan.messages.DME_720.signals.fuel_pump_duty.onChange(message => {
	// 	console.dir({ [message.name] : message.value });
	// });


	// Add listener for onMessage event
	intf.intf.port.addListener('onMessage', message_handler);

	// Add listener for onStopped event
	intf.intf.port.addListener('onStopped', () => {
		log.lib('CAN channel stopped');
	});

	// Start CAN socket
	await intf.intf.port.start();

	log.lib('Initialized');
} // async init()

// Close interface
async function term() {
	log.lib('Terminating');

	// Call for channel to stop
	await intf.intf.port.stop();

	log.lib('Terminated');

	return true;
} // async term()


// Write an object to the interface
async function send(object) {
	if (typeof object      === 'undefined') { log.error('data undefined : object');      return false; }
	if (typeof object.data === 'undefined') { log.error('data undefined : object.data'); return false; }

	// Mitigate issue with occasional double-nested data key (unknown where issue originates)
	if (typeof object.data.data === 'object') object.data = object.data.data;

	try {
		// Convert data to Buffer and send
		object.data = await Buffer.from(object.data);

		await intf.intf.port.send(object);
		return true;
	}
	catch (error) {
		log.error('Error sending CAN data');
		log.error(error);
		return false;
	}
} // async send(object)


module.exports = {
	last : {},

	port : null,

	// Start/stop functions
	init,
	term,

	// Data functions
	send,
};
