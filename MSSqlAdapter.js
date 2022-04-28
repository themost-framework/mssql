/**
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2014-2020, THEMOST LP themost-framework@themost.io
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */
const mssql = require('mssql');
const {ConnectionPool} = require('mssql');
const async = require('async');
const util = require('util');
const { TraceUtils } = require('@themost/common');
const { QueryExpression, SqlUtils } = require('@themost/query');
const { MSSqlFormatter } = require('./MSSqlFormatter');
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
        // clone connection options
        const connectionOptions = Object.assign({
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        }, self.options);
        // create connection
        const connection = new ConnectionPool(connectionOptions);
        connection.connect(function(err) {
            if (err) {
                // destroy connection
                self.rawConnection = null;
                TraceUtils.error('An error occurred while connecting to database server');
                TraceUtils.error(err);
                return callback(err);
            }
            // set connection
            self.rawConnection = connection;
            return callback();
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
        if (self.rawConnection == null) {
            if (typeof callback == 'function') {
                return callback();
            }
            return;
        }
        self.rawConnection.close(function (err) {
            if (err) {
                TraceUtils.error('An error occurred while closing database connection');
                TraceUtils.error(err);
            }
            //do nothing
            self.rawConnection = null;
            // invoke callback
            if (typeof callback == 'function') {
                return callback();
            }
        });
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
                self.transaction = new mssql.Transaction(self.rawConnection);
                //begin transaction
                self.transaction.begin(function (err) {
                    //error check (?)
                    if (err) {
                        TraceUtils.log(err);
                        callback.call(self, err);
                    }
                    else {
                        try {
                            fn.call(self, function (err) {
                                try {
                                    if (err) {
                                        if (self.transaction) {
                                            self.transaction.rollback();
                                            self.transaction = null;
                                        }
                                        callback.call(self, err);
                                    }
                                    else {
                                        if (typeof self.transaction === 'undefined' || self.transaction === null) {
                                            callback.call(self, new Error('Database transaction cannot be empty on commit.'));
                                            return;
                                        }
                                        self.transaction.commit(function (err) {
                                            if (err) {
                                                self.transaction.rollback();
                                            }
                                            self.transaction = null;
                                            callback.call(self, err);
                                        });
                                    }
                                }
                                catch (e) {
                                    callback.call(self, e);
                                }
                            });
                        }
                        catch (e) {
                            callback.call(self, e);
                        }
                    }
                });
                /* self.transaction.on('begin', function() {
                     TraceUtils.log('begin transaction');
                 });*/
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
        // validate current connection transaction
        const inTransaction = (this.transaction != null);
        // create a dedicated connection or use current connection if transaction is empty
        const db = inTransaction ? new MSSqlAdapter(this.options) : this;
        // create migration schema
        const migration = {
            'appliesTo': 'increment_id',
            'model': 'increments',
            'version': '1.0',
            'description': 'Increments migration (version 1.0)',
            'add': [
                { 'name': 'id', 'type': 'Counter', 'primary': true },
                { 'name': 'entity', 'type': 'Text', 'size': 120 },
                { 'name': 'attribute', 'type': 'Text', 'size': 120 },
                { 'name': 'value', 'type': 'Integer' }
            ]
        };
        //ensure increments entity
        db.migrate(migration, (err) => {
            //throw error if any
            if (err) {
                if (inTransaction === false) {
                    return callback(err);
                }
                // close dedicated connection
                return db.close(() => {
                    // and return error
                    return callback(err);
                });
            }
            // prepare
            const sql = `IF NOT EXISTS(SELECT * FROM [increment_id] WHERE [entity]='${entity}' AND [attribute] = '${attribute}')
                INSERT INTO [increment_id]([entity], [attribute], [value]) VALUES ('${entity}', '${attribute}', (SELECT ISNULL(MAX([${attribute}]), 0) 
                FROM [${entity}]));
                DECLARE @t TABLE (value int);
                UPDATE  [increment_id] SET [value] = [value] + 1 OUTPUT [inserted].[value] INTO @t WHERE [entity]='${entity}' AND attribute = '${attribute}';SELECT * FROM @t`;
            // execute
            return db.execute(sql, null, (err, result) => {
                if (inTransaction === false) {
                    if (err) {
                        return callback(err);
                    }
                    // return result[0]
                    return callback(null, result[0].value);
                }
                // close dedicated connection
                return db.close(() => {
                    if (err) {
                        return callback(err);
                    }
                    // and return result[0]
                    return callback(null, result[0].value);
                });
            });
        });
    }

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
            }
            else {
                //format query expression or any object that may act as query expression
                const formatter = new MSSqlFormatter();
                sql = formatter.format(query);
            }
            //validate sql statement
            if (typeof sql !== 'string') {
                callback.call(self, new Error('The executing command is of the wrong type or empty.'));
                return;
            }
            //ensure connection
            self.open(function (err) {
                if (err) {
                    callback.call(self, err);
                }
                else {
                    //log statement (optional)
                    let startTime;
                    if (process.env.NODE_ENV === 'development') {
                        startTime = new Date().getTime();
                    }
                    //execute raw command
                    const request = self.transaction ? new mssql.Request(self.transaction) : new mssql.Request(self.rawConnection);
                    let preparedSql = self.prepare(sql, values);
                    if (typeof query.$insert !== 'undefined')
                        preparedSql += ';SELECT SCOPE_IDENTITY() as insertId';
                    request.query(preparedSql, function (err, result) {
                        if (process.env.NODE_ENV === 'development') {
                            TraceUtils.log(util.format('SQL (Execution Time:%sms):%s, Parameters:%s', (new Date()).getTime() - startTime, sql, JSON.stringify(values)));
                        }
                        if (err) {
                            TraceUtils.log(util.format('SQL (Execution Error):%s, %s', err.message, preparedSql));
                        }
                        if (typeof query.$insert === 'undefined') {
                            if (result.recordsets.length === 1) {
                                return callback(err, Array.from(result.recordset));
                            }
                            return callback(err, result.recordsets.map(function(recordset) {
                                return Array.from(result.recordset);
                            }));
                        } else {
                            if (result) {
                                if (result.length > 0)
                                    callback.bind(self)(err, { insertId: result[0].insertId });
                                else
                                    callback.bind(self)(err, result);
                            }
                            else {
                                callback.bind(self)(err, result);
                            }
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
                s = util.format('decimal(%s,%s)', (size > 0 ? size : 19), (scale > 0 ? scale : 4));
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
                s = size > 0 ? util.format('varchar(%s)', size) : 'varchar(48)';
                break;
            case 'URL':
                if (size > 0)
                    s = util.format('varchar(%s)', size);
                else
                    s = 'varchar(512)';
                break;
            case 'Text':
                if (size > 0)
                    s = util.format('varchar(%s)', size);
                else
                    s = 'varchar(512)';
                break;
            case 'Note':
                if (size > 0)
                    s = util.format('varchar(%s)', size);
                else
                    s = 'text';
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
                    strFields += ', ' + util.format('PRIMARY KEY (%s)', strPKFields);
                }
                const strTable = util.format('[%s].[%s]', owner, table);
                const sql = util.format('CREATE TABLE %s (%s)', strTable, strFields);
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
                const strTable = util.format('[%s].[%s]', owner, table);
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
                const strTable = util.format('[%s].[%s]', owner, table);
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
                    this.add(fields, (err, res) => {
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
                            const sql = util.format('DROP VIEW %s.%s', formatter.escapeName(owner), formatter.escapeName(view));
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
                            const sql = 'EXECUTE(\'' + util.format('CREATE VIEW %s.%s AS ', formatter.escapeName(owner), formatter.escapeName(view)) + formatter.format(q) + '\')';
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
                const query = new QueryExpression().from('sys.databases').where('name').equal(db)
                    .and('SCHEMA_NAME(owner_sid)').equal(owner)
                    .select('name');
                self.execute(query, null, (err, res) => {
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
                const query = new QueryExpression().from('sys.databases').where('name').equal(db)
                    .and('SCHEMA_NAME(owner_sid)').equal(owner)
                    .select('name');
                self.execute(query, null, (err, res) => {
                    if (err) {
                        return callback(err);
                    }
                    if (res.length === 1) {
                        return callback();
                    }
                    return self.execute(`CREATE DATABASE ${db}`, null, (err) => {
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

                Promise.all([
                    self.executeAsync(sqlIndexes, null),
                    self.executeAsync(sqlIndexColumns, null)
                ]).then((results) => {
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

}

module.exports = {
    MSSqlAdapter
};
