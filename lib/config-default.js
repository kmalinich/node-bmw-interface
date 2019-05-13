let config_object = {
	console : {
		output : false,
	},

	intf : {
		can0 : null,
		can1 : null,
		dbus : null,
		ibus : null,
		kbus : null,
	},

	json : {
		reset_on_poweroff : false,
		write_on_poweroff : false,
		write_on_reset    : false,
		write_on_run      : false,
	},

	socket : {
		type : 'path',
		path : '/var/run/bmwi-' + app_intf + '.sock',
		host : '0.0.0.0',
		port : 4001,
	},
};


module.exports = config_object;
