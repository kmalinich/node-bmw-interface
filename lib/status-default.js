module.exports = {
	server : {
		connected : false,
		connecting : false,
		latency : 0,
		reconnecting : false,
	},
	interface : {
		can0 : {
			configured : false,
			messages : 0,
			up : false,
			errors : {
				current : 0,
				resets : 0,
				total : 0,
			},
		},
		can1 : {
			configured : false,
			messages : 0,
			up : false,
			errors : {
				current : 0,
				resets : 0,
				total : 0,
			},
		},
		dbus : {
			configured : false,
			messages : 0,
			up : false,
			errors : {
				current : 0,
				resets : 0,
				total : 0,
			},
		},
		ibus : {
			configured : false,
			messages : 0,
			up : false,
			errors : {
				current : 0,
				resets : 0,
				total : 0,
			},
		},
		kbus : {
			configured : false,
			messages : 0,
			up : false,
			errors : {
				current : 0,
				resets : 0,
				total : 0,
			},
		},
		lcd : {
			configured : false,
			messages : 0,
			up : false,
			errors : {
				current : 0,
				resets : 0,
				total : 0,
			},
		},
	},
	system : {
		temperature : null,
		up : null,
		host : {
			full : null,
			short : null,
		},
		cpu : {
			arch : null,
			load : null,
			model : null,
			speed : null,
		},
		memory : {
			free : null,
			total : null,
		},
		os : {
			platform : null,
			type : null,
			release : null,
		},
	},
};
