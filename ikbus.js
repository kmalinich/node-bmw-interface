const SerialPort = require('serialport');
const IKBUS       = require('./lib/parser-bmw');


const port = new SerialPort('/dev/kbus', {
	baudRate : 19200,
});

port.on('error', console.error);


const parser = port.pipe(new IKBUS());

parser.on('data', data => {
	console.log({ data });
});


console.log('Awaiting data');
console.log('');
