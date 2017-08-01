#!/usr/bin/env node

// API config - should be moved into API object
const dispatcher        = new (require('httpdispatcher'));
const http              = require('http');
const query_string      = require('querystring');
var api_socket_key_last = 0;
var api_socket_map      = {};
api_server              = http.createServer(api_handler);
var api_header          = {
	'Content-Type'  : 'application/json',
	'Cache-Control' : 'no-cache',
};

// npm libraries
now = require('performance-now');
os  = require('os');
pad = require('pad');

// node-bmw libraries
bus_modules = require('bus-modules');

module_name = 'ibus';

protocol = {
	config : {
		length_min : 5,
		length_max : 90,
		error_max  : 100,
	},
};

// 00 05 08 7D 00 00 70
// 18 0A 68 39 00 09 00 3F 00 01 00 74
// 3F 03 68 53 07
// 44 05 BF 74 04 01 8F

var array_ordered = [
	0x00, 0x05, 0x08, 0x7D, 0x00, 0x00, 0x70, 0x18, 0x0A, 0x68,
	0x39, 0x00, 0x09, 0x00, 0x3F, 0x00, 0x01, 0x00, 0x74, 0x3F,
	0x03, 0x68, 0x53, 0x07, 0x44, 0x05, 0xBF, 0x74, 0x04, 0x01,
	0x8F
];

var array_unordered = [
	0x08, 0x7D, 0x00, 0x00, 0x70, 0x18, 0x0A, 0x68,
	0x39, 0x00, 0x09, 0x00, 0x3F, 0x00, 0x01, 0x00, 0x74, 0x3F,
	0x03, 0x68, 0x53, 0x07, 0x44, 0x05, 0xBF, 0x74, 0x04, 0x01,
	0x8F, 0x00, 0x05
];

// var buf = Buffer.alloc(protocol.config.length_max);
// var buf = Buffer.from(array_unordered);
var buf = [];


// Process/parse/check a buffer
// Return number of messages processed
function process(buffer_process) {
	// IBUS/KBUS packet:
	// SRC LEN DST MSG CHK

	// Length is the length of the packet after the LEN byte
	// (or the entire thing, minus 2)

	// Data from stream, must be verified
	var msg = {
		bus : module_name,
		crc : null,
		len : buffer_process[1],
		msg : null,
		src : {
			id   : buffer_process[0],
			name : bus_modules.h2n(buffer_process[0]),
		},
		dst : {
			id   : buffer_process[2],
			name : bus_modules.h2n(buffer_process[2]),
		},
	};

	if (buffer_process.length < protocol.config.length_min) {
		// console.log('CHK 0 FAIL : BLn %s >= min %s', buffer_process.length, protocol.config.length_min);
		return {
			finish : false,
			slice : 0,
		};
	}
	// console.log('CHK 0 PASS : BLn %s >= min %s', buffer_process.length, protocol.config.length_min);


	// Issue if first data point is 0x00
	if (msg.len+2 < protocol.config.length_min) {
		// console.log('CHK 1 FAIL : MLn+2 %s >= min %s', msg.len+2, protocol.config.length_min);
		return {
			finish : false,
			slice : 1,
		};
	}
	// console.log('CHK 1 PASS : MLn+2 %s >= min %s', msg.len+2, protocol.config.length_min);


	if (msg.len+2 > protocol.config.length_max) {
		// console.log('CHK 2 FAIL : MLn+2 %s < max %s', msg.len+2, protocol.config.length_max);
		return {
			finish : false,
			slice : 1,
		};
	}
	// console.log('CHK 2 PASS : MLn+2 %s < max %s', msg.len+2, protocol.config.length_max);


	if (msg.len+2 > buffer_process.length) {
		// console.log('CHK 3 FAIL : MLn+2 %s > BLn %s', msg.len+2, buffer_process.length);
		return {
			finish : false,
			slice : 0,
		};
	}
	// console.log('CHK 3 PASS : MLn+2 %s > BLn %s', msg.len+2, buffer_process.length);


	// Invalid/unknown source
	if (msg.src.name === 'unk' || msg.src.name == 'LOC' || msg.src.name == 'GLO') {
		// console.log('CHK 4 FAIL : Src %s', msg.src.name);
		return {
			finish : false,
			slice : 1,
		};
	}
	// console.log('CHK 4 PASS : Src %s', msg.src.name);


	// Invalid/unknown destination
	if (msg.dst.name === 'unk') {
		// console.log('CHK 5 FAIL : Dst %s', msg.dst.name);
		return {
			finish : false,
			slice : 1,
		};
	}
	// console.log('CHK 5 PASS : Dst %s', msg.dst.name);

	// Calculate our own CRC and compare it to
	// what the message is claiming it should be

	// Grab message (removing SRC LEN DST and CHK)
	msg.msg = buffer_process.slice(3, msg.len+1);

	// Grab message CRC (removing SRC LEN DST and MSG)
	msg.crc = buffer_process[msg.len+1];

	// Calculate CRC of received message
	var calc_crc = 0x00;
	calc_crc = calc_crc^msg.src.id;
	calc_crc = calc_crc^msg.len;
	calc_crc = calc_crc^msg.dst.id;

	for (var byte = 0; byte < msg.msg.length; byte++) {
		calc_crc = calc_crc^msg.msg[byte];
	}

	// Invalid checksum
	if (calc_crc !== msg.crc) {
		// console.log('CHK 6 FAIL : cCRC 0x%s = mCRC 0x%s', calc_crc.toString(16), msg.crc.toString(16));
		return {
			finish : false,
			slice : 1,
		};
	}
	// console.log('CHK 6 PASS : cCRC 0x%s = mCRC 0x%s', calc_crc.toString(16), msg.crc.toString(16));

	// console.log(msg);

	// Return number of processed messages
	return {
		finish : true,
		slice  : msg.len+2,
	};
}


