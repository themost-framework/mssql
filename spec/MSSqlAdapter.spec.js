const {MSSqlAdapter, createInstance} = require('../index');
const { QueryExpression }  = require('@themost/query')
const util = require('util');
const ProductModel = require('./config/models/Product.json');
const EmployeeModel = require('./config/models/Employee.json');
// get options from environmet for testing
const testConnectionOptions = {
    "server": process.env.MSSQL_SERVER,
    "port": process.env.MSSQL_SERVER_PORT,
    "user": process.env.MSSQL_USER,
    "password": process.env.MSSQL_PASSWORD,
    "database": "test_themost_dev"
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
    let database = testConnectionOptions.database;
    const query = new QueryExpression().from('sys.databases').select('database_id', 'name').where('name').equal(database);
    const res = await adapter.executeAsync(query);
    if (res.length === 0) {
        await adapter.executeAsync(`CREATE DATABASE ${database};`);
    }
    await adapter.closeAsync();
}

async function tryDropTestDatabase() {
    /**
     * @type {MSSqlAdapter}
     */
    let adapter = new MSSqlAdapter(masterConnectionOptions);
    let database = testConnectionOptions.database;
    const query = new QueryExpression().from('sys.databases').select('database_id', 'name').where('name').equal(database);
    const res = await adapter.executeAsync(query);
    if (res.length === 1) {
        await adapter.executeAsync(`DROP DATABASE ${database};`);
    }
    await adapter.closeAsync();
}

describe('MSSqlFormatter', () => {

    beforeAll( async () => {
        await tryCreateTestDatabase();
    });
    afterAll( async () => {
        await tryDropTestDatabase();
    });

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

    it('should use database(string).exists()', async () => {
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

    it('should use migrate()', async () => {
        const adapter = new MSSqlAdapter(testConnectionOptions);
    });

    it('should use database(string).exists()', async () => {
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

    it('should use table(string).exists()', async () => {
        const adapter = new MSSqlAdapter(testConnectionOptions);
        let exists = await adapter.table(ProductModel.source).existsAsync();
        if (exists === false) {
            await adapter.table(ProductModel.source).create(ProductModel.fields);
        }
        exists = await adapter.table(ProductModel.source).existsAsync();
        expect(exists).toBeTrue();
        // drop table by executing SQL
        await adapter.executeAsync(`DROP TABLE [${ProductModel.source}];`);
        exists = await adapter.table(ProductModel.source).existsAsync();
        expect(exists).toBeFalse();
        await adapter.closeAsync();
    });

    it('should use table(string).create()', async () => {
        const adapter = new MSSqlAdapter(testConnectionOptions);
        let exists = await adapter.table(ProductModel.source).existsAsync();
        if (exists === true) {
            // drop table
            await adapter.executeAsync(`DROP TABLE [${ProductModel.source}];`);
        }
        await adapter.table(ProductModel.source).create(ProductModel.fields);
        exists = await adapter.table(ProductModel.source).existsAsync();
        expect(exists).toBeTrue();
        // drop table
        await adapter.executeAsync(`DROP TABLE [${ProductModel.source}];`);
        await adapter.closeAsync();
    });

    it('should use execute() for insert', async () => {
        const adapter = new MSSqlAdapter(testConnectionOptions);
        let exists = await adapter.table(EmployeeModel.source).existsAsync();
        if (exists === false) {
            await adapter.table(EmployeeModel.source).create(EmployeeModel.fields);
        }
        const sources = EmployeeModel.seed.map( item => {
            return new QueryExpression().insert(item).into(EmployeeModel.source);
        }).map( query => {
            return adapter.executeAsync(query);
        });
        await Promise.all(sources);
        const query = new QueryExpression().from(EmployeeModel.source)
            .where('LastName').equal('Davolio')
            .select('*');
        let res = await adapter.executeAsync(query);
        expect(res).toBeInstanceOf(Array);
        expect(res.length).toBe(1);
        expect(res[0].LastName).toBe('Davolio')
        // drop table
        await adapter.executeAsync(`DROP TABLE [${EmployeeModel.source}];`);
        await adapter.closeAsync();
    });

    it('should use execute() for update', async () => {
        const adapter = new MSSqlAdapter(testConnectionOptions);
        let exists = await adapter.table(EmployeeModel.source).existsAsync();
        if (exists === false) {
            await adapter.table(EmployeeModel.source).create(EmployeeModel.fields);
        }
        const sources = EmployeeModel.seed.map( item => {
            return new QueryExpression().insert(item).into(EmployeeModel.source);
        }).map( query => {
            return adapter.executeAsync(query);
        });
        await Promise.all(sources);
        const updateQuery = new QueryExpression().update(EmployeeModel.source)
            .set({
                LastName: 'Davolio-Arnold'
            })
            .where('LastName').equal('Davolio');
        await adapter.executeAsync(updateQuery);
        const query = new QueryExpression().from(EmployeeModel.source)
        .where('LastName').equal('Davolio-Arnold')
        .select('*');
        let res = await adapter.executeAsync(query);
        expect(res).toBeInstanceOf(Array);
        expect(res.length).toBe(1);
        expect(res[0].LastName).toBe('Davolio-Arnold');
        // drop table
        await adapter.executeAsync(`DROP TABLE [${EmployeeModel.source}];`);
        await adapter.closeAsync();
    });

});