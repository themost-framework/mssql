// MOST Web Framework Codename Zero Gravity Copyright (c) 2017-2022, THEMOST LP All rights reserved
import util from 'util';
import { QueryField, SqlUtils, SqlFormatter, ObjectNameValidator } from '@themost/query';
import { Args } from '@themost/common';

function zeroPad(number, length) {
    number = number || 0;
    let res = number.toString();
    while (res.length < length) {
        res = '0' + res;
    }
    return res;
}

/**
 * @class
 * @augments {SqlFormatter}
 */
class MSSqlFormatter extends SqlFormatter {
    /**
     * @constructor
     */
    constructor() {
        super();
        this.settings = {
            nameFormat: '[$1]'
        };
    }
    formatLimitSelect(obj) {
        let sql;
        const self = this;
        if (!obj.$take) {
            sql = self.formatSelect(obj);
        }
        else {
            obj.$take = parseInt(obj.$take) || 0;
            obj.$skip = parseInt(obj.$skip) || 0;
            //add row_number with order
            const keys = Object.keys(obj.$select);
            if (keys.length === 0)
                throw new Error('Entity is missing');
            const queryFields = obj.$select[keys[0]]
            const order = obj.$order;
            // format order expression
            const rowIndex = Object.assign(new QueryField(), {
                // use alias
                __RowIndex: {
                    // use row index func
                    $rowIndex: [
                        order // set order or null
                    ]
                }
            });
            queryFields.push(rowIndex);
            if (order)
                delete obj.$order;
            const subQuery = self.formatSelect(obj);
            if (order)
                obj.$order = order;
            //delete row index field
            queryFields.pop();
            const fields = [];
            queryFields.forEach((x) => {
                if (typeof x === 'string') {
                    fields.push(new QueryField(x));
                }
                else {
                    /**
                     * @type {QueryField}
                     */
                    const field = Object.assign(new QueryField(), x);
                    fields.push(field.as() || field.getName());
                }
            });
            sql = util.format('SELECT %s FROM (%s) [t0] WHERE [__RowIndex] BETWEEN %s AND %s', fields.map((x) => {
                return self.format(x, '%f');
            }).join(', '), subQuery, parseInt(obj.$skip, 10) + 1, parseInt(obj.$skip, 10) + parseInt(obj.$take, 10));
        }
        return sql;
    }
    /**
     * Implements indexOf(str,substr) expression formatter.
     * @param {String} p0 The source string
     * @param {String} p1 The string to search for
     */
    $indexof(p0, p1) {
        p1 = '%' + p1 + '%';
        return '(PATINDEX('.concat(this.escape(p1), ',', this.escape(p0), ')-1)');
    }
    /**
     * Implements simple regular expression formatter. Important Note: MS SQL Server does not provide a core sql function for regular expression matching.
     * @param {string|*} p0 The source string or field
     * @param {string|*} p1 The string to search for
     */
    $regex(p0, p1) {
        let s1;
        //implement starts with equivalent for PATINDEX T-SQL
        if (/^\^/.test(p1)) {
            s1 = p1.replace(/^\^/, '');
        }
        else {
            s1 = '%' + p1;
        }
        //implement ends with equivalent for PATINDEX T-SQL
        if (/\$$/.test(s1)) {
            s1 = s1.replace(/\$$/, '');
        }
        else {
            s1 = s1 + '%';
        }
        //use PATINDEX for text searching
        return util.format('PATINDEX(%s,%s) >= 1', this.escape(s1), this.escape(p0));
    }
    $date(p0) {
        return util.format(' TODATETIMEOFFSET (%s,datepart(TZ,SYSDATETIMEOFFSET()))', this.escape(p0));
    }
    /**
     * Escapes an object or a value and returns the equivalent sql value.
     * @param {*} value
     * @param {boolean=} unquoted
     */
    escape(value, unquoted) {
        if (value === null || typeof value === 'undefined')
            return SqlUtils.escape(null);
        if (typeof value === 'string')
            return '\'' + value.replace(/'/g, '\'\'') + '\'';
        if (typeof value === 'boolean')
            return value ? '1' : '0';
        if (typeof value === 'object') {
            //add an exception for Date object
            if (value instanceof Date)
                return this.escapeDate(value);
            if (Object.prototype.hasOwnProperty.call(value, '$name'))
                return this.escapeName(value.$name);
        }
        if (unquoted)
            return value.valueOf();
        else
            return SqlUtils.escape(value);
    }
    escapeName(name) {
        Args.notString(name);
        // exclude wildcard
        if (name === '*') {
            return name;
        }
        // validate name
        ObjectNameValidator.validator.test(name);
        // and escape
        return name.replace(/(\w+)/g, this.settings.nameFormat);
    }
    /**
     * @param {Date|*} val
     * @returns {string}
     */
    escapeDate(val) {
        const year = val.getFullYear();
        const month = zeroPad(val.getMonth() + 1, 2);
        const day = zeroPad(val.getDate(), 2);
        const hour = zeroPad(val.getHours(), 2);
        const minute = zeroPad(val.getMinutes(), 2);
        const second = zeroPad(val.getSeconds(), 2);
        const millisecond = zeroPad(val.getMilliseconds(), 3);
        //format timezone
        const offset = val.getTimezoneOffset(), timezone = (offset <= 0 ? '+' : '-') + zeroPad(-Math.floor(offset / 60), 2) + ':' + zeroPad(offset % 60, 2);
        return 'CONVERT(datetimeoffset,\'' + year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second + '.' + millisecond + timezone + '\')';
    }
    /**
     * Implements startsWith(a,b) expression formatter.
     * @param p0 {*}
     * @param p1 {*}
     */
    $startswith(p0, p1) {
        p1 = '%' + p1 + '%';
        return util.format('PATINDEX (%s,%s)', this.escape(p1), this.escape(p0));
    }
    /**
     * Implements contains(a,b) expression formatter.
     * @param p0 {*}
     * @param p1 {*}
     */
    $text(p0, p1) {
        return util.format('(PATINDEX (%s,%s) - 1)', this.escape('%' + p1 + '%'), this.escape(p0));
    }
    /**
     * Implements endsWith(a,b) expression formatter.
     * @param p0 {*}
     * @param p1 {*}
     */
    $endswith(p0, p1) {
        p1 = '%' + p1;
        // (PATINDEX('%S%',  UserData.alternateName))
        return util.format('(CASE WHEN %s LIKE %s THEN 1 ELSE 0 END)', this.escape(p0), this.escape(p1));
    }
    /**
     * Implements substring(str,pos) expression formatter.
     * @param {String} p0 The source string
     * @param {Number} pos The starting position
     * @param {Number=} length The length of the resulted string
     * @returns {string}
     */
    $substring(p0, pos, length) {
        if (length)
            return util.format('SUBSTRING(%s,%s,%s)', this.escape(p0), pos.valueOf() + 1, length.valueOf());
        else
            return util.format('SUBSTRING(%s,%s,%s)', this.escape(p0), pos.valueOf() + 1, 255);
    }
    /**
     * Implements trim(a) expression formatter.
     * @param p0 {*}
     */
    $trim(p0) {
        return util.format('LTRIM(RTRIM((%s)))', this.escape(p0));
    }
    /**
     * @param {*=} order 
     * @returns {string}
     */
    $rowIndex(order) {
        if (order == null) {
            return 'ROW_NUMBER() OVER(ORDER BY (SELECT NULL))';
        }
        return util.format('ROW_NUMBER() OVER(%s)', this.format(order, '%o'));
    }
}

export {
    MSSqlFormatter
};