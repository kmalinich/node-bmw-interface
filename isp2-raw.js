/* eslint key-spacing      : 0 */
/* eslint no-console       : 0 */
/* eslint no-global-assign : 0 */

// https://www.innovatemotorsports.com/support/downloads/Seriallog-2.pdf
// https://www.innovatemotorsports.com/resources/serial-protocol.php
// https://arduino.stackexchange.com/questions/70491/decoding-serial-packets-please-check-my-work


// Lambda is represented as 0.5 to 1.532 in 0.001 increments


hex     = require('./share/hex');
bitmask = require('./share/bitmask');

const SerialPort = require('serialport');
const ByteLength = require('@serialport/parser-byte-length');

let array  = [];
let cursor = 0;


function proc_isp2(buffer) {
	// console.log('');

	// console.log({ buffer });

	// Increment cursor by the length of the new buffer data
	cursor += buffer.length;

	// Add new buffer data to array
	array = [ ...array, ...Array.from(buffer) ];

	// console.log({ array : Buffer.from(array) });

	// Wait until at least 2 bytes have been accumulated
	if (array.length < 2) return;

	if (array.length > 6) {
		array = [];
		console.log('Emptying array, data is too long');
		return;
	}

	// The first 2 bytes of a message are the message header
	// Both bytes of a message header have their high bit set (0x80) ... for what appears to be the purpose of denoting it is the header
	const header_present = (array[0] & 0x80) && (array[1] & 0x80);

	// Return here if a properly formed header as per the specification is not detected
	if (!header_present) {
		array = [];
		console.log('Emptying array, header not present');
		return;
	}

	// Wait until at least 6 bytes have been accumulated
	if (array.length < 6) return;

	// The header also contains the total length of a message, which may be modified by any datasource device in the chain
	// Actual message length can be found by unsetting 0x80 from byte 1
	const alleged_length = array[1] & ~0x80;

	// console.log({ buffer, array : Buffer.from(array), alleged_length });

	// Empty array and return here if alleged length is outside of the bounds of the specification
	if (alleged_length < 1 || alleged_length > 7) {
		array = [];
		console.log('Emptying array, alleged length %i too long or too short', alleged_length);
		return;
	}


	while (cursor > 3 && cursor >= (alleged_length + 4)) {
		// Full frame accumulated
		// Copy command from the array
		const FullMsgLength = (array[1] & ~0x80) + 4;

		const frame = Buffer.from(array.slice(0, FullMsgLength));

		// Preserve extra data
		array = array.slice(frame.length, array.length);

		cursor -= FullMsgLength;

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

		const mask = bitmask.check(frame[2]).mask;

		if (typeof mask    === 'undefined') return;
		if (typeof mask.b2 === 'undefined') return;
		if (typeof mask.b3 === 'undefined') return;
		if (typeof mask.b4 === 'undefined') return;

		let status = 'unknown';

		switch (mask.b2) {
			case false : {
				switch (mask.b3) {
					case false : {
						switch (mask.b4) {
							case false : status = 'Lambda valid'; break;
							case true  : status = 'Warming up, value is %';
						}
						break;
					}
					case true : {
						switch (mask.b4) {
							case false : status = 'Lambda value not valid - free air calibration in progress'; break;
							case true  : status = 'Value is error code';
						}
					}
				}
				break;
			}

			case true : {
				switch (mask.b3) {
					case false : {
						switch (mask.b4) {
							case false : status = 'Value is O2 %'; break;
							case true  : status = 'Heater calibration, value is calibration countdown';
						}
						break;
					}
					case true : {
						switch (mask.b4) {
							case false : status = 'Lambda value not valid - requires free air calibration'; break;
							case true  : status = 'Value is flash %';
						}
					}
				}
			}
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
			// frame,
			v : (((frame[4] * 128) + frame[5]) / 1000) + 0.5,

			// mask0 : bitmask.check(frame[0]).mask,
			// mask1 : bitmask.check(frame[1]).mask,
			// mask2 : bitmask.check(frame[2]).mask,
			// mask3 : bitmask.check(frame[3]).mask,
		};

		// Format up the lambda data a little bit
		data.v = parseFloat(data.v.toFixed(3));

		if (status === 'Lambda valid') {
			process.stdout.write(data.v + '\r');
			return;
		}

		status.st = status;
		console.log(data);
	}
}


const port = new SerialPort('/dev/lm2', {
	baudRate : 19200,
});

port.on('error', console.error);

const parser = port.pipe(new ByteLength({
	length : 1,
}));

parser.on('data', data => {
	proc_isp2(data);
}); // will have 16 bytes per data event
