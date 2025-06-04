// MOST Web Framework Codename Zero Gravity Copyright (c) 2017-2022, THEMOST LP All rights reserved
import {ConnectionPool, Request, Transaction} from 'mssql';
import async from 'async';
import { sprintf } from 'sprintf-js';
import { TraceUtils } from '@themost/common';
import { SqlUtils } from '@themost/query';
import { MSSqlFormatter } from './MSSqlFormatter';
import { TransactionIsolationLevelFormatter } from './TransactionIsolationLevel';
import { AsyncSeriesEventEmitter, before, after } from '@themost/events';
import { Guid } from '@themost/common';
import merge from 'lodash/merge';

/**
 *
 * @param {{target: SqliteAdapter, query: string|QueryExpression, results: Array<*>}} event
 */
function onReceivingJsonObject(event) {
    if (typeof event.query === 'object' && event.query.$select) {
        // try to identify the usage of a $jsonObject dialect and format result as JSON
        const { $select: select } = event.query;
        if (select) {
            const attrs = Object.keys(select).reduce((previous, current) => {
                const fields = select[current];
                previous.push(...fields);
                return previous;
            }, []).filter((x) => {
                const [key] = Object.keys(x);
                if (typeof key !== 'string') {
                    return false;
                }
                return x[key].$jsonObject != null || x[key].$jsonArray != null  || x[key].$jsonGroupArray != null;
            }).map((x) => {
                return Object.keys(x)[0];
            });
            if (attrs.length > 0) {
                if (Array.isArray(event.results)) {
                    for(const result of event.results) {
                        attrs.forEach((attr) => {
                            if (Object.prototype.hasOwnProperty.call(result, attr) && typeof result[attr] === 'string') {
                                    result[attr] = JSON.parse(result[attr]);
                            }
                        });
                    }
                }
            }
        }
    }
}

class ConnectionStateError extends Error {
    constructor() {
        super('The connection has an invalid state. It seems that the current operation was cancelled by the user or the socket has been closed.');
        this.name = 'ConnectionStateError';
    }
}

/**
 * @type {Map<string, ConnectionPool>}
 */
const pools = new Map();

class MSSqlConnectionPoolManager {

    /**
     * @type {Map<string, ConnectionPool>}
     */
    get pools() {
        return pools;
    }

