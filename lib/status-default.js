const status_object = {
	intf : {
		errors : {
			current : 0,
			resets  : 0,
			total   : 0,
		},

		messages : 0,

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
	},
};


module.exports = status_object;
