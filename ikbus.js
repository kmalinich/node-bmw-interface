const SerialPort = require('serialport');
const IKBUS      = require('./lib/parser-ikbus');


const port = new SerialPort('/dev/ibus', {
	baudRate : 9600,
	parity   : 'even',
});

port.on('error', console.error);


const parser = port.pipe(new IKBUS());

parser.on('data', data => {
	console.log({ msg0 : { data } });
});


console.log('Awaiting data');
console.log('');
