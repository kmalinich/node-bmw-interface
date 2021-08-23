const SerialPort = require('serialport');
const ISP2       = require('./lib/parser-isp2');


const port = new SerialPort('/dev/ttyUSB1', {
	baudRate : 19200,
});

port.on('error', console.error);


const parser = port.pipe(new ISP2());

parser.on('data', data => {
	// console.log({ data });
});


console.log('Awaiting data');
console.log('');
