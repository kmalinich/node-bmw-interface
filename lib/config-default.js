module.exports = {
	interface : {
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
		write_on_reset : false,
		write_on_run : false,
	},
	notification : {
		method : null,
		config : {
			pushover : {
				html : false,
				title : app_name,
				device_id : null,
				priority : 'low',
				sound : 'silent',
				token : null,
				user_id : null,
				url : {
					string : 'http://'+os.hostname(),
					title : app_name+' webUI',
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
		proto : 'tcp',
		ports : {
			can0   : 4000,
			can1   : 4001,
			client : 4002,
			daemon : 4003,
			dbus   : 4004,
			ibus   : 4005,
			kbus   : 4006,
			lcd    : 4007,
		},
		urls : {
			can0   : '127.0.0.1',
			can1   : '127.0.0.1',
			client : '127.0.0.1',
			daemon : '127.0.0.1',
			dbus   : '127.0.0.1',
			ibus   : '127.0.0.1',
			kbus   : '127.0.0.1',
			lcd    : '127.0.0.1',
		},
	},
};
