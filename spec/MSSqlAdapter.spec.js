const {MSSqlAdapter, createInstance} = require('../index');
const { QueryExpression }  = require('@themost/query')
const util = require('util');
// get options from environmet for testing
const testConnectionOptions = {
    "server": process.env.MSSQL_SERVER,
    "port": process.env.MSSQL_SERVER_PORT,
    "user": process.env.MSSQL_USER,
    "password": process.env.MSSQL_PASSWORD,
    "database": "test"
};

// get options from environmet for testing
const masterConnectionOptions = {
    "server": process.env.MSSQL_SERVER,
    "port": process.env.MSSQL_SERVER_PORT,
    "user": process.env.MSSQL_USER,
    "password": process.env.MSSQL_PASSWORD,
    "database": "master"
};

async function tryCreateTestDatabase() {
    /**
     * @type {MSSqlAdapter}
     */
    let adapter = new MSSqlAdapter(masterConnectionOptions);
    let database = 'test';
    const query = new QueryExpression().from('sys.databases').select('database_id', 'name').where('name').equal(database);
    const res = await adapter.executeAsync(query);
    if (res.length === 0) {
        await adapter.executeAsync(`CREATE DATABASE ${database};`);
    }
    await adapter.closeAsync();
}

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

    it('should use open()', async () => {
        /**
         * @type {MSSqlAdapter}
         */
        const adapter = createInstance(masterConnectionOptions);
        await adapter.openAsync();
        expect(adapter.rawConnection).toBeTruthy();
        await adapter.closeAsync();
        expect(adapter.rawConnection).toBeFalsy();
    });

    it('should use close()', async () => {
        /**
         * @type {MSSqlAdapter}
         */
        const adapter = createInstance(masterConnectionOptions);
        await adapter.openAsync();
        await adapter.closeAsync();
        expect(adapter.rawConnection).toBeFalsy();
    });

    it('should validate database', async () => {
        // validate and create database

        /**
         * @type {MSSqlAdapter}
         */
        const adapter = createInstance(masterConnectionOptions);
        const query = new QueryExpression().from('sys.databases').select('database_id', 'name').where('name').equal('test');
        const res = await adapter.executeAsync(query);
        expect(res).toBeInstanceOf(Array);
        expect(res.length).toBeLessThanOrEqual(1);
        await adapter.closeAsync();
    });

    it('should create database', async () => {
        // validate and create database

        /**
         * @type {MSSqlAdapter}
         */
        const adapter = new MSSqlAdapter(masterConnectionOptions);
        const query = new QueryExpression().from('sys.databases').select('database_id', 'name').where('name').equal('test');
        const res = await adapter.executeAsync(query);
        if (res.length === 0) {
            await adapter.executeAsync('CREATE DATABASE test;');
        }
        await adapter.closeAsync();
    });

    it('should use migrate()', async () => {
        await tryCreateTestDatabase();
        const adapter = new MSSqlAdapter(testConnectionOptions);
        
    });

    it('should use database(string).exists()', async () => {
        tryCreateTestDatabase();
        const adapter = new MSSqlAdapter(testConnectionOptions);
        let exists = await adapter.database(testConnectionOptions.database).existsAsync();
        expect(exists).toBeTrue();
        exists = await adapter.database('other_database').existsAsync();
        expect(exists).toBeFalse();
        await adapter.closeAsync();
    });

    it('should use database(string).create()', async () => {
        const adapter = new MSSqlAdapter(testConnectionOptions);
        await adapter.database('test_create_a_database').createAsync();
        let exists = await adapter.database('test_create_a_database').existsAsync();
        expect(exists).toBeTrue();
        await adapter.executeAsync('DROP DATABASE test_create_a_database;');
        exists = await adapter.database('test_create_a_database').existsAsync();
        expect(exists).toBeFalse();
        await adapter.closeAsync();
    });

});