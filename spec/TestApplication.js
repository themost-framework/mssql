import {DataApplication, DataConfigurationStrategy, NamedDataContext} from '@themost/data';
import { createInstance } from '@themost/mssql';
import { QueryExpression } from '@themost/query';
const testConnectionOptions = {
    'server': process.env.MSSQL_SERVER,
    'port': parseInt(process.env.MSSQL_SERVER_PORT, 10),
    'user': process.env.MSSQL_USER,
    'password': process.env.MSSQL_PASSWORD,
    'database': process.env.MSSQL_DB
};

const masterConnectionOptions = {
    'server': process.env.MSSQL_SERVER,
    'port': parseInt(process.env.MSSQL_SERVER_PORT, 10),
    'user': process.env.MSSQL_USER,
    'password': process.env.MSSQL_PASSWORD,
    'database': 'master'
};

class TestApplication extends DataApplication {
    constructor(cwd) {
        super(cwd);
        const dataConfiguration = this.configuration.getStrategy(DataConfigurationStrategy);
        // add adapter type
        const name = 'MSSQL Data Adapter';
        const invariantName = 'mssql';
        Object.assign(dataConfiguration.adapterTypes, {
            mssql: {
                name,
                invariantName,
                createInstance
            }
        });
        dataConfiguration.adapters.push({
            name: 'master',
            invariantName: 'mssql',
            default: false,
            options: masterConnectionOptions
        });
        dataConfiguration.adapters.push({
            name: 'test',
            invariantName: 'mssql',
            default: true,
            options: testConnectionOptions
        });
    }
    async tryCreateDatabase() {
        let context = new NamedDataContext('master');
        context.getConfiguration = () => {
            return this.configuration;
        };
        const query = new QueryExpression().from('sys.databases').select('database_id', 'name').where('name').equal(testConnectionOptions.database);
        const res = await context.db.executeAsync(query);
        if (res.length === 0) {
            await context.db.executeAsync(`CREATE DATABASE ${testConnectionOptions.database};`);
        }
        await context.db.closeAsync();
    }

}

export {
    TestApplication
}