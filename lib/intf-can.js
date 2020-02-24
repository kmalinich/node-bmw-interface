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
	// If old buffer is not a buffer/doesn't exist, populate it, then return false
	if (!Buffer.isBuffer(intf.intf.last[message.id])) {
		intf.intf.last[message.id] = message.data;
		return false;
	}

	// Compare new buffer to old buffer
	return intf.intf.last[message.id].equals(message.data);
} // check_repeat(message)

// Handle incoming parsed CAN data
function change_handler(topic, msg) {
	let hysteresis_allow = true;

	switch (topic) {
		case 'engine.ac_clutch'         :
		case 'engine.dsc_ok'            :
		case 'engine.fueling.active'    :
		case 'engine.fueling.cut'       :
		case 'engine.fueling.full_load' :
		case 'engine.maf_error'         :
		case 'engine.running'           :
		case 'engine.smg_present'       : hysteresis_allow = false; break;
	}

	if (hysteresis_allow === true) {
		if (typeof intf.intf.hysteresis[topic] === 'undefined') {
			intf.intf.hysteresis[topic] = [];
		}

		if (intf.intf.hysteresis[topic].length < 2) {
			intf.intf.hysteresis[topic].push(msg);
			return;
		}

		if (intf.intf.hysteresis[topic].indexOf(msg) !== -1) {
			// console.log('hys fail :', { t : topic, v : msg, h : intf.intf.hysteresis[topic] });
			intf.intf.hysteresis[topic].shift();
			intf.intf.hysteresis[topic].push(msg);
			return;
		}

		// TODO: Check if there is some kind of 'shiftpush'
		// console.log('hys PASS :', { t : topic, v : msg, h : intf.intf.hysteresis[topic] });
		intf.intf.hysteresis[topic].shift();
		intf.intf.hysteresis[topic].push(msg);
	}

	// console.dir({ topic, msg });
	// Send data received from vehicle bus to socket
	socket.send('bus-rx', {
		bus  : app_intf,
		msg,
		topic,
		type : 'parsed',
	});
} // change_handler(arbid, message)

// Handle incoming raw CAN messages
function message_handler(message) {
	// If enabled, return now if this is a disallowed message
	if (config.can.check.allow && check_disallow(message)) return;

	// If enabled, return now if this is a repeated message
	if (config.can.check.repeat && check_repeat(message)) return;

	// Send data received from vehicle bus to socket
	socket.send('bus-rx', {
		bus   : app_intf,
		topic : 'raw',
		type  : 'raw',

		msg : [ ...message.data ],
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

	intf.intf.channel_active = true;


	// Add listeners for DME ARBID 0x316 events
	intf.intf.db.ptcan.messages.DME_316.signals.engine_dsc_ok.onChange(message              => change_handler('engine.dsc_ok',              message.value));
	intf.intf.db.ptcan.messages.DME_316.signals.engine_smg_present.onChange(message         => change_handler('engine.smg_present',         message.value));
	intf.intf.db.ptcan.messages.DME_316.signals.engine_ac_clutch.onChange(message           => change_handler('engine.ac_clutch',           message.value));
	intf.intf.db.ptcan.messages.DME_316.signals.engine_maf_error.onChange(message           => change_handler('engine.maf_error',           message.value));

	intf.intf.db.ptcan.messages.DME_316.signals.engine_torque_before_interventions.onChange(message => change_handler('engine.torque.before_interventions', message.value));
	intf.intf.db.ptcan.messages.DME_316.signals.engine_torque_after_interventions.onChange(message  => change_handler('engine.torque.after_interventions',  message.value));
	intf.intf.db.ptcan.messages.DME_316.signals.engine_torque_loss.onChange(message                 => change_handler('engine.torque.loss',                 message.value));
	intf.intf.db.ptcan.messages.DME_316.signals.engine_torque_output.onChange(message               => change_handler('engine.torque.output',               message.value));

	intf.intf.db.ptcan.messages.DME_316.signals.engine_rpm.onChange(message => {
		change_handler('engine.rpm', message.value);
		change_handler('engine.running', (message.value > 0));
	});


	// Add listeners for DME ARBID 0x710 events
	intf.intf.db.ptcan.messages.DME_710.signals.engine_fueling_active.onChange(message    => change_handler('engine.fueling.active',    message.value));
	intf.intf.db.ptcan.messages.DME_710.signals.engine_fueling_cut.onChange(message       => change_handler('engine.fueling.cut',       message.value));
	intf.intf.db.ptcan.messages.DME_710.signals.engine_fueling_full_load.onChange(message => change_handler('engine.fueling.full_load', message.value));

	// Add listeners for DME ARBID 0x720 events
	intf.intf.db.ptcan.messages.DME_720.signals.battery_voltage.onChange(message       => change_handler('dme.voltage',            num.round2(message.value), 1));
	intf.intf.db.ptcan.messages.DME_720.signals.fuel_pump_duty.onChange(message        => change_handler('fuel.pump.duty',         message.value));
	intf.intf.db.ptcan.messages.DME_720.signals.temperature_coolant_c.onChange(message => change_handler('temperature.coolant.c',  message.value));
	intf.intf.db.ptcan.messages.DME_720.signals.temperature_exhaust_c.onChange(message => change_handler('temperature.exhaust.c',  message.value));
	intf.intf.db.ptcan.messages.DME_720.signals.temperature_intake_c.onChange(message  => change_handler('temperature.intake.c',   message.value));
	intf.intf.db.ptcan.messages.DME_720.signals.temperature_oil_c.onChange(message     => change_handler('temperature.oil.c',      message.value));
	intf.intf.db.ptcan.messages.DME_720.signals.vehicle_speed.onChange(message         => change_handler('vehicle.speed.pulses',   message.value));


	// Add listener for onMessage event (not parsed by Kayak can-definition kcd)
	intf.intf.port.addListener('onMessage', message_handler);

	// Start CAN socket
	await intf.intf.port.start();

	// Add listener for onStopped event
	intf.intf.port.addListener('onStopped', () => {
		log.lib('CAN channel stopped');
		intf.intf.channel_active = false;
	});

	log.lib('Initialized');
} // async init()

// Close interface
async function term() {
	log.lib('Terminating');

	// Call for channel to stop
	if (intf.intf.channel_active === true) {
		await intf.intf.port.stop();
	}

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
	channel_active : false,

	hysteresis : {},
	last       : {},

	port : null,

	// Start/stop functions
	init,
	term,

	// Data functions
	send,
};
