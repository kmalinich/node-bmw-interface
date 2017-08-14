let status_object = {
	intf : {
		errors : {
			current : 0,
			resets : 0,
			total : 0,
		},
		messages : 0,
		up : false,
	},
	server : {
		connected : false,
		connecting : false,
		latency : 0,
		reconnecting : false,
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

module.exports = status_object;
