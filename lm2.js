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
	length : 1,
}));

parser.on('data', console.log); // will have 16 bytes per data event


console.log('Awaiting data');
console.log('');
