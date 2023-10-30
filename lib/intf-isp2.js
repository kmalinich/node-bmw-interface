#!/usr/bin/env node

// https://www.innovatemotorsports.com/support/downloads/Seriallog-2.pdf
// https://www.innovatemotorsports.com/resources/serial-protocol.php
// https://arduino.stackexchange.com/questions/70491/decoding-serial-packets-please-check-my-work


const { SerialPort } = require('serialport');

const { ByteLengthParser } = require('@serialport/parser-byte-length');

let array  = [];
let cursor = 0;


// Output formatted error message
function error_out(message, error) {
	let errorString = `Error '${message}' -`;

	if (typeof error.errno   === 'number') errorString += ` errno: ${error.errno}`;
	if (typeof error.code    === 'string') errorString += ` code: ${error.code}`;
	if (typeof error.syscall === 'string') errorString += ` syscall: ${error.syscall}`;
	if (typeof error.address === 'string') errorString += ` address: ${error.address}`;
	if (typeof error.message === 'string') errorString += ` message: ${error.message}`;

	log.error(errorString);

	return errorString;
}


// Check if we're configured to use the specified port
// Check if the port is open
// Update status object
//
// Handle unspecified interface path,
// interface port null,
// and port.isOpen value not existing yet
function check() {
	log.lib('Checking interface \'' + intf.path + '\'');

	if (typeof intf.path !== 'string' || intf.path === null) {
		log.lib('Interface ' + app_intf + ' is not enabled, exiting');
		process.exit(0);
	}

	let port_status = false;
	if (intf.intf.port !== null && typeof intf.intf.port.isOpen === 'boolean') {
		port_status = intf.intf.port.isOpen;
	}

	// Update status object
	update.status('intf.up', port_status, false);

	return true;
} // check()


// Setup/configure serial port
async function configure_port() {
	// Don't continue unless configured to use this port
	check();

	log.lib('Instantiating interface \'' + intf.path + '\'');

	// Instantiate serial port with path and options rendered in main.js
	intf.intf.port = await new SerialPort({ path : intf.path, ...intf.opts });

	// Send data to the parser
	const parser = intf.intf.port.pipe(new ByteLengthParser({
		length : 1,
	}));

	parser.on('data', data => {
		processISP2Data(data.readUInt8(0));
	});

	// Open/close
	intf.intf.port.on('close', check);

	intf.intf.port.on('open', () => {
		log.lib('Instantiated interface \'' + intf.path + '\'');
		check();
	});

	// Error
	intf.intf.port.on('error', error => {
		// Update status object
		check();

		error_out('intf.intf.port', error);

		if (error.message === 'Error Resource temporarily unavailable Cannot lock port') {
			process.exit(8);
		}
	});

	return true;
} // async configure_port()


