const module_name = __filename.slice(__dirname.length + 1, -3);


// Check if we're configured to use this bus, set status var, and return
function check_config(callback = null) {
	if (config.interface[module_name] === null) {
		update_configured(false);
		if (typeof callback === 'function') callback();
		callback = undefined;
		return update_status(false);
	}

	if (typeof callback === 'function') callback();
	callback = undefined;
	return true;
}


// Check if the interface has been initialized yet
function check_configured(callback = null) {
	if (!check_config()) {
		if (typeof callback === 'function') callback();
		callback = undefined;
		return update_configured(false);
	}

	if (status.interface[module_name].configured === false) {
		if (typeof callback === 'function') callback();
		callback = undefined;
		return update_configured(false);
	}

	if (typeof callback === 'function') callback();
	callback = undefined;
	return true;
}


// Check if the interface configured is changed before setting,
// if changed, show message
function update_configured(new_configured, callback = null) {
	if (status.interface[module_name].configured !== new_configured) {
		if (interface.config.debug === true) {
			log.change({
				src   : module_name,
				value : 'Interface configured',
				old   : status.interface[module_name].configured,
				new   : new_configured,
			});
		}

		// Update status var
		status.interface[module_name].configured = new_configured;
	}

	if (typeof callback === 'function') callback();
	callback = undefined;
	return status.interface[module_name].configured;
}

// Check if the interface status is changed before setting,
// if changed, show message
function update_status(new_status, callback = null) {
	if (status.interface[module_name].up !== new_status) {
		log.change({
			src   : module_name,
			value : 'Interface open',
			old   : status.interface[module_name].up,
			new   : new_status,
		});

		// Update status var
		status.interface[module_name].up = new_status;

		if (status.interface[module_name].up === false) {
			log.msg({
				src : module_name,
				msg : 'Port closed',
			});
		}
	}

	if (typeof callback === 'function') callback();
	callback = undefined;
	return status.interface[module_name].up;
}


// Setup/configure interface
function configure_port(callback = null) {
	if (!check_config()) {
		if (typeof callback === 'function') callback();
		return false;
	}

	// Pull in rawcan library
	const can = require('rawcan');

	// Create raw CAN socket
	interface[module_name].socket = can.createSocket(config.interface[module_name], true);

	// Respond to incoming CAN messages
	interface[module_name].socket.on('message', (id, data) => {
		let msg = {
			bus : module_name,
			msg : data,
			src : {
				id   : id,
				name : bus_arbids.h2n(id),
			},
		};

		// Send the data to the client(s) via WebSocket
		socket.bus_rx(msg);
	});

	// Set init status var
	update_configured(true);

	if (typeof callback === 'function') callback();
	callback = undefined;
	return true;
}


// Write an object to the interface
function send(object, callback = null) {
	if (!check_config()) {
		if (typeof callback === 'function') callback();
		return false;
	}

	// Object example:
	// interface[module_name].socket.send({
	// 	id   : 0x4F8,
	// 	data : Buffer.from([0x00, 0x42, 0xFE, 0x01, 0xFF, 0xFF, 0xFF, 0xFF]),
	// });

	interface[module_name].socket.send(object.id, object.data);

	if (typeof callback === 'function') callback();
	return true;
}


// Open interface/socket
function init(callback = null) {
	// Don't continue unless configured to use this port
	if (!configure_port()) {
		if (typeof callback === 'function') callback();
		callback = undefined;
		return false;
	}

	update_status(true);

	if (typeof callback === 'function') { callback(); }
	callback = undefined;
}


module.exports = {
	// Channel interface
	socket : null,

	// Functions
	check_config : (callback)         => { check_config(callback); },
	send         : (object, callback) => { send(object, callback); },
	init         : (callback)         => { init(callback);         },
};
