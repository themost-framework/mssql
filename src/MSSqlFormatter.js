// MOST Web Framework Codename Zero Gravity Copyright (c) 2017-2022, THEMOST LP All rights reserved
import { sprintf } from 'sprintf-js';
import { QueryField, SqlFormatter, QueryExpression } from '@themost/query';

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
        const offset = new Date().getTimezoneOffset();
        this.settings = {
            nameFormat: '[$1]',
            timezone: (offset <= 0 ? '+' : '-') + zeroPad(-Math.floor(offset / 60), 2) + ':' + zeroPad(offset % 60, 2)
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
            sql = sprintf('SELECT %s FROM (%s) [t0] WHERE [__RowIndex] BETWEEN %s AND %s', fields.map((x) => {
                return self.format(x, '%f');
            }).join(', '), subQuery, parseInt(obj.$skip, 10) + 1, parseInt(obj.$skip, 10) + parseInt(obj.$take, 10));
        }
        return sql;
    }
    /**
     * Implements indexOf(str,substr) expression formatter.
     * @param {*} p0 The source string
     * @param {*} p1 The string to search for
     */
    $indexof(p0, p1) {
        return this.$indexOf(p0, p1);
    }
    /**
     * Implements indexOf(str,substr) expression formatter.
     * @param {*} p0 The source string
     * @param {*} p1 The string to search for
     */
    $indexOf(p0, p1) {
        p1 = '%' + p1 + '%';
        return '(PATINDEX('.concat(this.escape(p1), ',', this.escape(p0), ')-1)');
    }

    $length(p0) {
        return sprintf('LEN(%s)', this.escape(p0));
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
        return sprintf('PATINDEX(%s,%s) >= 1', this.escape(s1), this.escape(p0));
    }
    $date(p0) {
        return sprintf('CONVERT(date, %s)', this.escape(p0));
    }
    /**
     * Escapes an object or a value and returns the equivalent sql value.
     * @param {*} value
     * @param {boolean=} unquoted
     */
    escape(value, unquoted) {
        if (typeof value === 'boolean') {
            return value ? '1' : '0';
        }
        if (value instanceof Date) {
            return this.escapeDate(value);
        }
        if (typeof value === 'string') {
            const str = value.replace(/'/g, '\'\'');
            return unquoted ? str : ('\'' + str + '\'');
        }
        return super.escape.bind(this)(value, unquoted);
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
        return sprintf('PATINDEX (%s,%s)', this.escape(p1), this.escape(p0));
    }
    /**
     * Implements contains(a,b) expression formatter.
     * @param p0 {*}
     * @param p1 {*}
     */
    $text(p0, p1) {
        return sprintf('(PATINDEX (%s,%s) - 1)', this.escape('%' + p1 + '%'), this.escape(p0));
    }
    /**
     * Implements endsWith(a,b) expression formatter.
     * @param p0 {*}
     * @param p1 {*}
     */
    $endswith(p0, p1) {
        p1 = '%' + p1;
        // (PATINDEX('%S%',  UserData.alternateName))
        return sprintf('(CASE WHEN %s LIKE %s THEN 1 ELSE 0 END)', this.escape(p0), this.escape(p1));
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
            return sprintf('SUBSTRING(%s,%s,%s)', this.escape(p0), pos.valueOf() + 1, length.valueOf());
        else
            return sprintf('SUBSTRING(%s,%s,%s)', this.escape(p0), pos.valueOf() + 1, 255);
    }
    /**
     * Implements trim(a) expression formatter.
     * @param p0 {*}
     */
    $trim(p0) {
        return sprintf('LTRIM(RTRIM((%s)))', this.escape(p0));
    }
    /**
     * @param {*=} order 
     * @returns {string}
     */
    $rowIndex(order) {
        if (order == null) {
            return 'ROW_NUMBER() OVER(ORDER BY (SELECT NULL))';
        }
        return sprintf('ROW_NUMBER() OVER(%s)', this.format(order, '%o'));
    }

    $year(p0) {
        return sprintf('DATEPART(year, SWITCHOFFSET(%s, \'%s\'))', this.escape(p0), this.settings.timezone);
    }

    $month(p0) {
        return sprintf('DATEPART(month, SWITCHOFFSET(%s, \'%s\'))', this.escape(p0), this.settings.timezone);
    }

    $dayOfMonth(p0) {
        return sprintf('DATEPART(day, SWITCHOFFSET(%s, \'%s\'))', this.escape(p0), this.settings.timezone);
    }

    $day(p0) {
        return this.$dayOfMonth(p0);
    }

    $hour(p0) {
        return sprintf('DATEPART(hour, SWITCHOFFSET(%s, \'%s\'))', this.escape(p0), this.settings.timezone);
    }

    $minute(p0) {
        return sprintf('DATEPART(minute, SWITCHOFFSET(%s, \'%s\'))', this.escape(p0), this.settings.timezone);
    }

    $minutes(p0) {
        return this.$minute(p0);
    }

    $second(p0) {
        return sprintf('DATEPART(second, SWITCHOFFSET(%s, \'%s\'))', this.escape(p0), this.settings.timezone);
    }

    $seconds(p0) {
        return this.$second(p0);
    }

    $ifnull(p0, p1) {
        return sprintf('ISNULL(%s, %s)', this.escape(p0), this.escape(p1));
    }

    $ifNull(p0, p1) {
        return sprintf('ISNULL(%s, %s)', this.escape(p0), this.escape(p1));
    }

    $toString(p0) {
        return sprintf('CAST(%s AS NVARCHAR)', this.escape(p0));
    }

    isLogical = function(obj) {
        for (const key in obj) {
            return (/^\$(and|or|not|nor)$/g.test(key));
        }
        return false;
    }

    $cond(ifExpr, thenExpr, elseExpr) {
        // validate ifExpr which should an instance of QueryExpression or a comparison expression
        let ifExpression;
        if (ifExpr instanceof QueryExpression) {
            ifExpression = this.formatWhere(ifExpr.$where);
        } else if (this.isComparison(ifExpr) || this.isLogical(ifExpr)) {
            ifExpression = this.formatWhere(ifExpr);
        } else {
            throw new Error('Condition parameter should be an instance of query or comparison expression');
        }
        return sprintf('(CASE WHEN %s THEN %s ELSE %s END)', ifExpression, this.escape(thenExpr), this.escape(elseExpr));
    }

}

export {
    MSSqlFormatter
};