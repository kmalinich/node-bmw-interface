const module_name = __filename.slice(__dirname.length + 1, -3).replace('-', '_');

module.exports = {
	// Send data over various vehicle data busses
	send : (data) => {
		// Send the data
		switch (data.bus) {
			case 'can0' : bus_data.can0(data.data); break;
			case 'can1' : bus_data.can1(data.data); break;
			case 'dbus' : bus_data.dbus(data.data); break;
			case 'ibus' : bus_data.ibus(data.data); break;
			case 'kbus' : bus_data.kbus(data.data); break;
		}
	},

	// Send over CANBUS interface
	can0 : (data) => {
		if (config.interface.can0 === null) return false;
		interface.can0.send(data);
		return true;
	},

	can1 : (data) => {
		if (config.interface.can1 === null) return false;
		interface.can1.send(data);
		return true;
	},

	// Send over DBUS interface
	dbus : (data) => {
		if (config.interface.dbus === null) return false;
		interface.dbus.send(data);
		return true;
	},

	// Try to send over IBUS, but if not available, send over KBUS
	ibus : (data) => {
		if (config.interface.ibus !== null) {
			interface.ibus.send(data);
			return true;
		}

		if (config.interface.kbus !== null) {
			interface.kbus.send(data);
			return true;
		}

		return false;
	},

	// Try to send over KBUS, but if not available, send over IBUS
	kbus : (data) => {
		if (config.interface.kbus !== null) {
			interface.kbus.send(data);
			return true;
		}

		if (config.interface.ibus !== null) {
			interface.ibus.send(data);
			return true;
		}

		return false;
	},
};
