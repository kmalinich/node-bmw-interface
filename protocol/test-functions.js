#!/usr/bin/env node

// Check if a module name is valid or not
function validate_module(type, name) {
	const invalid = {
		src : [ 'GLO', 'LOC', 'UNK' ],
		dst : [ 'UNK' ],
	};

	if (invalid[type].indexOf(name.toUpperCase()) >= 0) return false;
	return true;
}

// Calculate checksum and compare it to the message's reported checksum
function validate_crc(msg) {
	var calc_crc = 0x00;

	// DBUS packets don't have a "source"
	switch (msg.bus) {
		case 'dbus':
			calc_crc = calc_crc^msg.dst.id;
			calc_crc = calc_crc^msg.len;
			break;
		default:
			calc_crc = calc_crc^msg.src.id;
			calc_crc = calc_crc^msg.len;
			calc_crc = calc_crc^msg.dst.id;
			break;
	}

	// Calculate CRC of the message portion
	for (var byte = 0; byte < msg.msg.length; byte++) {
		calc_crc = calc_crc^msg.msg[byte];
	}

	// Return checksum comparision
	return calc_crc === msg.crc;
}

// Validate src, dst, and crc and attach it to msg.valid
function validate(msg) {
	// Add object for individual validations
	msg.valid = {
		src : msg.bus == 'dbus' && true || validate_module('src', msg.src.name),
		dst : validate_module('dst', msg.dst.name),
		crc : validate_crc(msg),
	};

	// Add key for fully valid
	msg.valid.full = Object.keys(msg.valid).every((k) => { return msg.valid[k] === true });

	return msg;
}

// [ 0x00, 0x05, 0x08, 0x7D, 0x00, 0x00, 0x70 ]
const msg_ibus = {
	bus : 'ibus',
	crc : 0x70,
	len : 0x05,
	msg : [ 0x7D, 0x00, 0x00 ],
	src : {
		id   : 0x00,
		name : 'GM',
	},
	dst : {
		id   : 0x08,
		name : 'SHD',
	},
};

// [ 0x12, 0x06, 0xA0, 0x00, 0x00, 0xB4 ]
const msg_dbus = {
	bus : 'dbus',
	crc : 0xB4,
	len : 0x06,
	msg : [ 0xA0, 0x00, 0x00 ],
	src : {
		id   : 0x3F,
		name : 'DIA',
	},
	dst : {
		id   : 0x12,
		name : 'DME',
	},
};

console.log(validate(msg_ibus));
console.log('');
console.log(validate(msg_dbus));
