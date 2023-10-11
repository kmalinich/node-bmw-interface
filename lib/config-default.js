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
		attemptInterval : {
			dbus : 10,
			ibus : 10,
			isp2 : 10,
			kbus : 10,
		},

		attemptLimit : {
			dbus : 200,
			ibus : 200,
			isp2 : 200,
			kbus : 200,
		},

		ctsrts_retry : {
			dbus : true,
			ibus : true,
			isp2 : true,
			kbus : true,
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
