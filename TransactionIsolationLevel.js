
const TransactionIsolationLevelEnum = {
    readUncommitted: 'READ UNCOMMITTED',
    readCommitted: 'READ COMMITTED',
    repeatableRead: 'REPEATABLE READ',
    snapshot: 'SNAPSHOT',
    serializable: 'SERIALIZABLE'
}

Object.freeze(TransactionIsolationLevelEnum);

class TransactionIsolationLevelFormatter {

    /**
     * @param {'readUncommitted' | 'readCommitted' | 'repeatableRead' | 'snapshot' | 'serializable'} isolationLevel 
     * @returns {string}
     */
    format(isolationLevel) {
        if (Object.prototype.hasOwnProperty.call(TransactionIsolationLevelEnum, isolationLevel)) {
            let sql = 'SET TRANSACTION ISOLATION LEVEL';
            sql += ' ';
            sql += TransactionIsolationLevelEnum[isolationLevel];
            return sql;
        }
        throw new TypeError('The specified transaction isolation level is invalid');
    }

}

module.exports = {
    TransactionIsolationLevelEnum,
    TransactionIsolationLevelFormatter
}