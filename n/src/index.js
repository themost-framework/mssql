import { MSSqlAdapter } from '@themost/mssql';

class MSSqlAdapter2 extends MSSqlAdapter {
    /**
     * @param {*} options 
     */
    constructor(options) {
        super(options);
    }

    formatType(field) {
        const nullable = Object.prototype.hasOwnProperty.call(field, 'nullable') ?
            (field.nullable ? 'NULL' : 'NOT NULL') : 'NULL';
        // override Text and URL
        if (field.type === 'Text' || field.type === 'URL') {
            return field.size > 0 ? `nvarchar(${field.size}) ${nullable}` : `nvarchar(512) ${nullable}`;
        }
        // override Note
        if (field.type === 'Note') {
            return field.size > 0 ? `nvarchar(${field.size}) ${nullable}` : `nvarchar(max) ${nullable}`;
        }
        // otherwise use default
        return super.formatType(field);
    }
}

/**
 * Creates an instance of MSSqlAdapter object that represents a MSSQL database connection.
 * @param {*} options An object that represents the properties of the underlying database connection.
 * @returns {MSSqlAdapter2}
 */
function createInstance(options) {
    return new MSSqlAdapter2(options);
}

export {
    MSSqlAdapter2,
    createInstance
};