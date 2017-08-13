module.exports = {
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
			can0   : '0.0.0.0',
			can1   : '0.0.0.0',
			client : '0.0.0.0',
			daemon : '0.0.0.0',
			dbus   : '0.0.0.0',
			ibus   : '0.0.0.0',
			kbus   : '0.0.0.0',
			lcd    : '0.0.0.0',
		},
	},
};
