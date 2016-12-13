/* eslint-disable no-process-env */
'use strict';
const path = require('path');

const Manager = require('panic-manager');
const port = Number(process.argv[2] || process.env.PORT) || 8080;
const file = path.join(__dirname, 'data.json');

const hostname = 'localhost';

const server = {

  /** @type {String} - The hostname of the gun server. */
  hostname: hostname,

  /** @type {Number} - The server port number. */
  port: port === 8080 ? 3000 : 8080,

  /** @type {String} - Where to save the data. */
  file: file,

  /** @type {String} - An html page browsers should load. */
  html: path.join(__dirname, 'test/index.html'),

  /** @type {String} - The absolute path to gun. */
  gun: require.resolve('gun'),

};

/** @type {String} - The full server url, as seen from browsers. */
server.url = `http://${server.hostname}:${server.port}`;

const browser = {

  /** @type {String} - The URL for browsers to load. */
  page: `http://${server.hostname}:${server.port}/index.html`,

  /** @type {String[]} - The browsers to create. */
  types: Array(0).fill({
    browserName: 'phantomjs',
  }),

  /** @type {String} - The key gun should use. */
  key: Math.random().toString(36).slice(2),
};

module.exports = {

  /** @type {Manager} - A panic manager instance. */
  manager: Manager(),

  /** @type {Number} - The port to start panic on. */
  port: port,

  /** @type {String} - The external URL of the panic server. */
  panic: `http://${hostname}:${port}`,

  /** @type {Object} - Settings for the gun server child process. */
  server: server,

  /** @type {Object} - Configuration for the browsers. */
  browser: browser,

};