// Port 3001 listener for POST requests to modules
// This REALLY REALLY REALLY REALLY should be moved into it's own object

function startup_api_server(callback) {
	// error handling breh
	api_server.listen(3001, () => {
		console.log('API server up, port '+3001);

		api_server.on('connection', (api_socket) => {
			// Generate a new, unique api_socket-key
			var api_socket_key = ++api_socket_key_last;

			// Add api_socket when it is connected
			api_socket_map[api_socket_key] = api_socket;

			// Remove api_socket when it is closed
			api_socket.on('close', () => {
				delete api_socket_map[api_socket_key];
			});
		});
	});
}

// Close API server and kill the sockets
function shutdown() {
	// Loop through all sockets and destroy them
	Object.keys(api_socket_map).forEach((api_socket_key) => {
		api_socket_map[api_socket_key].destroy();
	});

	// Tell server to close
	api_server.close();

	// API server close event
	api_server.on('close', () => {
		console.log('API server down');
		process.exit();
	});
}

// API handler function
function api_handler(request, response) {
	// console.log('[node::API] %s request: %s', request.method, request.url);
	dispatcher.dispatch(request, response);
}

// Config GET request
dispatcher.onGet('/buffer', (request, response) => {
	response.writeHead(200, api_header);
	response.end(JSON.stringify(buf));
});

// Config POST request
dispatcher.onPost('/buffer', (request, response) => {
	var post_data = JSON.parse(request.body);
	var new_value = parseInt(post_data.data, 16);
	// console.log('ADD : %s', post_data.data);
	buf.push(new_value);

	response.writeHead(200, api_header);
	response.end(JSON.stringify({ status : 'ok' }));

	procbuf();
});

// Error
dispatcher.onError((request, response) => {
	console.error('[node::API] Error: 404');
	response.writeHead(404);
	response.end();
});


function procbuf() {
	var proc_return = process(buf);
	if (proc_return.finish === true) {
		// console.log('SLS %s', proc_return.slice);
		console.log(Buffer.from(buf));
	}

	buf = buf.slice(proc_return.slice);
}

startup_api_server();
