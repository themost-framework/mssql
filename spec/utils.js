const { MSSqlAdapter, createInstance } = require('../index');
const { QueryExpression } = require('@themost/query')
const util = require('util');
// get options from environmet for testing
const testConnectionOptions = {
    "server": process.env.DB_HOST,
    "port": process.env.DB_PORT,
    "user": process.env.DB_USER,
    "password": process.env.DB_PASSWORD,
    "database": "test_themost_dev",
    "options": {
        "transactionIsolationLevel": "readCommitted"
    }
};

// get options from environmet for testing
const masterConnectionOptions = {
    "server": process.env.DB_HOST,
    "port": process.env.DB_PORT,
    "user": process.env.DB_USER,
    "password": process.env.DB_PASSWORD,
    "database": "master"
};

const BIN_TO_UUID = `
CREATE
  FUNCTION dbo.BIN_TO_UUID(@bin BINARY(16))
  RETURNS VARCHAR(36)
  AS
  BEGIN
    IF @bin IS NULL RETURN NULL;
    declare @uuid VARCHAR(32)
    SET @uuid = CONVERT(VARCHAR(32), @bin, 2)
    RETURN CONCAT(
    SUBSTRING(@uuid, 1, 8), '-',
    SUBSTRING(@uuid, 9, 4), '-',
    SUBSTRING(@uuid, 13, 4), '-',
    SUBSTRING(@uuid, 17, 4), '-',
    SUBSTRING(@uuid, 21, 12)
    )
END
`

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
        const db = new MSSqlAdapter(testConnectionOptions);
        await db.executeAsync(BIN_TO_UUID);
        await db.closeAsync();
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
        await adapter.executeAsync(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE`);
        await adapter.executeAsync(`DROP DATABASE [${database}];`);
    }
    await adapter.closeAsync();
}

module.exports = {
    tryCreateTestDatabase,
    tryDropTestDatabase,
    masterConnectionOptions,
    testConnectionOptions
}