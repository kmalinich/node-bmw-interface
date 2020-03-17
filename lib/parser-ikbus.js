// Based on CCTalkParser
// https://github.com/serialport/node-serialport/blob/master/packages/parser-cctalk/lib/index.test.js

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

		if (this.maxDelayBetweenBytesMs > 0) {
			if (now - this.lastByteFetchTime > this.maxDelayBetweenBytesMs) {
				this.array  = [];
				this.cursor = 0;
			}

			console.log({ msg1 : { now, lastTime : this.lastByteFetchTime, diff : now - this.lastByteFetchTime, buffer } });

			this.lastByteFetchTime = now;
		}


		this.cursor += buffer.length;

		// Add new buffer data to this.array
		this.array = [ ...this.array, ...Array.from(buffer) ];

		console.log({ msg2 : { cursor : this.cursor, array : Buffer.from(this.array) } });

		while (this.cursor > 1 && this.cursor >= this.array[1] + 4) {
			// full frame accumulated
			// copy command from the array
			const FullMsgLength = this.array[1] + 4;

			const frame = Buffer.from(this.array.slice(0, FullMsgLength));

			// Preserve extra data
			this.array   = this.array.slice(frame.length, this.array.length);
			this.cursor -= FullMsgLength;

			console.log({ msg3 : { cursor : this.cursor, FullMsgLength, buffer, array : Buffer.from(this.array) } });

			this.push(frame);
		}

		cb();
	}
}


module.exports = IKBUSParser;
