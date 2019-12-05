/* eslint no-global-assign: 0 */

const write_options = { spaces : '\t' };

const defaults = require('defaults-deep');
const jsonfile = require('jsonfile');

const file_config = app_path + '/config.json';
const file_status = app_path + '/status-' + app_intf + '.json';

const config_default = require('config-default');
const status_default = require('status-default');


// Read config+status
async function read() {
	// Read JSON config+status files
	await config_read();
	await status_read();
}

// Write config+status
async function write() {
	// Write JSON config+status files
	await config_write();
	await status_write();
}

// Reset both modules and status vars
async function reset() {
	await status_reset();  // Reset some variables

	if (config.json.write_on_reset !== true) return;
	await write(); // Write JSON files
}


// Read config JSON
async function config_read() {
	let config_data;

	try {
		config_data = await jsonfile.readFileSync(file_config);
	}
	catch (error) {
		log.lib('Failed reading config, applying default config');
		console.error(error);

		config = config_default;
		await config_write();
		return false;
	}

	// Lay the default values on top of the read object, in case new values were added
	config = await defaults(config_data, config_default);

	log.lib('Read config');
}

// Read status JSON
async function status_read() {
	let status_data;

	try {
		status_data = await jsonfile.readFileSync(file_status);
	}
	catch (error) {
		log.lib('Failed reading status, applying default status');
		console.error(error);

		status = status_default;
		await status_write();
		return false;
	}

	// Lay the default values on top of the read object, in case new values were added
	status = await defaults(status_data, status_default);

	log.lib('Read status');
}


// Write config JSON
async function config_write() {
	// Don't write if empty
	if (typeof config.system === 'undefined') {
		log.lib('Failed writing config, config object empty');
		return;
	}

	try {
		await jsonfile.writeFileSync(file_config, config, write_options);
	}
	catch (error) {
		log.lib('Failed writing config');
		console.error(error);
		return false;
	}

	log.lib('Wrote config');
}

// Write status JSON
async function status_write() {
	// Don't write if empty
	if (typeof status.system === 'undefined') {
		log.lib('Failed writing status, status object empty');
		return;
	}

	try {
		await jsonfile.writeFileSync(file_status, status, write_options);
	}
	catch (error) {
		log.lib('Failed writing status');
		console.error(error);
		return false;
	}

	log.lib('Wrote status');
}


// Reset status
async function status_reset() {
	status = status_default;

	log.lib('Reset status');
}


module.exports = {
	config_read,
	config_write,

	status_read,
	status_reset,
	status_write,

	read,
	reset,
	write,
};
