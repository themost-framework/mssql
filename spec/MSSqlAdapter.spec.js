const {MSSqlAdapter, createInstance} = require('../index');
const util = require('util');
// get options from environmet for testing
const testConnectionOptions = {
    "server": process.env.MSSQL_SERVER,
    "port": process.env.MSSQL_SERVER_PORT,
    "user": process.env.MSSQL_USER,
    "password": process.env.MSSQL_PASSWORD,
    "database": "master"
};

describe('MSSqlFormatter', () => {

    it('should create instance', async () => {
        const adapter = new MSSqlAdapter();
        expect(adapter).toBeTruthy();
    });

    it('should use createInstance()', async () => {
        const adapter = createInstance();
        expect(adapter).toBeTruthy();
        expect(adapter).toBeInstanceOf(MSSqlAdapter);
    });

    it('should use MSSqlAdapter.open()', async () => {
        /**
         * @type {MSSqlAdapter}
         */
        const adapter = createInstance(testConnectionOptions);
        await adapter.openAsync();
        expect(adapter.rawConnection).toBeTruthy();
        await adapter.closeAsync();
        expect(adapter.rawConnection).toBeFalsy();
    });

    it('should use MSSqlAdapter.close()', async () => {
        /**
         * @type {MSSqlAdapter}
         */
        const adapter = createInstance(testConnectionOptions);
        await adapter.openAsync();
        await adapter.closeAsync();
        expect(adapter.rawConnection).toBeFalsy();
    });

});