// Lambda is represented as 0.5 to 1.532 in 0.001 increments
function processISP2Data(newByte) {
	// cs.log('');
	// cs.log({ newByte });

	array.push(newByte); cursor++;
	// cs.log({ array : Buffer.from(array) });


	if (array.length < 6) {
		// cs.log('%o %s', genLogObj(cursor, newByte, array), 'Array is too short');
		return;
	}


	if (!(array[0] & 0x80)) {
		// cs.log('%o %s', genLogObj(cursor, newByte, array), '!array[0] & 0x80');
		array.splice(0, 1); cursor--;
		return;
	}

	if (!(array[0] & 0x20)) {
		// cs.log('%o %s', genLogObj(cursor, newByte, array), '!array[0] & 0x20');
		array.splice(0, 1); cursor--;
		return;
	}


	if (!(array[1] & 0x80)) {
		// cs.log('%o %s', genLogObj(cursor, newByte, array), '!array[1] & 0x80');
		array.splice(0, 1); cursor--;
		return;
	}


	if ((array[2] & 0x80)) {
		// cs.log('%o %s', genLogObj(cursor, newByte, array), 'array[2] & 0x80');
		array.splice(0, 1); cursor--;
		return;
	}

	if (!(array[2] & 0x40)) {
		// cs.log('%o %s', genLogObj(cursor, newByte, array), '!array[2] & 0x40');
		array.splice(0, 1); cursor--;
		return;
	}

	if ((array[2] & 0x20)) {
		// cs.log('%o %s', genLogObj(cursor, newByte, array), 'array[2] & 0x20');
		array.splice(0, 1); cursor--;
		return;
	}

	if (!(array[2] & 0x02)) {
		// cs.log('%o %s', genLogObj(cursor, newByte, array), '!array[2] & 0x02');
		array.splice(0, 1); cursor--;
		return;
	}


	if ((array[3] & 0x80)) {
		// cs.log('%o %s', genLogObj(cursor, newByte, array), 'array[3] & 0x80');
		array.splice(0, 1); cursor--;
		return;
	}


	if ((array[4] & 0x80)) {
		// cs.log('%o %s', genLogObj(cursor, newByte, array), 'array[4] & 0x80');
		array.splice(0, 1); cursor--;
		return;
	}

	if ((array[4] & 0x40)) {
		// cs.log('%o %s', genLogObj(cursor, newByte, array), 'array[4] & 0x40');
		array.splice(0, 1); cursor--;
		return;
	}


	if ((array[5] & 0x80)) {
		// cs.log('%o %s', genLogObj(cursor, newByte, array), 'array[5] & 0x80');
		array.splice(0, 1); cursor--;
		return;
	}


	if (array.length > 16) {
		// cs.log('%o %s', genLogObj(cursor, newByte, array), 'Array is too long - splicing 1 from beginning of array');
		array.splice(0, 1); cursor--;
		return;
	}


	// The header also contains the total length of a message, which may be modified by any datasource device in the chain
	// Actual message length can be found by unsetting 0x80 from byte 1
	const allegedLength = array[1] & ~0x80;

	// Empty array and return here if alleged length is outside of the bounds of the specification
	if (allegedLength < 1 || allegedLength > 7) {
		// cs.log('%o | %s', genLogObj(cursor, newByte, array), `Alleged length ${allegedLength} too long or too short - splicing 1 from beginning of array`);
		// don't splice - just return here
		array.splice(0, 1); cursor--;
		return;
	}


	while (cursor > 3 && cursor >= (allegedLength + 4)) {
		// Full frame accumulated
		// Copy command from the array
		const fullMessageLength = (array[1] & ~0x80) + 4;

		const frame = Buffer.from(array.slice(0, fullMessageLength));

		// Preserve extra data
		array = array.slice(frame.length, array.length);

		cursor -= fullMessageLength;

		// Bytes 0 and 1 of the message contain function/status information

		// Byte 0, bit 0 - high bit (bit 7) of AFR multiplier (AF7)
		// Byte 0, bit 1 - ??
		// Byte 0, bit 2 : Func0
		// Byte 0, bit 3 : Func1
		// Byte 0, bit 4 : Func2
		// Byte 0, bit 5 : always unset
		// Byte 0, bit 6 : (R) set if currently recording to flash in LM-1
		// Byte 0, bit 7 : always set


		// Func0, Func1, Func2
		// (byte 0, bit 2+3+4)
		// Function/status bits indicating how interpret the next word (lambda word)
		//
		// 0 0 0 - Lambda valid
		// 0 0 1 - Warming up, lambda value is operating temp in 1/10%
		// 0 1 0 - Lambda value not valid - free air calibration in progress
		// 0 1 1 - Lambda value not valid - lambda value is error code
		// 1 0 0 - Lambda value is O2 level in 1/10%
		// 1 0 1 - Heater calibration, lambda value contains calibration countdown
		// 1 1 0 - Lambda value not valid - requires free air calibration
		// 1 1 1 - Lambda value is flash level in 1/10%

		const functionCode = (frame[2] >> 2 & 0x7);

		let status = 'unknown';

		switch (functionCode) {
			case 0 : status = 'Lambda'; break;
			case 1 : status = 'O2 %';   break;
			case 2 : status = 'Free air calibration in progress'; break;
			case 3 : status = 'Free air calibration required';    break;
			case 4 : status = 'Warming up'; break;
			case 5 : status = 'Heater calibration, value is calibration countdown'; break;
			case 6 : status = 'Error code'; break;
			case 7 : status = 'Flash %';
		}


		let errorCode = null;
		let lambda    = null;
		let warmup    = null;

		let frameValue = ((frame[4] << 7 | frame[5]) & 0x1FFF);

		switch (functionCode) {
			case 0 :
			case 1 : {
				lambda = frameValue + 500;

				switch (functionCode) {
					case 0 : lambda = lambda * 0.001; break;
					case 1 : lambda = lambda * 0.01;
				}

				break;
			}

			case 4 : warmup    = frameValue; break;
			case 6 : errorCode = frameValue;
		}


		// Byte 1, bit 0 : Remaining bit of AFR multiplier (AF0)
		// Byte 1, bit 1 : Remaining bit of AFR multiplier (AF1)
		// Byte 1, bit 2 : Remaining bit of AFR multiplier (AF2)
		// Byte 1, bit 3 : Remaining bit of AFR multiplier (AF3)
		// Byte 1, bit 4 : Remaining bit of AFR multiplier (AF4)
		// Byte 1, bit 5 : Remaining bit of AFR multiplier (AF5)
		// Byte 1, bit 6 : Remaining bit of AFR multiplier (AF6)
		// Byte 1, bit 7 : always unset
		//
		// AFR multiplier is stoichiometric AFR value of current fuel setting in the LM-1 times 10, i.e. 14.7 for gasoline (14.7)
		// Air/Fuel Ratio = ((L0..L12) + 500) * (AF0..7) / 10000

		// Bytes 2 and 3 of the message contain lambda or status detail information
		const data = {
			errorCode,
			lambda,
			status,
			warmup,
		};

		// Format the data a little bit
		if (typeof data.lambda === 'number') {
			data.lambda = parseFloat(data.lambda.toFixed(4));
			if (data.lambda > 1.25) data.lambda = 1.25;
		}

		// Send data received from vehicle bus to socket
		socket.send('bus-rx', {
			bus   : app_intf,
			type  : 'parsed-isp2',
			topic : 'engine.lambda',
			data,
		});
	} // while (cursor > 3 && cursor >= (allegedLength + 4))
}


