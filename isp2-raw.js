// https://www.innovatemotorsports.com/support/downloads/Seriallog-2.pdf
// https://www.innovatemotorsports.com/resources/serial-protocol.php
// https://arduino.stackexchange.com/questions/70491/decoding-serial-packets-please-check-my-work


// Lambda is represented as 0.5 to 1.532 in 0.001 increments


const SerialPort = require('serialport');
const ByteLength = require('@serialport/parser-byte-length');

let array  = [];
let cursor = 0;


function proc_isp2(buffer) {
	// The first 2 bytes of a message are the message header
	// Both bytes of a message header have their high bit set (0x80) ... for what appears to be the purpose of denoting it is the header
	const header_present = ((Array.from(buffer)[0] & 0x80) && (Array.from(buffer)[1] & 0x80));

	// console.log({ buffer, array, cursor, header_present });

	// Return here if a properly formed header as per the specification is not detected
	if (!header_present) return;


	// The header also contains the total length of a message, which may be modified by any datasource device in the chain
	// Actual message length can be found by unsetting 0x80 from byte 1
	const alleged_length = Array.from(buffer)[1] & ~0x80;

	// Return here if alleged length is outside of the bounds of the specification
	if (alleged_length < 1 || alleged_length > 7) return;


	// Increment cursor by the length of the new buffer data
	cursor += buffer.length;

	// Add new buffer data to array
	array = [ ...array, ...Array.from(buffer) ];


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
		// Function/status bits indicating how interpret the next word (lambda word)
		//
		// 000 - Lambda valid and aux data valid, normal operation
		// 001 - Warming up, lambda value is temp in 1/10% of operating temp
		// 010 - Free air calibration in progress, lambda data not valid
		// 011 - Error code in lambda value
		// 100 - Lambda value contains O2 level in 1/10%
		// 101 - Heater calibration, lambda value contains calibration countdown
		// 110 - Need free air calibration Request, lambda data not valid
		// 111 - Lambda value is flash level in 1/10%


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
			lambda : (((frame[4] * 128) + frame[5]) / 1000) + 0.5,
		};

		// Format up the lambda data a little bit
		data.lambda = parseFloat(data.lambda.toFixed(3));

		console.log({ push : data });
	}
}


const port = new SerialPort('/dev/lm2', {
	baudRate : 19200,
});

port.on('error', console.error);

const parser = port.pipe(new ByteLength({
	length : 6,
}));

parser.on('data', data => {
	proc_isp2(data);

	// let lambda = (((data[4] * 128) + data[5]) / 1000) + 0.5;
	// lambda = lambda.toFixed(3);
	// console.log({ lambda, data });
}); // will have 16 bytes per data event


console.log('Awaiting data');
console.log('');
