# @themost/mssql
Most Web Framework MSSQL Adapter

## Install
    npm install @themost/mssql
## Usage
Register MSSQL adapter on app.json as follows:

    "adapterTypes": [
        ...
        { "name":"MSSQL Data Adapter", "invariantName": "mssql", "type":"@themost/mssql" }
        ...
    ],
    adapters: [
        ...
        { "name":"development", "invariantName":"mssql", "default":true,
            "options": {
              "server":"localhost",
              "user":"user",
              "password":"password",
              "database":"test"
            }
        }
        ...
    ]

If you are intended to use MSSQL data adapter as the default database adapter set the property "default" to true.

### Transaction Isolation Level

Transaction isolation level controls the locking and row versioning behavior of Transact-SQL statements issued by a connection to SQL Server.

```sql
SET TRANSACTION ISOLATION LEVEL
    { READ UNCOMMITTED
    | READ COMMITTED
    | REPEATABLE READ
    | SNAPSHOT
    | SERIALIZABLE
    }
```

[https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql?view=sql-server-ver16](https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql?view=sql-server-ver16)

Use `options/transactionIsolationLevel` and define transaction isolation level:

```json
{
    "name":"development",
    "invariantName":"mssql",
    "default":true,
    "options": {
        "server":"localhost",
        "user":"user",
        "password":"password",
        "database":"test",
        "options": {
            "transactionIsolationLevel": "readCommitted"
        }
    }
}
```
The possible values are `readUncommitted` | `readCommitted` | `repeatableRead` | `snapshot` | `serializable`

## Development
`themost-mssql` is a sub-module of [ Most Web Framework data adapters project](https://github.com/themost-framework/themost-adapters)

So, checkout parent project

    git checkout (https://github.com/themost-framework/themost-adapters.git

