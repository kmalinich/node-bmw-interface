module.exports = {
	// Send data over various vehicle data busses
	send : (data) => {
		// Send the data
		if (data.bus === app_intf) intf.intf.send(data);
	},
};
