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

	options : {
		attemptLimit : {
			dbus : 200,
			ibus : 200,
			isp2 : 200,
			kbus : 200,
		},

		ctsrts_retry : {
			dbus : true,
			ibus : true,
			isp2 : false,
			kbus : true,
		},

		debug : {
			dbus : false,
			ibus : false,
			isp2 : false,
			kbus : false,
		},
	},

	socket : {
		type : 'path',
		path : '/run',
		host : '0.0.0.0',
		port : 4001,
	},
};


module.exports = config_object;
