import {DataApplication, DataConfigurationStrategy} from '@themost/data';
import { createInstance } from '../index';
const testConnectionOptions = {
    'server': process.env.MSSQL_SERVER,
    'port': parseInt(process.env.MSSQL_SERVER_PORT, 10),
    'user': process.env.MSSQL_USER,
    'password': process.env.MSSQL_PASSWORD,
    'database': process.env.MSSQL_DB
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
            name: 'test',
            invariantName: 'mssql',
            default: true,
            options: testConnectionOptions
        });
    }
}

export {
    TestApplication
}