    /**
     * Gets a connection pool for the given connection options
     * @param {*} connectionOptions 
     * @returns Promise<ConnectionPool>
     */
    async getAsync(connectionOptions) {
        return new Promise((resolve, reject) => {
                return this.get(connectionOptions, (err, pool) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(pool);
            });
        });
    }

    /**
     * 
     * @param {*} connectOptions 
     * @param {function(err: Error=, pool: ConnectionPool)} callback 
     * @returns 
     */
    get(connectOptions, callback) {
        if (connectOptions.id == null) {
            return callback(new Error('Invalid connection options. The configuration is missing a unique identifier'));
        }
        const key = connectOptions.id;
        if (pools.has(key)) {
            return callback(null, pools.get(key));
        }
        const pool = new ConnectionPool(connectOptions);
        const close = pool.close.bind(pool);
        pool.close = (...args) => {
            pools.delete(key);
            return close(...args);
        }
        pool.connect((err) => {
            if (err) {
                return callback(err);
            }
            pools.set(key, pool);
            return callback(null, pool);
        });
    }

    /**
     * Finalizes all connection pools
     * @param {function(err: Error=)} callback 
     */
    finalize(callback) {
        async.each(pools.values(), (pool, cb) => {
            pool.close(cb);
        }, (err) => {
            pools.clear();
            if (typeof callback === 'function') {
                return callback(err);
            }
        });
    }

    /**
     * Finalizes all connection pools
     * @returns Promise<void>
     */
    async finalizeAsync() {
        return new Promise((resolve, reject) => {
            this.finalize((err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }

}

class RetryQuery {
    /**
     * Creates a new instance of RetryQuery
     * @param {string|import('@themost/query').QueryExpression} query 
     * @param {number=} retry 
     */
    constructor(query, retry) {
        /**
         * Gets or sets the query to be retried
         * @type {string|import('@themost/query').QueryExpression}
         */
        this.query = query;
        /**
         * Gets or sets the retry count
         * @type {number}
         */
        this.retry = retry || 0;
    }
}

/**
 * @class
 */
class MSSqlAdapter {

    /**
     * @constructor
     * @param {*} options
     */
    constructor(options) {
        /**
         * @private
         * @type {ConnectionPool}
         */
        this.rawConnection = null;
        /**
         * Gets or sets database connection string
         * @type {*}
         */
        this.options = options;
        /**
         * Gets or sets a boolean that indicates whether connection pooling is enabled or not.
         * @type {boolean}
         */
        this.connectionPooling = false;
        const self = this;

        // get retry options
        if (typeof this.options.retry === 'undefined') {
            this.options.retry = 4;
            this.options.retryInterval = 1000;
        }

        /**
         * Gets connection string from options.
         * @type {string}
         */
        Object.defineProperty(this, 'connectionString', {
            get: function () {
                const keys = Object.keys(self.options);
                return keys.map(function (x) {
                    return x.concat('=', self.options[x]);
                }).join(';');
            }, configurable: false, enumerable: false
        });
        this.id = Guid.from(this.connectionString).toString();
        this.executing = new AsyncSeriesEventEmitter();
        this.executed = new AsyncSeriesEventEmitter();
        this.executed.subscribe(onReceivingJsonObject);
        this.committed = new AsyncSeriesEventEmitter();
        this.rollbacked = new AsyncSeriesEventEmitter();

    }
    prepare(query, values) {
        return SqlUtils.format(query, values);
    }
    /**
     * Opens database connection
     */
    open(callback) {
        callback = callback || function () { };
        const self = this;
        if (self.rawConnection) {
            return callback();
        }
        // important note: validate the connection state against transaction state
        // if the connection is closed and a transaction is still active then throw error
        if (self.disposed === true) {
            TraceUtils.debug('The connection has been already closed.');
            return callback(new ConnectionStateError());
        }
        TraceUtils.debug('Opening database connection');
        // clone connection options
        const connectionOptions = merge({
            id: this.id,
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        }, self.options);
        // create connection
        //let callbackAlreadyCalled = false;
        const connectionManager = new MSSqlConnectionPoolManager();
        let transactionIsolationLevel = null;
        if (connectionOptions && connectionOptions.options) {
            if (Object.prototype.hasOwnProperty.call(connectionOptions.options, 'transactionIsolationLevel')) {
                const level = connectionOptions.options.transactionIsolationLevel;
                transactionIsolationLevel = new TransactionIsolationLevelFormatter().format(level);
            }
        }
         connectionManager.get(connectionOptions, function(err, connection) {
            //callbackAlreadyCalled = true;
            if (err) {
                // destroy connection
                self.rawConnection = null;
                TraceUtils.error('An error occurred while connecting to database server');
                TraceUtils.error(err);
                return callback(err);
            }
            // set connection
            self.rawConnection = connection;
            if (transactionIsolationLevel == null) {
                return callback();
            }
            return self.execute(transactionIsolationLevel, [], function(err) {
                if (err) {
                    return callback(err);
                }
                return callback();
            });
        });
    }
    /**
     * Opens a database connection
     */
    openAsync() {
        return new Promise((resolve, reject) => {
            return this.open(err => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }
    /**
     * 
     * @param {Function=} callback 
     */
    close(callback) {
        const self = this;
        if (self.rawConnection != null) {
            TraceUtils.debug('Closing database connection');
        }
        self.rawConnection = null;
        // auto-rollback transaction
        /**
         * @type {Transaction}
         */
        const transaction = self.transaction;
        if (transaction != null) {
            TraceUtils.warn('A connection is being closed while a transaction is still active. The transaction will be rolled back.');
            // if transaction has an active request, transaction rollback is disabled
            if (transaction._activeRequest) {
                // exit callback
                return callback();
            }
            TraceUtils.debug('MSSqlAdapter.close()', 'Rolling back transaction');
            // otherwise, rollback transaction
            try {
                return transaction.rollback(function(err) {                
                    if (err) {
                        TraceUtils.error('An error occurred while rolling back the transaction.');
                        TraceUtils.error(err);
                    }
                    return callback();
                });
            } catch (err) {
                return callback(err);
            } finally {
                self.transaction = null;
                TraceUtils.debug('MSSqlAdapter.close()', 'Transaction has been destroyed');
            }
        }
        // close connection and return
        return callback();
    }
    /**
     * Closes the current database connection
     */
    closeAsync() {
        return new Promise((resolve, reject) => {
            return this.close(err => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }
    /**
     * Begins a data transaction and executes the given function
     * @param fn {Function}
     * @param callback {Function}
     */
    executeInTransaction(fn, callback) {
        const self = this;
        //ensure callback
        callback = callback || function () {
        };
        //ensure that database connection is open
        if (self.disposed === true) {
            if (self.transaction) {
                try {
                    return self.transaction.rollback(function(rollbackErr) {
                        if (rollbackErr) {
                            return callback(rollbackErr);
                        }
                        TraceUtils.debug('Transaction has been rolled back');
                        return callback(new ConnectionStateError());
                    });
                } catch(err) {
                    return callback(err);
                } finally {
                    self.transaction = null;
                    TraceUtils.debug('MSSqlAdapter.executeInTransaction()', 'Transaction has been destroyed');
                }
            }
            return callback(new ConnectionStateError());
        }
        self.open(function (err) {
            if (err) {
                callback.call(self, err);
                return;
            }
            //check if transaction is already defined (as object)
            if (self.transaction) {
                //so invoke method
                fn.call(self, function (err) {
                    //call callback
                    callback.call(self, err);
                });
            }
            else {
                //create transaction
                self.transaction = new Transaction(self.rawConnection);
                //begin transaction
                TraceUtils.debug('MSSqlAdapter.executeInTransaction()', 'Beginning transaction');
                self.transaction.begin(function (err) {
                    //error check (?)
                    let rolledBack = false;
                    if (self.transaction) {
                        self.transaction.on('rollback', (aborted) => {
                            TraceUtils.debug('transaction.on("rollback")', 'Transaction has been rolled back');
                            rolledBack = true;
                        });
                    }
                    if (err) {
                        TraceUtils.error(err);
                        return callback(err);
                    }
                    else {
                        try {
                            fn.call(self, function (err) {
                                try {
                                    if (err) {
                                        if (self.transaction) {
                                            if (rolledBack) {
                                                TraceUtils.warn('The transaction has been already rolled back. The operation will exit with error.');
                                                return callback(err);
                                            }
                                            TraceUtils.debug('MSSqlAdapter.executeInTransaction()', 'Rolling back transaction');
                                            try {
                                                return self.transaction.rollback(function(rollbackErr) {
                                                    if (rollbackErr) {
                                                        return callback(rollbackErr);
                                                    }
                                                    TraceUtils.debug('MSSqlAdapter.executeInTransaction()', 'Transaction has been rolled back');
                                                    return callback(err);
                                                });
                                            } catch (err) {
                                                return callback(err);
                                            } finally {
                                                self.transaction = null;
                                                TraceUtils.debug('MSSqlAdapter.executeInTransaction()', 'Transaction has been destroyed');
                                            }
                                        }
                                        return callback(err);
                                    }
                                    else {
                                        if (typeof self.transaction === 'undefined' || self.transaction === null) {
                                            return callback(new Error('Database transaction cannot be empty on commit.'));
                                        }
                                        TraceUtils.debug('MSSqlAdapter.executeInTransaction()', 'Committing transaction');
                                        return self.transaction.commit(function (err) {
                                            if (err) {
                                                TraceUtils.debug('An error occurred while committing the transaction');
                                                try {
                                                    return self.transaction.rollback(function(rollbackErr) {
                                                        if (rollbackErr) {
                                                            return callback(rollbackErr);
                                                        }
                                                        TraceUtils.debug('MSSqlAdapter.executeInTransaction()', 'Transaction has been rolled back');
                                                        return callback(err);
                                                    });
                                                } catch (err) {
                                                    return callback(err);
                                                } finally {
                                                    self.transaction = null;
                                                    TraceUtils.debug('MSSqlAdapter.executeInTransaction()', 'Transaction has been destroyed');
                                                }
                                            }
                                            self.transaction = null;
                                            return self.committed.emit({
                                                target: self
                                            }).then(() => {
                                                return callback();
                                            }).catch((err) => {
                                                return callback(err);
                                            });
                                            
                                        });
                                    }
                                }
                                catch (e) {
                                    return callback(e);
                                }
                            });
                        }
                        catch (e) {
                            return callback(e);
                        }
                    }
                });
                
            }
        });
    }
    /**
     * Begins a data transaction and executes the given function
     * @param func {Function}
     */
    executeInTransactionAsync(func) {
        return new Promise((resolve, reject) => {
            return this.executeInTransaction((callback) => {
                return func.call(this).then(res => {
                    return callback(null, res);
                }).catch(err => {
                    return callback(err);
                });
            }, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }

    /**
     * Produces a new identity value for the given entity and attribute.
     * @param entity {String} The target entity name
     * @param attribute {String} The target attribute
     * @param callback {Function}
     */
    selectIdentity(entity, attribute, callback) {
        // create a dedicated connection or use current connection if transaction is empty
        const db = this;
        const sequenceName = `${entity}_${attribute}_seq`;
        /**
         * @type {MSSqlFormatter}
         */
        const formatter = db.getFormatter();
        const nextValueSql = `SELECT NEXT VALUE FOR ${formatter.escapeName(sequenceName)} AS [value];`;
        // get max value for the given entity and attribute if sequence does not exist
        return db.executeAsync(`
IF NOT EXISTS (SELECT * FROM [sysobjects] WHERE [name] = ${formatter.escape(sequenceName)} AND [type] = 'SO')
    SELECT ISNULL(MAX(${formatter.escapeName(attribute)}), 1) AS [value] FROM ${formatter.escapeName(entity)};`, null).then((results) => {
            // if sequence exists then get next value without trying to create sequence
            // because it has been already created (in that case, results will be empty)
            if (results && results.length === 0) {
                return db.executeAsync(nextValueSql, null).then(([result]) => {
                    // return result[0]
                    return callback(null, parseInt(result.value, 10));
                });
            }
            const startValue = (results && results.length > 0) ? results[0].value : 1;
            // create sequence if it does not exist
                    return db.executeAsync(`
IF NOT EXISTS (SELECT * FROM [sysobjects] WHERE [name] = ${formatter.escape(sequenceName)} AND [type] = 'SO')
    CREATE SEQUENCE ${formatter.escapeName(sequenceName)} START WITH ${startValue} INCREMENT BY 1;`, null).then(() => {
                        // get next value for sequence
                        return db.executeAsync(nextValueSql, null).then(([result]) => {
                            // return result[0]
                            return callback(null, parseInt(result.value, 10));
                        });
                    });
            }).catch((err) => {
                return callback(err);
            });
    }

    /**
     * @param {string} entity 
     * @param {string} attribute 
     * @returns Promise<any>
     */
     selectIdentityAsync(entity, attribute) {
        return new Promise((resolve, reject) => {
            return this.selectIdentity(entity, attribute, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }

    @after(({target, args, result: results}, callback) => {
        const [query, params] = args;
        const event = {
            target,
            query,
            params,
            results
        };
        void target.executed.emit(event).then(() => {
            return callback(null, {
                value: results
            });
        }).catch((err) => {
            return callback(err);
        });
    })
    @before(({target, args}, callback) => {
        const [query, params] = args;
        void target.executing.emit({
            target,
            query,
            params
        }).then(() => {
            return callback();
        }).catch((err) => {
            return callback(err);
        });
    })
    /**
     * @param {*} query
     * @param {*} values
     * @param {function} callback
     */
    execute(query, values, callback) {
        const self = this;
        let sql = null;
        try {
            if (typeof query === 'string') {
                //get raw sql statement
                sql = query;
            }  else {
                //format query expression or any object that may act as query expression
                const formatter = new MSSqlFormatter();
                if (query instanceof RetryQuery) {
                    sql = typeof query.query === 'string' ? query.query : formatter.format(query.query);
                } else {
                    sql = formatter.format(query);
                }
            }
            //validate sql statement
            if (typeof sql !== 'string') {
                callback.call(self, new Error('The executing command is of the wrong type or empty.'));
                return;
            }
            if (self.disposed === true) {
                return callback(new ConnectionStateError());
            }
            //ensure connection
            self.open(function (err) {
                if (err) {
                    callback.call(self, err);
                }
                else {
                    // log statement (optional)
                    let startTime;
                    if (process.env.NODE_ENV === 'development') {
                        startTime = new Date().getTime();
                    }
                    // execute raw command
                    const request = self.transaction ? new Request(self.transaction) : new Request(self.rawConnection);
                    let preparedSql = self.prepare(sql, values);
                    if (typeof query.$insert !== 'undefined')
                        preparedSql += ';SELECT SCOPE_IDENTITY() as insertId';
                    request.query(preparedSql, function (err, result) {
                        if (err) {
                            if (err.code === 'ESOCKET' || err.code === 'ETIMEOUT') { // connection is closed or timeout
                                const shouldRetry = typeof self.options.retry === 'number' && self.options.retry > 0;
                                if (shouldRetry) {
                                    const retry = self.options.retry;
                                    let retryInterval = 1000;
                                    if (typeof self.options.retryInterval === 'number' && self.options.retryInterval > 0) {
                                        retryInterval = self.options.retryInterval;
                                    }
                                    const retryQuery = (query instanceof RetryQuery === false) ? new RetryQuery(query) : query;
                                    // validate retry option
                                    if (typeof retryQuery.retry === 'number' && retryQuery.retry >= (retry * retryInterval)) {
                                        // the retries have been exhausted
                                        delete retryQuery.retry;
                                        // trace error
                                        TraceUtils.error(`SQL (Execution Error):${err.message}, ${preparedSql}`);
                                        // return callback with error
                                        return callback(err);
                                    }
                                    // retry
                                    retryQuery.retry += retryInterval;
                                    TraceUtils.warn(`'SQL Error:${preparedSql}. Retrying in ${retryQuery.retry} ms.'`);
                                    return setTimeout(function () {
                                        return self.execute(retryQuery, values, callback);
                                    }, retryQuery.retry);
                                }
                            }
                            // otherwise, return callback with error
                            TraceUtils.error(`SQL (Execution Error):${err.message}, ${preparedSql}`);
                            return callback(err);
                        }
                        if (process.env.NODE_ENV === 'development') {
                            TraceUtils.debug(sprintf('SQL (Execution Time:%sms):%s, Parameters:%s', (new Date()).getTime() - startTime, sql, JSON.stringify(values)));
                        }
                        if (typeof query.$insert === 'undefined') {
                            if (result.recordsets.length === 1) {
                                return callback(err, Array.from(result.recordset));
                            }
                            return callback(err, result.recordsets.map(function(recordset) {
                                return Array.from(recordset);
                            }));
                        } else {
                            if (result && result.recordset) {
                                const insertId = result.recordset[0] && result.recordset[0].insertId;
                                if (insertId != null) {
                                    return callback(err, {
                                        insertId
                                    });
                                }
                            }
                            return callback(err, result);
                        }
                    });
                }
            });
        }
        catch (err) {
            callback.bind(self)(err);
        }
    }
    /**
     * @param query {*}
     * @param values {*}
     * @returns Promise<any>
     */
    executeAsync(query, values) {
        return new Promise((resolve, reject) => {
            return this.execute(query, values, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }

    /**
     * Formats an object based on the format string provided. Valid formats are:
     * %t : Formats a field and returns field type definition
     * %f : Formats a field and returns field name
     * @param format {string}
     * @param obj {*}
     */
    format(format, obj) {
        let result = format;
        if (/%t/.test(format))
            result = result.replace(/%t/g, this.formatType(obj));
        if (/%f/.test(format))
            result = result.replace(/%f/g, obj.name);
        return result;
    }

    /**
     * @deprecated
     * @param {string} format
     * @param {*} obj 
     */
    static format(format, obj) {
        new MSSqlAdapter().format(format, obj);
    }

    formatType(field) {
        const size = parseInt(field.size);
        const scale = parseInt(field.scale);
        let s = 'varchar(512) NULL';
        const type = field.type;
        switch (type) {
            case 'Boolean':
                s = 'bit';
                break;
            case 'Byte':
                s = 'tinyint';
                break;
            case 'Number':
            case 'Float':
                s = 'float';
                break;
            case 'Counter':
                return 'int IDENTITY (1,1) NOT NULL';
            case 'Currency':
                s = size > 0 ? (size <= 10 ? 'smallmoney' : 'money') : 'money';
                break;
            case 'Decimal':
                s = sprintf('decimal(%s,%s)', (size > 0 ? size : 19), (scale > 0 ? scale : 4));
                break;
            case 'Date':
                s = 'date';
                break;
            case 'DateTime':
                s = 'datetimeoffset';
                break;
            case 'Time':
                s = 'time';
                break;
            case 'Integer':
                s = 'int';
                break;
            case 'Duration':
                s = size > 0 ? sprintf('varchar(%s)', size) : 'varchar(48)';
                break;
            case 'URL':
                if (size > 0)
                    s = sprintf('varchar(%s)', size);
                else
                    s = 'varchar(512)';
                break;
            case 'Text':
                if (size > 0)
                    s = sprintf('varchar(%s)', size);
                else
                    s = 'varchar(512)';
                break;
            case 'Note':
                if (size > 0)
                    s = sprintf('varchar(%s)', size);
                else
                    s = 'text';
                break;
            case 'Json':
                s = 'nvarchar(max)';
                break;
            case 'Image':
            case 'Binary':
                s = 'binary';
                break;
            case 'Guid':
                s = 'varchar(36)';
                break;
            case 'Short':
                s = 'smallint';
                break;
            default:
                s = 'int';
                break;
        }
        s += field.nullable === undefined ? ' null' : field.nullable ? ' null' : ' not null';
        return s;
    }
    /**
     * @param {string} name
     * @param {QueryExpression} query
     * @param {Function} callback
     */

    /**
     * @deprecated
     * @param {*} field 
     */
    static formatType(field) {
        new MSSqlAdapter().formatType(field);
    }

    createView(name, query, callback) {
        return this.view(name).create(query, callback);
    }
    /**
     * Initializes database table helper.
     * @param {string} name - The table name
     * @returns {{exists: Function, version: Function, columns: Function, create: Function, add: Function, change: Function}}
     */
    table(name) {
        const self = this;
        let owner;
        let table;
        const matches = /(\w+)\.(\w+)/.exec(name);
        if (matches) {
            //get schema owner
            owner = matches[1];
            //get table name
            table = matches[2];
        }
        else {
            //get view name
            table = name;
            //get default owner
            owner = 'dbo';
        }
        return {
            /**
             * @param {Function} callback
             */
            exists: function (callback) {
                callback = callback || function () { };
                self.execute('SELECT COUNT(*) AS [count] FROM sysobjects WHERE [name]=? AND [type]=\'U\' AND SCHEMA_NAME([uid])=?', [table, owner], function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    callback(null, result[0].count === 1);
                });
            },
            existsAsync: function () {
                return new Promise((resolve, reject) => {
                    this.exists((err, value) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(value);
                    });
                });
            },
            /**
             * @param {function(Error,string=)} callback
             */
            version: function (callback) {
                callback = callback || function () { };
                self.execute('SELECT MAX([version]) AS [version] FROM [migrations] WHERE [appliesTo]=?', [table], function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    if (result.length === 0)
                        callback(null, '0.0');
                    else
                        callback(null, result[0].version || '0.0');
                });
            },
            versionAsync: function () {
                return new Promise((resolve, reject) => {
                    this.version((err, value) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(value);
                    });
                });
            },
            /**
             * @param {function(Error=,Array=)} callback
             */
            columns: function (callback) {
                callback = callback || function () { };
                self.execute('SELECT c0.[name] AS [name], c0.[isnullable] AS [nullable], c0.[length] AS [size], c0.[prec] AS [precision], ' +
                    'c0.[scale] AS [scale], t0.[name] AS type, t0.[name] + CASE WHEN t0.[variable]=0 THEN \'\' ELSE \'(\' + CONVERT(varchar,c0.[length]) + \')\' END AS [type1], ' +
                    'CASE WHEN p0.[indid]>0 THEN 1 ELSE 0 END [primary] FROM syscolumns c0  INNER JOIN systypes t0 ON c0.[xusertype] = t0.[xusertype] ' +
                    'INNER JOIN  sysobjects s0 ON c0.[id]=s0.[id]  LEFT JOIN (SELECT k0.* FROM sysindexkeys k0 INNER JOIN (SELECT i0.* FROM sysindexes i0 ' +
                    'INNER JOIN sysobjects s0 ON i0.[id]=s0.[id]  WHERE i0.[status]=2066) x0  ON k0.[id]=x0.[id] AND k0.[indid]=x0.[indid] ) p0 ON c0.[id]=p0.[id] ' +
                    'AND c0.[colid]=p0.[colid]  WHERE s0.[name]=? AND s0.[xtype]=\'U\' AND SCHEMA_NAME(s0.[uid])=?', [table, owner], function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        callback(null, result);
                    });
            },
            columnsAsync: function () {
                return new Promise((resolve, reject) => {
                    this.columns((err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            },
            /**
             * @param {{name:string,type:string,primary:boolean|number,nullable:boolean|number,size:number, scale:number,precision:number,oneToMany:boolean}[]|*} fields
             * @param callback
             */
            create: function (fields, callback) {
                callback = callback || function () { };
                fields = fields || [];
                if (!Array.isArray(fields)) {
                    return callback(new Error('Invalid argument type. Expected Array.'));
                }
                if (fields.length === 0) {
                    return callback(new Error('Invalid argument. Fields collection cannot be empty.'));
                }
                let strFields = fields.filter((x) => {
                    return !x.oneToMany;
                }).map((x) => {
                    return self.format('[%f] %t', x);
                }).join(', ');

                //add primary key constraint
                const strPKFields = fields.filter((x) => {
                    return (x.primary === true || x.primary === 1);
                }).map((x) => {
                    return self.format('[%f]', x);
                }).join(', ');
                if (strPKFields.length > 0) {
                    strFields += ', ' + sprintf('PRIMARY KEY (%s)', strPKFields);
                }
                const strTable = sprintf('[%s].[%s]', owner, table);
                const sql = sprintf('CREATE TABLE %s (%s)', strTable, strFields);
                self.execute(sql, null, function (err) {
                    callback(err);
                });
            },
            createAsync: function (fields) {
                return new Promise((resolve, reject) => {
                    this.create(fields, (err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            },
            /**
             * Alters the table by adding an array of fields
             * @param {{name:string,type:string,primary:boolean|number,nullable:boolean|number,size:number,oneToMany:boolean}[]|*} fields
             * @param callback
             */
            add: function (fields, callback) {
                callback = callback || function () { };
                callback = callback || function () { };
                fields = fields || [];
                if (!Array.isArray(fields)) {
                    //invalid argument exception
                    return callback(new Error('Invalid argument type. Expected Array.'));
                }
                if (fields.length === 0) {
                    //do nothing
                    return callback();
                }
                const strTable = sprintf('[%s].[%s]', owner, table);
                //generate SQL statement
                const sql = fields.map((x) => {
                    return self.format('ALTER TABLE ' + strTable + ' ADD [%f] %t', x);
                }).join(';');
                self.execute(sql, [], function (err) {
                    callback(err);
                });
            },
            addAsync: function (fields) {
                return new Promise((resolve, reject) => {
                    this.add(fields, (err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            },
            /**
             * Alters the table by modifying an array of fields
             * @param {{name:string,type:string,primary:boolean|number,nullable:boolean|number,size:number,oneToMany:boolean}[]|*} fields
             * @param callback
             */
            change: function (fields, callback) {
                callback = callback || function () { };
                callback = callback || function () { };
                fields = fields || [];
                if (!Array.isArray(fields)) {
                    //invalid argument exception
                    return callback(new Error('Invalid argument type. Expected Array.'));
                }
                if (fields.length === 0) {
                    //do nothing
                    return callback();
                }
                const strTable = sprintf('[%s].[%s]', owner, table);
                //generate SQL statement
                const sql = fields.map((x) => {
                    return self.format('ALTER TABLE ' + strTable + ' ALTER COLUMN [%f] %t', x);
                }).join(';');
                self.execute(sql, [], function (err) {
                    callback(err);
                });
            },
            changeAsync: function (fields) {
                return new Promise((resolve, reject) => {
                    this.change(fields, (err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            },
        };
    }
    /**
     * Initializes database view helper.
     * @param {string} name - A string that represents the view name
     * @returns {*}
     */
    view(name) {
        const self = this;
        let owner;
        let view;
        const matches = /(\w+)\.(\w+)/.exec(name);
        if (matches) {
            //get schema owner
            owner = matches[1];
            //get table name
            view = matches[2];
        }
        else {
            //get view name
            view = name;
            //get default owner
            owner = 'dbo';
        }
        return {
            /**
             * @param {Function} callback
             */
            exists: function (callback) {
                callback = callback || function () { };
                self.execute('SELECT COUNT(*) AS [count] FROM sysobjects WHERE [name]=? AND [type]=\'V\' AND SCHEMA_NAME([uid])=?', [view, owner], function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    callback(null, result[0].count === 1);
                });
            },
            existsAsync: function () {
                return new Promise((resolve, reject) => {
                    this.exists((err, value) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(value);
                    });
                });
            },
            /**
             * @param {Function} callback
             */
            drop: function (callback) {
                callback = callback || function () { };
                self.open(function (err) {
                    if (err) {
                        return callback(err);
                    }
                    self.execute('SELECT COUNT(*) AS [count] FROM sysobjects WHERE [name]=? AND [type]=\'V\' AND SCHEMA_NAME([uid])=?', [view, owner], function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        const exists = (result[0].count > 0);
                        if (exists) {
                            const formatter = new MSSqlFormatter();
                            const sql = sprintf('DROP VIEW %s.%s', formatter.escapeName(owner), formatter.escapeName(view));
                            self.execute(sql, [], function (err) {
                                if (err) {
                                    callback(err);
                                    return;
                                }
                                callback();
                            });
                        }
                        else {
                            callback();
                        }
                    });
                });
            },
            dropAsync: function () {
                return new Promise((resolve, reject) => {
                    this.drop((err) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                });
            },
            /**
             * @param {QueryExpression|*} q
             * @param {Function} callback
             */
            create: function (q, callback) {
                const thisArg = this;
                self.executeInTransaction(function (tr) {
                    thisArg.drop(function (err) {
                        if (err) {
                            tr(err);
                            return;
                        }
                        try {
                            const formatter = new MSSqlFormatter();
                            const sql = 'EXECUTE(\'' + sprintf('CREATE VIEW %s.%s AS ', formatter.escapeName(owner), formatter.escapeName(view)) + formatter.format(q) + '\')';
                            self.execute(sql, [], tr);
                        }
                        catch (e) {
                            tr(e);
                        }
                    });
                }, function (err) {
                    callback(err);
                });
            },
            createAsync: function (q) {
                return new Promise((resolve, reject) => {
                    this.create(q, (err) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                });
            }
        };
    }

    /**
     * 
     * @returns {import('./MSSqlAdapter').DataAdapterTables}
     */
    tables() {
        const self = this;
        return {
            /**
             * @param {function} callback
             * @returns void
             */
            list: function(callback) {
                void self.execute('SELECT [name] as [name],SCHEMA_NAME([uid]) AS [schema] FROM sysobjects WHERE [type]=\'U\'', null, (err, results) => {
                    if (err) {
                        return callback(err);
                    }
                    return callback(null, results);
                });
            },
            listAsync: function() {
                return new Promise((resolve, reject) => {
                    this.list((err, value) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(value);
                    });
                });
            }
        }
    }

    /**
     * 
     * @returns {import('./MSSqlAdapter').DataAdapterViews}
     */
    views() {
        const self = this;
        return {
            /**
             * @param {function} callback
             * @returns void
             */
            list: function(callback) {
                void self.execute('SELECT [name] as [name],SCHEMA_NAME([uid]) AS [schema] FROM sysobjects WHERE [type]=\'V\'', null, (err, results) => {
                    if (err) {
                        return callback(err);
                    }
                    return callback(null, results);
                });
            },
            listAsync: function() {
                return new Promise((resolve, reject) => {
                    this.list((err, value) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(value);
                    });
                });
            }
        }
    }
    /**
     *
     * @param  {DataModelMigration|*} obj - An Object that represents the data model scheme we want to migrate
     * @param {Function} callback
     */
    migrate(obj, callback) {
        if (obj == null)
            return;
        const self = this;
        const migration = obj;
        if (migration.appliesTo == null)
            throw new Error('Invalid argument. Model name is undefined.');
        self.open(function (err) {
            if (err) {
                callback.bind(self)(err);
            }
            else {
                async.waterfall([
                    //1. Check table existence
                    function (cb) {
                        self.table('migrations').exists(function (err, exists) {
                            if (err) {
                                return cb(err);
                            }
                            cb(null, exists);
                        });
                    },
                    //2. Create migrations table if not exists
                    function (arg, cb) {
                        if (arg > 0) {
                            return cb(null, 0);
                        }
                        self.table('migrations').create([
                            { name: 'id', type: 'Counter', primary: true, nullable: false },
                            { name: 'appliesTo', type: 'Text', size: '80', nullable: false },
                            { name: 'model', type: 'Text', size: '120', nullable: true },
                            { name: 'description', type: 'Text', size: '512', nullable: true },
                            { name: 'version', type: 'Text', size: '40', nullable: false }
                        ], function (err) {
                            if (err) {
                                return cb(err);
                            }
                            cb(null, 0);
                        });
                    },
                    //3. Check if migration has already been applied
                    function (arg, cb) {
                        self.execute('SELECT COUNT(*) AS [count] FROM [migrations] WHERE [appliesTo]=? and [version]=?', [migration.appliesTo, migration.version], function (err, result) {
                            if (err) {
                                return cb(err);
                            }
                            cb(null, result[0].count);
                        });
                    },
                    //4a. Check table existence
                    function (arg, cb) {
                        //migration has already been applied (set migration.updated=true)
                        if (arg > 0) {
                            obj['updated'] = true;
                            cb(null, -1);
                            return;
                        }
                        self.table(migration.appliesTo).exists(function (err, exists) {
                            if (err) {
                                return cb(err);
                            }
                            cb(null, exists ? 1 : 0);
                        });
                    },
                    //4b. Migrate target table (create or alter)
                    function (arg, cb) {
                        //migration has already been applied
                        if (arg < 0) {
                            return cb(null, arg);
                        }
                        if (arg === 0) {
                            //create table
                            return self.table(migration.appliesTo).create(migration.add, function (err) {
                                if (err) {
                                    return cb(err);
                                }
                                cb(null, 1);
                            });
                        }
                        //columns to be removed (unsupported)
                        if (Array.isArray(migration.remove)) {
                            if (migration.remove.length > 0) {
                                return cb(new Error('Data migration remove operation is not supported by this adapter.'));
                            }
                        }
                        //columns to be changed (unsupported)
                        if (Array.isArray(migration.change)) {
                            if (migration.change.length > 0) {
                                return cb(new Error('Data migration change operation is not supported by this adapter. Use add collection instead.'));
                            }
                        }
                        let column, newType, oldType;
                        if (Array.isArray(migration.add)) {
                            //init change collection
                            migration.change = [];
                            //get table columns
                            self.table(migration.appliesTo).columns(function (err, columns) {
                                if (err) {
                                    return cb(err);
                                }
                                const findColumnFunc = (name) => {
                                    return columns.find((y) => {
                                        return (y.name === name);
                                    });
                                };
                                for (let i = 0; i < migration.add.length; i++) {
                                    const x = migration.add[i];
                                    column = findColumnFunc(x.name);
                                    if (column) {
                                        //if column is primary key remove it from collection
                                        if (column.primary) {
                                            migration.add.splice(i, 1);
                                            i -= 1;
                                        }
                                        else {
                                            //get new type
                                            newType = self.format('%t', x);
                                            //get old type
                                            oldType = column.type1.replace(/\s+$/, '') + ((column.nullable === true || column.nullable === 1) ? ' null' : ' not null');
                                            //remove column from collection
                                            migration.add.splice(i, 1);
                                            i -= 1;
                                            if (newType !== oldType) {
                                                //add column to alter collection
                                                migration.change.push(x);
                                            }
                                        }
                                    }
                                }
                                //alter table
                                const targetTable = self.table(migration.appliesTo);
                                //add new columns (if any)
                                targetTable.add(migration.add, function (err) {
                                    if (err) {
                                        return cb(err);
                                    }
                                    //modify columns (if any)
                                    targetTable.change(migration.change, function (err) {
                                        if (err) {
                                            return cb(err);
                                        }
                                        cb(null, 1);
                                    });
                                });
                            });
                        }
                        else {
                            cb(new Error('Invalid migration data.'));
                        }
                    },
                    //Apply data model indexes
                    function (arg, cb) {
                        if (arg <= 0) {
                            return cb(null, arg);
                        }
                        if (migration.indexes) {
                            const tableIndexes = self.indexes(migration.appliesTo);
                            //enumerate migration constraints
                            async.eachSeries(migration.indexes, function (index, indexCallback) {
                                tableIndexes.create(index.name, index.columns, indexCallback);
                            }, function (err) {
                                //throw error
                                if (err) {
                                    return cb(err);
                                }
                                //or return success flag
                                return cb(null, 1);
                            });
                        }
                        else {
                            //do nothing and exit
                            return cb(null, 1);
                        }
                    },
                    function (arg, cb) {
                        if (arg > 0) {
                            self.execute('INSERT INTO migrations (appliesTo,model,version,description) VALUES (?,?,?,?)', [migration.appliesTo,
                            migration.model,
                            migration.version,
                            migration.description], function (err) {
                                if (err) {
                                    return cb(err);
                                }
                                return cb(null, 1);
                            });
                        }
                        else
                            cb(null, arg);
                    }
                ], function (err, result) {
                    callback(err, result);
                });
            }
        });
    }

    /**
     * @param  {DataModelMigration|*} obj - An Object that represents the data model scheme we want to migrate
     */
    migrateAsync(obj) {
        return new Promise((resolve, reject) => {
            return this.migrate(obj, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }
    /**
     * A utility for database object
     * @param {string} name 
     */
    database(name) {
        const self = this;
        let db = name;
        let owner = 'dbo';
        const matches = /(\w+)\.(\w+)/.exec(name);
        if (matches) {
            owner = matches[1];
            db = matches[2];
        }
        return {
            exists: function (callback) {
                self.execute('SELECT [name] FROM [sys].[databases] WHERE ([name]=? AND SCHEMA_NAME([owner_sid])=?)',
                    [
                        db,
                        owner
                    ], (err, res) => {
                    if (err) {
                        return callback(err);
                    }
                    return callback(null, res.length === 1);
                });
            },
            existsAsync: function () {
                return new Promise((resolve, reject) => {
                    this.exists((err, value) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(value);
                    });
                });
            },
            create: function (callback) {
                const formatter = new MSSqlFormatter();
                self.execute('SELECT [name] FROM [sys].[databases] WHERE ([name]=? AND SCHEMA_NAME([owner_sid])=?)', [
                    db,
                    owner
                ], (err, res) => {
                    if (err) {
                        return callback(err);
                    }
                    if (res.length === 1) {
                        return callback();
                    }
                    return self.execute(`CREATE DATABASE ${formatter.escapeName(db)}`, null, (err) => {
                        if (err) {
                            return callback(err);
                        }
                        return callback();
                    });
                });
            },
            createAsync: function () {
                return new Promise((resolve, reject) => {
                    this.create((err) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                });
            }
        };
    }

    /**
     * Table indexes helper
     * @param {string} table 
     */
    indexes(table) {
        const self = this, formatter = new MSSqlFormatter();
        return {
            list: function (callback) {
                const this1 = this;
                if (Object.prototype.hasOwnProperty.call(this1, '_indexes')) {
                    return callback(null, this1['_indexes']);
                }
                const sqlIndexes = `SELECT [object_id], [index_id], [name], [type], [type_desc], [is_unique] 
                FROM sys.indexes WHERE [object_id] = OBJECT_ID('${table}') ORDER BY [index_id]`;
                const sqlIndexColumns = `SELECT  [ind].[object_id], [ind].[name], [ind].[index_id], [ic].[index_column_id] as [column_id], [col].[name] as [column_name]
                FROM sys.indexes [ind] 
                INNER JOIN 
                    sys.index_columns [ic] ON  [ind].[object_id] = [ic].[object_id] and [ind].[index_id] = [ic].[index_id] 
                INNER JOIN 
                    sys.columns col ON [ic].[object_id] = [col].[object_id] and [ic].[column_id] = [col].[column_id]
                    WHERE col.[object_id] =  OBJECT_ID('${table}') ORDER BY [ind].[index_id], [col].[column_id]`;
                    (async () => {
                        const results = [];
                        results.push(await self.executeAsync(sqlIndexes, null));
                        results.push(await self.executeAsync(sqlIndexColumns, null));
                        return results;
                    })().then((results) => {
                    const indexes = results[0].map(function (x) {
                        return {
                            name: x.name,
                            columns: results[1].filter((y) => x.index_id === y.index_id).map((y) => y.column_name)
                        };
                    });
                    this1['_indexes'] = indexes;
                    return callback(null, indexes);
                }).catch((err) => {
                    return callback(err);
                });
            },
            listAsync: function () {
                return new Promise((resolve, reject) => {
                    this.list((err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            },
            /**
             * @param {string} name
             * @param {Array|string} columns
             * @param {Function} callback
             */
            create: function (name, columns, callback) {
                const cols = [];
                if (typeof columns === 'string') {
                    cols.push(columns);
                }
                else if (Array.isArray(columns)) {
                    cols.push.apply(cols, columns);
                }
                else {
                    return callback(new Error('Invalid parameter. Columns parameter must be a string or an array of strings.'));
                }
                const thisArg = this;
                thisArg.list(function (err, indexes) {
                    if (err) {
                        return callback(err);
                    }
                    const findIndex = indexes.find((x) => {
                        return x.name === name;
                    });
                    //format create index SQL statement
                    const escapeColumns = cols.map(function (x) {
                        return formatter.escapeName(x);
                    }).join(',');
                    const sqlCreateIndex = `CREATE INDEX ${formatter.escapeName(name)} ON ${formatter.escapeName(table)}(${escapeColumns})`;
                    if (findIndex == null) {
                        self.execute(sqlCreateIndex, [], (err) => {
                            if (err) {
                                return callback(err);
                            }
                            return callback(null, 1);
                        });
                    }
                    else {
                        let nCols = cols.length;
                        //enumerate existing columns
                        findIndex.columns.forEach(function (x) {
                            if (cols.indexOf(x) >= 0) {
                                //column exists in index
                                nCols -= 1;
                            }
                        });
                        if (nCols > 0) {
                            //drop index
                            thisArg.drop(name, function (err) {
                                if (err) {
                                    return callback(err);
                                }
                                //and create it
                                self.execute(sqlCreateIndex, [], (err) => {
                                    if (err) {
                                        return callback(err);
                                    }
                                    return callback(null, 1);
                                });
                            });
                        }
                        else {
                            //do nothing
                            return callback(null, 0);
                        }
                    }
                });
            },
            /**
             * @param {string} name
             * @param {Array|string} columns
             */
            createAsync: function (name, columns) {
                return new Promise((resolve, reject) => {
                    this.create(name, columns, (err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            },
            drop: function (name, callback) {
                const thisArg = this;
                if (typeof name !== 'string') {
                    return callback(new Error('Name must be a valid string.'));
                }
                self.execute(`SELECT [object_id], [index_id], [name], [type], [type_desc], [is_unique] 
                    FROM sys.indexes WHERE [object_id] = OBJECT_ID('${table}') AND [name]='${name}'`, null, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    if (result.length === 0) {
                        return callback(null, 0);
                    }
                    self.execute(`DROP INDEX ${formatter.escapeName(name)} ON ${formatter.escapeName(table)}`, null, (err) => {
                        if (err) {
                            return callback(err);
                        }
                        // cleanup indexes
                        delete thisArg._indexes;
                        // and return
                        return callback(null, 1);
                    });
                });
            },
            dropAsync: function (name) {
                return new Promise((resolve, reject) => {
                    this.drop(name, (err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            }
        };
    }

    /**
     * @returns {import('generic-pool').Pool}
     */
    getConnectionPool() {
        const manager = new MSSqlConnectionPoolManager();
        return manager.pools.get(this.id);
    }

    finalizeConnectionPool(callback) {
        new MSSqlConnectionPoolManager().finalize((err) => {
            return callback(err);
        });
    }

    finalizeConnectionPoolAsync() {
        return new MSSqlConnectionPoolManager().finalizeAsync();
    }

    getFormatter() {
        return new MSSqlFormatter();
    }

}

export {
    MSSqlConnectionPoolManager,
    MSSqlAdapter
};
