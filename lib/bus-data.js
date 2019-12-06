module.exports = {
	// Send data over various vehicle data busses
	send : async (data) => {
		// Send the data
		if (data.bus === app_intf) await intf.intf.send(data);
	},
};
