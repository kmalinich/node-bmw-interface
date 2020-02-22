// https://www.innovatemotorsports.com/support/downloads/Seriallog-2.pdf
// https://www.innovatemotorsports.com/resources/serial-protocol.php
// https://arduino.stackexchange.com/questions/70491/decoding-serial-packets-please-check-my-work

const SerialPort = require('serialport');
const ByteLength = require('@serialport/parser-byte-length');

const port = new SerialPort('/dev/lm2', {
	baudRate : 19200,
});

port.on('error', console.error);

const parser = port.pipe(new ByteLength({
	length : 6,
}));

parser.on('data', data => {
	// const lambda = ((data[4] << 8) + data[5]) / 1000;
	let lambda = (((data[4] * 128) + data[5]) / 1000) + 0.5;
	lambda = parseFloat(lambda.toFixed(3));

	// const lambda = data[4] + data[5];

	console.log({ data, lambda });
}); // will have 16 bytes per data event


console.log('Awaiting data');
console.log('');
