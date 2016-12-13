/* global Gun */
/* eslint-env mocha */
'use strict';

const panic = require('panic-server');
const wd = require('selenium-webdriver');
const config = require('../panic.config.js');

let drivers = [];

function open (browser) {
  const driver = new wd.Builder()
    .withCapabilities(browser)
    .build();

  driver.get(config.browser.page);

  driver.executeScript(panic.client);
  driver.executeScript(function (url) {
    panic.server(url);
  }, config.panic);

  return driver;
}

const server = panic.clients.filter('Node.js').pluck(1);
const browsers = panic.clients.excluding(server);

const alice = browsers.pluck(1);
const bob = browsers.excluding(alice).pluck(1);

panic.server().listen(config.port);

/**
 * Starts a gun server and a static server.
 * @param  {Object} job - The job context.
 * @return {undefined}
 */
function startServer (job) {
  const server = require('http').Server();
  const Gun = require(this.props.gun);
  const fs = require('fs');

  const gun = Gun({
    file: this.props.file,
  });

  this.set('gun', gun);

  gun.wsp(server);
  server.listen(this.props.port);

  server.on('request', function (req, res) {
    if (gun.wsp.server(req, res)) {
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(job.props.html).pipe(res);
  });

  server.listen(this.props.port);
}

/**
 * Creates a gun instance and exposes it as `.get('gun')`.
 * The props given are given to the gun constructor.
 * Depends on the `.get('get')` env var.
 * @return {String} - The key to retrieve.
 */
function setupBrowserGun () {
  const root = Gun(this.props);

  const key = this.get('key');
  const gun = root.get(key);
  this.set('gun', gun);

  return key;
}

/**
 * Injects a script into the page.
 * @return {undefined}
 */
function loadScript () {
  this.async();

  const script = document.createElement('script');
  script.src = this.props.src;

  script.onerror = this.fail;
  script.onload = this.done;

  document.body.appendChild(script);
}

describe('Gun', function () {

  before(function * () {
    this.timeout(15000);

    // Spawn a node process.
    config.manager.start({
      clients: [{ type: 'node' }],
      panic: config.panic,
    });

    // Wait for the server to join.
    yield server.atLeast(1);

    // Start an http and gun server.
    yield server.run(startServer, config.server);

    // Open the browsers.
    drivers = config.browser.types.map(open);

    // Wait for them to connect.
    yield browsers.atLeast(2);

    // Remove any previous localStorage data.
    yield browsers.run(function () {
      localStorage.clear();
    });

    // Inject gun into the browsers.
    yield browsers.run(loadScript, {
      src: `${config.server.url}/gun.js`,
    });

    // Agree on a random gun key.
    yield panic.clients.run(function () {
      this.set('key', this.props.key);
    }, {
      key: config.browser.key,
    });

  });

  it('should allow data sync between clients', function * () {
    this.timeout(10000);

    yield browsers.run(setupBrowserGun, {
      peers: [
        `${config.server.url}/gun`,
      ],
    });

    // Alice saves some data
    yield alice.run(function () {
      const gun = this.get('gun');

      gun.put({
        text: 'Alice update',
      });
    });

    // Bob waits for it to show up.
    yield bob.run(function () {
      const done = this.async();
      const gun = this.get('gun');

      gun.path('text').on(function (data) {
        if (data === 'Alice update') {
          done();
        }
      });
    });
  });

  it('should recover data from clients after data loss', function * () {
    this.timeout(15000);

    // End the server, destroy the data.
    yield server.run(function () {
      const fs = require('fs');

      // destroy the data
      fs.unlinkSync(this.props.file);

      // crash the server
      process.exit(0);
    }, {
      file: config.server.file,
    });

    // Make two conflicting updates while offline.
    yield alice.run(function () {
      const done = this.async();
      const gun = this.get('gun');

      gun.path('text').put('A conflicting update');
      setTimeout(done, 50);
    });

    yield bob.run(function () {
      const gun = this.get('gun');

      gun.path('text').put('B conflicting update');
    });

    // Start the server again.
    config.manager.start({
      clients: [{ type: 'node' }],
      panic: config.panic,
    });

    yield server.atLeast(1);

    // Start up the gun/http server again.
    yield server.run(startServer, config.server);

    yield browsers.run(function () {
      location.reload();
    });

    yield browsers.atLeast(2);

    yield browsers.run(function () {
      this.set('key', this.props.key);
    }, {
      key: config.browser.key,
    });

    yield browsers.run(loadScript, {
      src: `${config.server.url}/gun.js`,
    });

    yield browsers.run(setupBrowserGun, {
      peers: [
        `${config.server.url}/gun`,
      ],
    });

    // Expect both browsers to converge on the newer value
    // (must be running on the same machine, sharing a clock).
    yield browsers.run(function () {
      const gun = this.get('gun');
      const done = this.async();

      gun.path('text').on(function (value) {
        if (value === 'B conflicting update') {
          done();
        }
      });
    });

  });

  after(function * () {

    function exit () {
      process.exit(0);
    }

    /** End the selenium-webdriver processes. */
    drivers.forEach(function (driver) {
      driver.quit();
      driver.close();
    });

    /** Kill the gun server. */
    yield server.run(exit);

    /** Start a new node process. */
    config.manager.start({
      clients: [{ type: 'node' }],
      panic: config.panic,
    });

    /** Wait for it to connect. */
    yield server.atLeast(1);

    /** Have it remove the data file. */
    yield server.run(function () {
      const fs = require('fs');
      const done = this.async();

      fs.unlink(this.props.file, done);
    }, {
      file: config.server.file,
    });

    /** Then destroy it too. */
    yield server.run(exit);

  });
});
