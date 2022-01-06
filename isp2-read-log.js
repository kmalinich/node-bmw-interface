#!/usr/bin/env node

/* eslint key-spacing      : 0 */
/* eslint no-console       : 0 */
/* eslint no-global-assign : 0 */

// https://www.innovatemotorsports.com/support/downloads/Seriallog-2.pdf
// https://www.innovatemotorsports.com/resources/serial-protocol.php
// https://arduino.stackexchange.com/questions/70491/decoding-serial-packets-please-check-my-work


const { Console } = require('console');

const cs = new Console({
	stdout : process.stdout,
	stderr : process.stderr,

	inspectOptions : {
		breakLength : Infinity,
		colors      : true,
		compact     : 50,
		showHidden  : false,
	},
});

hex = require('./share/hex');


let array  = [];
let cursor = 0;

// Lambda is represented as 0.5 to 1.532 in 0.001 increments

// eslint-disable-next-line no-unused-vars
function genLogObj(cursor, newByte, array) {
	return {
		cursor,
		newByte : hex.i2s(newByte, false),
		array   : Buffer.from(array),
	};
}

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

		switch (functionCode) {
			case 0 :
			case 1 : {
				lambda = ((frame[4] << 7 | frame[5]) & 0x1FFF) + 500;

				switch (functionCode) {
					case 0 : lambda = lambda * 0.001; break;
					case 1 : lambda = lambda * 0.01;
				}

				break;
			}

			case 4 : warmup    = ((frame[4] << 7 | frame[5]) & 0x1FFF); break;
			case 6 : errorCode = ((frame[4] << 7 | frame[5]) & 0x1FFF);
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
			status,

			errorCode,
			warmup,
			lambda,
		};

		// Format the data a little bit
		data.lambda = parseFloat(data.lambda.toFixed(4));

		cs.log('>>>>>>> %o', data);
	} // while (cursor > 3 && cursor >= (allegedLength + 4))
}


const { readFileSync } = require('fs');


(async () => {
	const logData = readFileSync('./innovate2.bin');
	cs.log('logData read');

	// let wait = true;

	for await (const dataByte of logData) {
		// cs.log('dataByte: %o', dataByte);
		processISP2Data(dataByte);

		// wait = !wait;
		// if (wait) await new Promise(resolve => setTimeout(resolve, 20.48));
	}
})();
