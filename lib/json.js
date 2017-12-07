/* eslint no-global-assign: 0 */

const write_options = { spaces : '\t' };

const defaults = require('defaults-deep');
const jsonfile = require('jsonfile');

const file_config = app_path + '/config.json';
const file_status = app_path + '/status-' + app_intf + '.json';

const config_default = require('config-default');
const status_default = require('status-default');

module.exports = {
	// Read config+status
	read : (callback = null) => {
		json.config_read(() => { // Read JSON config file
			json.status_read(() => { // Read JSON status file
				process.nextTick(callback);
			}, callback);
		}, callback);
	},

	// Reset both modules and status vars
	reset : (callback = null) => {
		json.status_reset(() => { // Reset some variables
			process.nextTick(callback);
		}, callback);
	},

	// Write config+status
	write : (callback = null) => {
		json.config_write(() => { // Read JSON config file
			json.status_write(() => { // Read JSON status file
				process.nextTick(callback);
			}, callback);
		}, callback);
	},

	// Read config JSON
	config_read : (callback = null) => {
		jsonfile.readFile(file_config, (error, obj) => {
			if (error !== null) {
				log.msg({ msg : 'Failed to read config, error ' + error.errno + ' (' + error.code + ')' });

				config = config_default;
				json.config_write(callback);
				return false;
			}

			// Lay the default values on top of the read object,
			// in case new values were added
			config = defaults(obj, config_default);

			log.msg({ msg : 'Read config' });

			process.nextTick(callback);
		});
	},

	// Write config JSON
	config_write : (callback = null) => {
		jsonfile.writeFile(file_config, config, write_options, (error) => {
			if (error !== null) {
				log.msg({ msg : 'Failed to write config, ' + error.errno + ' (' + error.code + ')' });

				process.nextTick(callback);
				return false;
			}

			log.msg({ msg : 'Wrote config' });

			process.nextTick(callback);
		});
	},

	// Read status JSON
	status_read : (callback = null) => {
		jsonfile.readFile(file_status, (error, obj) => {
			if (error !== null) {
				log.msg({ msg : 'Failed to read status, ' + error.errno + ' (' + error.code + ')' });

				status = status_default;
				json.status_write(callback);
				return false;
			}

			// Lay the default values on top of the read object,
			// in case new values were added
			status = defaults(obj, status_default);

			log.msg({ msg : 'Read status' });

			process.nextTick(callback);
		});
	},

	// Write status JSON
	status_write : (callback = null) => {
		jsonfile.writeFile(file_status, status, write_options, (error) => {
			if (error !== null) {
				log.msg({ msg : 'Failed to write status, ' + error.errno + ' (' + error.code + ')' });

				process.nextTick(callback);
				return false;
			}

			log.msg({ msg : 'Wrote status' });

			process.nextTick(callback);
		});
	},

	// Reset some variables
	status_reset : (callback = null) => {
		status = status_default;
		log.msg({ msg : 'Reset status' });

		process.nextTick(callback);
	},
};
