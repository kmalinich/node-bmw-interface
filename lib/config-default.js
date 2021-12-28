const config_object = {
	can : {
		check : {
			allow  : true,
			repeat : true,
		},
	},

	console : {
		output : false,
	},

	intf : {
		can0 : null,
		can1 : null,
		dbus : null,
		ibus : null,
		isp2 : null,
		kbus : null,
	},

	socket : {
		type : 'path',
		path : '/run',
		host : '0.0.0.0',
		port : 4001,
	},
};


module.exports = config_object;
