// Based on CCTalkParser
// https://github.com/serialport/node-serialport/blob/main/packages/parser-cctalk/lib/index.ts

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


const { Transform } = require('stream');

class IKBUSParser extends Transform {
	constructor(maxDelayBetweenBytesMs = 100) {
		super();

		this.array  = [];
		this.cursor = 0;

		this.lastByteFetchTime = 0;

		this.maxDelayBetweenBytesMs = maxDelayBetweenBytesMs;
	}


	_transform(buffer, _, cb) {
		const now = Date.now();

		let diff = (now - this.lastByteFetchTime);

		if (diff > 100000) diff = 0;

		if (diff > this.maxDelayBetweenBytesMs) {
			this.array  = [];
			this.cursor = 0;
		}

		// cs.log('%s :: %o :: %o', 'msg0', buffer.toString('hex'), diff);

		this.lastByteFetchTime = now;


		this.cursor += buffer.length;

		Array.from(buffer).map(byte => this.array.push(byte))

		cs.log('%s :: %o :: %o', 'msg1', diff, Buffer.from(this.array).toString('hex'));


		// IBUS/KBUS message:
		// SRC LEN DST MSG CHK
		// LEN is the length of the message after the LEN byte (or the entire thing, minus 2)

		const msgLength = this.array[1] + 2;

		while (this.cursor > 1 && this.cursor >= msgLength) {
			// full frame accumulated
			// copy command from the array
			const frame = Buffer.from(this.array.slice(0, msgLength));

			// Preserve extra data
			this.array = this.array.slice(frame.length, this.array.length);
			this.cursor -= msgLength;

			cs.log('%s :: %o :: %o', 'msg2', diff, buffer.toString('hex'));

			this.push(frame);
		}

		cb();
	}
}


module.exports = IKBUSParser;
