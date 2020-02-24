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
	let lambda = (((data[4] * 128) + data[5]) / 1000) + 0.5;
	lambda = lambda.toFixed(3);


	console.log({ lambda, data });
}); // will have 16 bytes per data event


console.log('Awaiting data');
console.log('');
