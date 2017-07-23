const module_name = __filename.slice(__dirname.length + 1, -3);

const defaults = require('defaults-deep');
const jsonfile = require('jsonfile');

const file_config = app_path+'/config.json';
const file_status = app_path+'/status.json';

const config_default = require('config-default');
const status_default = require('status-default');

module.exports = {
	// Read config+status
	read : (callback = null) => {
		json.config_read(() => { // Read JSON config file
			json.status_read(() => { // Read JSON status file
				if (typeof callback === 'function') { callback(); }
			}, callback);
		}, callback);
	},

	// Reset both modules and status vars
	reset : (callback = null) => {
		json.status_reset(() => { // Reset some variables
			if (typeof callback === 'function') { callback(); }
		}, callback);
	},

	// Write config+status
	write : (callback = null) => {
		json.config_write(() => { // Read JSON config file
			json.status_write(() => { // Read JSON status file
				if (typeof callback === 'function') { callback(); }
			}, callback);
		}, callback);
	},

	// Read config JSON
	config_read : (callback = null) => {
		jsonfile.readFile(file_config, (error, obj) => {
			if (error !== null) {
				log.msg({
					src : module_name,
					msg : 'Failed to read config, error '+error.errno+' ('+error.code+')',
				});

				config = config_default;
				json.config_write(callback);
				return false;
			}

			// Lay the default values on top of the read object,
			// in case new values were added
			config = defaults(obj, config_default);

			log.msg({
				src : module_name,
				msg : 'Read config',
			});

			if (typeof callback === 'function') { callback(); }
		});
	},

	// Write config JSON
	config_write : (callback = null) => {
		jsonfile.writeFile(file_config, config, null, (error) => {
			if (error !== null) {
				log.msg({
					src : module_name,
					msg : 'Failed to write config, '+error.errno+' ('+error.code+')',
				});

				if (typeof callback === 'function') { callback(); }
				return false;
			}

			log.msg({
				src : module_name,
				msg : 'Wrote config',
			});

			if (typeof callback === 'function') { callback(); }
		});
	},

	// Read status JSON
	status_read : (callback = null) => {
		jsonfile.readFile(file_status, (error, obj) => {
			if (error !== null) {
				log.msg({
					src : module_name,
					msg : 'Failed to read status, '+error.errno+' ('+error.code+')',
				});

				status = status_default;
				json.status_write(callback);
				return false;
			}

			// Lay the default values on top of the read object,
			// in case new values were added
			status = defaults(obj, status_default);

			log.msg({
				src : module_name,
				msg : 'Read status',
			});

			if (typeof callback === 'function') { callback(); }
		});
	},

	// Write status JSON
	status_write : (callback = null) => {
		jsonfile.writeFile(file_status, status, null, (error) => {
			if (error !== null) {
				log.msg({
					src : module_name,
					msg : 'Failed to write status, '+error.errno+' ('+error.code+')',
				});

				if (typeof callback === 'function') { callback(); }
				return false;
			}

			log.msg({
				src : module_name,
				msg : 'Wrote status',
			});

			if (typeof callback === 'function') { callback(); }
		});
	},

	// Reset some variables
	status_reset : (callback = null) => {
		status = status_default;
		json.status_write(() => {
			log.msg({
				src : module_name,
				msg : 'Reset status',
			});

			if (typeof callback === 'function') { callback(); }
		}, callback);
	},
};
