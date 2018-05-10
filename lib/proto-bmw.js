// Check if a module name is valid or not
function validate_module(type, id) {
	const invalid = {
		src : [ 'GLO', 'LOC', 'UNK' ],
		dst : [ 'UNK' ],
	};

	// Convert hex ID to name
	const name = bus.modules.h2n(id).toUpperCase();

	// Check if the name is in the array of invalids
	if (invalid[type].indexOf(name) >= 0) return false;

	return true;
}

// Calculate checksum and compare it to the message's reported checksum
function validate_crc(msg) {
	// Calculate our own CRC and compare it to
	// what the message is claiming it should be

	let calc_crc = 0x00;

	// DBUS packets don't have a "source"
	switch (app_intf) {
		case 'dbus' : {
			calc_crc = calc_crc ^ msg.dst.id;
			calc_crc = calc_crc ^ msg.len;
			break;
		}

		default : {
			calc_crc = calc_crc ^ msg.src.id;
			calc_crc = calc_crc ^ msg.len;
			calc_crc = calc_crc ^ msg.dst.id;
		}
	}

	// Calculate CRC of the message portion
	for (let byte = 0; byte < msg.msg.length; byte++) {
		calc_crc = calc_crc ^ msg.msg[byte];
	}

	// Return checksum comparision
	return calc_crc === msg.crc;
}

// Clear all queues, reset current error count, display message
function clear_all(message) {
	status.intf.errors.resets++;

	log.msg(message + ' - resets: ' + status.intf.errors.resets + ', errors: ' + status.intf.errors.current);

	update.status('intf.errors.current', 0);

	proto.proto.queue_input = [];
}

// Reset error counters, display message if changed
function error_reset() {
	if (status.intf.errors.current !== 0) {
		update.status('intf.errors.current', 0);
		log.msg('Errors resolved');
	}
}

// Increment error counters, display message
function error_increment(message) {
	status.intf.errors.current++;
	status.intf.errors.total++;

	log.msg(message + ' - new error count: ' + status.intf.errors.current);
}

// Check the input queue length and error count
function check_queue_input() {
	// Check if the queue is too short (not enough data for a complete message yet)
	if (proto.proto.queue_input.length < proto.proto.length_min) {
		proto.proto.parsing = false;
		return false;
	}

	// Check error counter, if it's been too high, clear input queue
	if (status.intf.errors.current >= proto.config.error_max) {
		proto.proto.parsing = false;
		clear_all('Too many errors');
		return false;
	}

	// Check if the input queue is too long (buffer overflow/parse error)
	if (proto.proto.queue_input.length >= proto.config.length_max) {
		proto.proto.parsing = false;
		clear_all('Input queue overflow');
		return false;
	}

	// Set parsing status to true
	proto.proto.parsing = true;
	return true;
}

// Add new data to input queue
function pusher(data = null) {
	if (data !== null) proto.proto.queue_input.push(data);

	// Start the parser if need be
	if (proto.proto.parsing === false) parser();
}

// Emit a data event on each complete data bus message
function parser() {
	// Bail if the input queue is invalid
	if (!check_queue_input()) return;

	// Process the input queue
	let process_return = process();

	if (process_return.slice === 0) {
		proto.proto.parsing = false;
		return;
	}

	proto.proto.queue_input = proto.proto.queue_input.slice(process_return.slice);

	if (process_return.failed === false) {
		status.intf.messages++;

		if (status.intf.messages % 100 === 0) {
			log.msg('Message count: ' + status.intf.messages);
		}
	}

	if (proto.config.debug === true) {
		let log_msg = 'Sliced ' + process_return.slice + ' from input queue';

		if (process_return.failed !== false) {
			log_msg = log_msg + ' - failed check: \'' + process_return.failed + '\'';
		}

		log.msg(log_msg);
	}

	// Re-kick it
	setImmediate(parser);
}

