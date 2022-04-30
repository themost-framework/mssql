// MOST Web Framework Codename Zero Gravity Copyright (c) 2017-2022, THEMOST LP All rights reserved
import { MSSqlFormatter } from './MSSqlFormatter';
import { MSSqlAdapter } from './MSSqlAdapter';

/**
 * Creates an instance of MSSqlAdapter object that represents a MSSQL database connection.
 * @param {*} options An object that represents the properties of the underlying database connection.
 * @returns {MSSqlAdapter}
 */
function createInstance(options) {
    return new MSSqlAdapter(options);
}

export {
    createInstance,
    MSSqlFormatter,
    MSSqlAdapter
};
