module.exports = {
	// Send data over various vehicle data busses
	send : (data) => {
		intf.intf.send(data);
	},
};