// Process/parse/validate the input queue
// Return process completion and # of positions to slice from input queue
function process() {
	let queue_process = proto.proto.queue_input;

	// Entire process queue is shorter than the allowed minimum
	if (queue_process.length < proto.proto.length_min) {
		error_increment('Input queue too short (' + queue_process.length + ')');

		return {
			failed : 'input-queue-too-short',
			slice  : 0,
		};
	}

	// IBUS/KBUS packet:
	// SRC LEN DST MSG CHK
	// LEN is the length of the packet after the LEN byte (or the entire thing, minus 2)

	// DBUS packet:
	// DST LEN MSG CHK
	// LEN is the length of the entire packet

	// Data from stream, must be verified
	let msg = {
		bus : app_intf,

		crc : null,
		msg : null,

		len      : queue_process[1],
		len_full : queue_process[1] + proto.proto.len_offset, // IBUS/KBUS length calculation is different

		src : {
			id   : queue_process[0],
			name : bus.modules.h2n(queue_process[0]),
		},

		dst : {
			id   : queue_process[2],
			name : bus.modules.h2n(queue_process[2]),
		},
	};

	// Message's claimed length is shorter than the allowed minimum
	if (msg.len_full < proto.proto.length_min) {
		error_increment('Message too short (mLenT ' + msg.len_full + ' < cMin ' + proto.proto.length_min + ')');

		return {
			failed : 'too-short',
			slice  : 1,
		};
	}

	// Message's claimed length is longer than the allowed maximum
	if (msg.len_full > proto.config.length_max) {
		error_increment('Message too long (mLenT ' + msg.len_full + ' > cMax ' + proto.config.length_max + ')');

		return {
			failed : 'too-long',
			slice  : 1,
		};
	}

	// Validate source (unless this is DBUS)
	if (!validate_module('src', msg.src.id)) {
		error_increment('Invalid source 0x' + msg.src.id.toString(16).padStart(0, 2));

		return {
			failed : 'src',
			slice  : 1,
		};
	}

	// Validate destination
	if (!validate_module('dst', msg.dst.id)) {
		error_increment('Invalid destination 0x' + msg.dst.id.toString(16).padStart(0, 2));

		return {
			failed : 'dst',
			slice  : 1,
		};
	}

	// Message's claimed length is longer than what we have
	if (msg.len_full > queue_process.length) {
		// error_increment('Not enough data (mLenT ' + msg.len_full + ' > bLen '+queue_process.length+')');

		return {
			failed : 'not-long-enough',
			slice  : 0,
		};
	}

	// Grab message (removing [SRC] LEN DST and CHK)
	msg.msg = queue_process.slice((proto.proto.msg_offset + 2), (proto.proto.msg_offset + msg.len));

	// Grab message CRC (removing [SRC] LEN DST and MSG)
	msg.crc = queue_process[(proto.proto.msg_offset + msg.len)];

	// Validate CRC
	if (!validate_crc(msg)) {
		error_increment('Invalid checksum');

		return {
			failed : 'crc',
			slice  : 1,
		};
	}

	// If we made is this far, we're safe
	error_reset();

	// Return here if this is IBUS and destination is GLO (IKE mirrors them)
	// if (app_intf === 'ibus' && msg.dst.name === 'GLO') {
	// 	return {
	// 		failed : false,
	// 		slice  : (msg.len + proto.proto.slice_offset),
	// 	};
	// }

	// Send message object to zeroMQ socket
	socket.bus_rx(msg);

	// Return full message length
	return {
		failed : false,
		slice  : (msg.len + proto.proto.slice_offset),
	};
}

// Calculate checksum of input array of buffer
function calculate_crc(input) {
	let crc = 0x00;

	for (let i = 0; i < input.length - 1; i++) {
		crc ^= input[i];
	}

	return crc;
}

function create(msg) {
	// DBUS packet length:
	// 1 + 1 + n + 1
	// DST LEN MSG CHK
	// ... or MSG.length + 3

	// IBUS/KBUS packet length:
	//   1 + 1 + 1 + n + 1
	// SRC LEN DST MSG CHK
	// ... or MSG.length + 4

	if (typeof msg            === 'undefined') return;
	if (typeof msg.msg        === 'undefined') return;
	if (typeof msg.msg.length === 'undefined') return;

	let buffer = Buffer.alloc((msg.msg.length + proto.proto.buffer_offset));

	// TODO : merge/cleanup
	switch (app_intf) {
		case 'dbus' : {
			// Convert module names to hex codes
			buffer[0] = bus.modules.n2h(msg.dst);
			buffer[1] = msg.msg.length + 3;
			break;
		}

		default : {
			// Convert module names to hex codes
			buffer[0] = bus.modules.n2h(msg.src);
			buffer[1] = msg.msg.length + 2;
			buffer[2] = bus.modules.n2h(msg.dst);
		}
	}

	// Assemble message
	for (let i = 0; i < msg.msg.length; i++) {
		buffer[(i + proto.proto.assem_offset)] = msg.msg[i];
	}

	// Add checksum to message
	buffer[(msg.msg.length + proto.proto.crc_offset)] = calculate_crc(buffer);

	// Return the assembled buffer
	return buffer;
}


// Exported functions
module.exports = {
	// Variables
	queue_input : [],

	parsing : false,


	// Modify minimum length for DBUS packets
	length_min : app_intf == 'dbus' && proto.config.length_min - 1 || proto.config.length_min,

	// Adjust for DBUS vs. IBUS/KBUS message offsets
	// .. I hate everything
	assem_offset  : app_intf == 'dbus' &&  2 || 3,
	buffer_offset : app_intf == 'dbus' &&  3 || 4,
	crc_offset    : app_intf == 'dbus' &&  2 || 3,
	len_offset    : app_intf == 'dbus' &&  0 || 2, // Offset for msg[1] vs actual length
	msg_offset    : app_intf == 'dbus' && -1 || 1,
	slice_offset  : app_intf == 'dbus' &&  1 || 2,


	// Functions
	create : (msg)  => { return create(msg); },
	pusher : pusher,
};
