#!/usr/bin/env node

const { SerialPort } = require('serialport-rs');

const ISP2 = require('./lib/parser-isp2');


const port = new SerialPort({
	baudRate : 19200,
	path     : '/dev/isp2',
});

port.on('error', console.error);


const parser = port.pipe(new ISP2());

parser.on('data', data => { console.log({ data }); });


console.log('Awaiting data');
console.log('');
