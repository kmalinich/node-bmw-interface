let status_object = {
	intf : {
		errors : {
			current : 0,
			resets  : 0,
			total   : 0,
		},

		messages        : 0,
		messages_repeat : 0,

		up : false,
	},

	server : {
		connected    : false,
		connecting   : false,
		reconnecting : false,
	},

	system : {
		intf : app_intf,
		type : app_intf || null,

		up : 0,

		temperature : 0,

		cpu : {
			arch  : null,
			count : 0,

			load     : [ 0, 0, 0 ],
			load_pct : 0,

			model : null,
			speed : 0,
		},

		host : {
			full  : null,
			short : null,
		},

		memory : {
			free     : 0,
			free_pct : 0,

			total : 0,
		},

		os : {
			platform : null,
			release  : null,
			type     : null,
		},
	},
};

module.exports = status_object;
