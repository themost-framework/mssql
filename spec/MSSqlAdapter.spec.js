import { MSSqlAdapter, createInstance } from '@themost/mssql';
import { QueryExpression } from '@themost/query';
// get options from environment for testing
const testConnectionOptions = {
    'server': process.env.MSSQL_SERVER,
    'port': parseInt(process.env.MSSQL_SERVER_PORT, 10),
    'user': process.env.MSSQL_USER,
    'password': process.env.MSSQL_PASSWORD,
    'database': process.env.MSSQL_DB
};

// get options from environment for testing
const masterConnectionOptions = {
    'server': process.env.MSSQL_SERVER,
    'port': parseInt(process.env.MSSQL_SERVER_PORT, 10),
    'user': process.env.MSSQL_USER,
    'password': process.env.MSSQL_PASSWORD,
    'database': 'master'
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

    it('should query database', async () => {
        // validate and create database
        /**
         * @type {MSSqlAdapter}
         */
        const adapter = createInstance(masterConnectionOptions);
        const query = new QueryExpression().from('sys.databases').select('database_id', 'name').where('name').equal(testConnectionOptions.database);
        const res = await adapter.executeAsync(query);
        expect(res).toBeInstanceOf(Array);
        expect(res.length).toBeLessThanOrEqual(1);
        await adapter.closeAsync();
    });

    it('should use database(string).exists()', async () => {
        const adapter = new MSSqlAdapter(masterConnectionOptions);
        let exists = await adapter.database(testConnectionOptions.database).existsAsync();
        expect(exists).toBeTrue();
        exists = await adapter.database('other_database').existsAsync();
        expect(exists).toBeFalse();
        await adapter.closeAsync();
    });

    it('should use database(string).create()', async () => {
        const adapter = new MSSqlAdapter(masterConnectionOptions);
        await adapter.database('test_create_a_database').createAsync();
        let exists = await adapter.database('test_create_a_database').existsAsync();
        expect(exists).toBeTrue();
        await adapter.executeAsync('DROP DATABASE test_create_a_database;');
        exists = await adapter.database('test_create_a_database').existsAsync();
        expect(exists).toBeFalse();
        await adapter.closeAsync();
    });

});