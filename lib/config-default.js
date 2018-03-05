const os = require('os');

let config_object = {
	api : {
		port : 3000,
	},
	console : {
		output : false,
	},
	intf : {
		can0 : null,
		can1 : null,
		dbus : null,
		ibus : null,
		kbus : null,
		lcd  : null,
	},
	json : {
		reset_on_poweroff : false,
		write_on_poweroff : false,
		write_on_reset    : false,
		write_on_run      : false,
	},
	notification : {
		method : null,
		config : {
			pushover : {
				html      : false,
				title     : app_name,
				device_id : null,
				priority  : 'low',
				sound     : 'silent',
				token     : null,
				user_id   : null,
				url       : {
					string : 'http://' + os.hostname(),
					title  : app_name + ' webUI',
				},
			},
		},
	},
	system : {
		host_data : {
			refresh_interval : 30000,
		},
	},
	zeromq : {
		host  : '127.0.0.1',
		port  : 4001,
		proto : 'tcp',
	},
};

module.exports = config_object;
