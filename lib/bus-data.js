const module_name = __filename.slice(__dirname.length + 1, -3).replace('-', '_');

module.exports = {
	// Send data over various vehicle data busses
	send : (data) => {
		// Send the data
		switch (data.bus) {
			case 'can0' : bus.data.can0(data.data); break;
			case 'can1' : bus.data.can1(data.data); break;
			case 'dbus' : bus.data.dbus(data.data); break;
			case 'ibus' : bus.data.ibus(data.data); break;
			case 'kbus' : bus.data.kbus(data.data); break;
		}
	},

	// Send over CANBUS interface
	can0 : (data) => {
		if (config.intf.can0 === null) return false;
		intf.can0.send(data);
		return true;
	},

	can1 : (data) => {
		if (config.intf.can1 === null) return false;
		intf.can1.send(data);
		return true;
	},

	// Send over DBUS intf
	dbus : (data) => {
		if (config.intf.dbus === null) return false;
		intf.dbus.send(data);
		return true;
	},

	// Try to send over IBUS, but if not available, send over KBUS
	ibus : (data) => {
		if (config.intf.ibus !== null) {
			intf.ibus.send(data);
			return true;
		}

		if (config.intf.kbus !== null) {
			intf.kbus.send(data);
			return true;
		}

		return false;
	},

	// Try to send over KBUS, but if not available, send over IBUS
	kbus : (data) => {
		if (config.intf.kbus !== null) {
			intf.kbus.send(data);
			return true;
		}

		if (config.intf.ibus !== null) {
			intf.ibus.send(data);
			return true;
		}

		return false;
	},
};
