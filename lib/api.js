const express = require('express');
const app     = express();
const server  = require('http').Server(app);

// body-parser to handle POSTed JSON
const body_parser = require('body-parser');
app.use(body_parser.json());


// Ghetto workaround so the different interface processes
// have their respective API servers listening on different
// ports
function get_port() {
	const port_base = config.api.port;

	let port_offset;
	switch (app_intf) {
		case 'can0'   : port_offset = 0; break;
		case 'can1'   : port_offset = 1; break;
		case 'client' : port_offset = 2; break;
		case 'dbus'   : port_offset = 3; break;
		case 'ibus'   : port_offset = 4; break;
		case 'kbus'   : port_offset = 5; break;

		default : port_offset = 7;
	}

	return port_base + port_offset;
}

function init() {
	app.all('*', (req, res, next) => {
		log.lib('[' + req.method + '] ' + req.originalUrl);
		res.set('Content-Type', 'application/json');
		next();
	});

	// Force-run garbage collection
	app.get('/app/gc', (req, res) => {
		if (typeof global.gc !== 'function') {
			res.send({ success : false });
			return;
		}

		global.gc();
		res.send({ success : true });
	});

	app.get('/config', (req, res) => {
		res.send(config);
	});

	app.post('/config', (req, res) => {
		if (req.headers['content-type'] !== 'application/json') {
			res.send({ error : 'invalid content-type' });
			return;
		}

		config = req.body;
		json.config_write();
		res.send(config);
	});

	app.get('/console', (req, res) => {
		update.config('console.output', !config.console.output);
		res.send(config.console);
	});

	app.get('/status', (req, res) => {
		res.send(status);
	});

	server.listen(get_port(), () => {
		log.lib('Express listening on port ' + get_port());
	});
}

function term() {
	log.lib('Terminated');
}


module.exports = {
	init,
	term,
};
