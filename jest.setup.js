require('dotenv').config();
const { JsonLogger } = require('@themost/json-logger');
const { TraceUtils } = require('@themost/common');
process.env.NODE_ENV = 'development';
TraceUtils.useLogger(new JsonLogger({
    logLevel: 'debug',
    format: 'raw'
}));
/* global jest */
jest.setTimeout(30000);