// Open serial port
async function init() {
	log.lib(`Initializing interface '${intf.path}'`);

	// Open the port
	try {
		// Instantiate and configure the port
		log.lib(`Configuring interface '${intf.path}'`);
		await configure_port();
		log.lib(`Configured interface '${intf.path}'`);

		intf.intf.port.on('error', console.error);

		log.lib(`Opening interface '${intf.path}'`);
		await intf.intf.port.open();
		log.lib(`Opened interface '${intf.path}'`);

		check();

		log.lib(`Initialized interface '${intf.path}'`);

		return true;
	}
	catch (error) {
		error_out('opening interface', error);
		return false;
	}
} // async init()


// Close serial port
async function term() {
	log.lib(`Terminating interface '${intf.path}'`);

	// Check if it's already closed
	const check_result = check();

	if (!check_result) return;

	// Close the port
	try {
		log.lib(`Closing interface '${intf.path}'`);
		await intf.intf.port.close();
		log.lib(`Closed interface '${intf.path}'`);

		check();

		log.lib(`Terminated interface '${intf.path}'`);

		return true;
	}
	catch (error) {
		error_out('closing interface', error);
		return false;
	}
} // async term()


module.exports = {
	// Serial interface
	port : null,

	// Start/stop functions
	init,
	term,
};
