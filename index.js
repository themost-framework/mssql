/**
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2014-2020, THEMOST LP themost-framework@themost.io
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */
const {MSSqlFormatter} = require('./MSSqlFormatter');
const {MSSqlAdapter} = require('./MSSqlAdapter');

/**
 * Creates an instance of MSSqlAdapter object that represents a MSSQL database connection.
 * @param {*} options An object that represents the properties of the underlying database connection.
 * @returns {MSSqlAdapter}
 */
function createInstance(options) {
    return new MSSqlAdapter(options);
}

module.exports = {
    createInstance,
    MSSqlFormatter,
    MSSqlAdapter
};
