'use strict';
var panic = require('panic-server');
var spawn = require('child_process').spawn;
var path = require('path');
var http = require('http');
var fs = require('fs');
var ports = require('../ports');

var wd = require('selenium-webdriver');

var jsonData = path.join(__dirname, '..', '..', 'delete-me.json');

function open(browser) {
	var driver = new wd.Builder()
		.forBrowser(browser)
		.build();

	driver.get(`http://localhost:${ports.panic}/index.html`);

	return driver;
}

var drivers = [
	open('phantomjs'),
	open('phantomjs')
];

var staticServer = new http.Server(function (req, res) {
	if (req.url === '/') {
		req.url = '/index.html';
	}
	var file = path.join(__dirname, '..', req.url);
	try {
		var page = fs.readFileSync(file, 'utf8');
		res.end(page);
	} catch (e) {
		// don't care
	}
});

var server = panic.clients.filter('Node.js').pluck(1);
var browsers = panic.clients.excluding(server);

var alice = browsers.pluck(1);
var bob = browsers.excluding(alice).pluck(1);

var serverPath = path.join(__dirname, '..', 'gun-server.js');

// start the server on :8080
spawn('node', [serverPath]);

function waitFor (num, list) {
	return new Promise(function (res) {

		function ready() {
			if (list.length < num) {
				return;
			}

			res();
			list.removeListener('add', ready);

			return true;
		}

		if (!ready()) {
			list.on('add', ready);
		}

	});
}

before(function () {

	this.timeout(1500000);

	// start the panic server
	panic.server(staticServer).listen(ports.panic);

	return waitFor(2, browsers)
		.then(function () {
			return waitFor(1, server);
		});
});

var scope = {
	uniqueKey: Math.random().toString(16).slice(2),
	file: jsonData,
	'@scope': true
}

describe('Gun', function () {

	it('should be able to recover from disastrous failure', function * () {
		this.timeout(1500000);

		yield browsers.run(function () {
			localStorage.clear();
		});

		yield browsers.run(function () {
			window.ref = gun.get(uniqueKey).put({
				text: 'ignore'
			});
		}, scope);

		yield alice.run(function (done) {
			// alice saves some data
			ref.path('text').put('Initial text', done);
		});

		yield bob.run(function (done) {
			var ctx = this;
			ref.path('text').on(function (data) {
				if (data !== 'ignore') {
					done();
				}
			});
		});

		yield server.run(function () {
			var fs = require('fs');

			// destroy the data
			fs.unlinkSync(file);

			// crash the server
			process.exit(0);
		}, scope);

		yield alice.run(function (done) {
			ref.path('text').put('A conflicting update');
			setTimeout(done, 50);
		});

		yield bob.run(function () {
			ref.path('text').put('B conflicting update');
		});

		spawn('node', [serverPath]);
		yield waitFor(1, server);

		yield browsers.run(function (done) {
			var ctx = this;
			ref.path('text').on(function (value) {
				if (value === 'B conflicting update') {
					done();
				}
			});
		});

	});
});


after(function () {
	if (server.length) {

		try {
			fs.unlinkSync(jsonData);
		} catch (e) {}

		return server.run(function () {
			process.exit(0);
		});
	}
});
