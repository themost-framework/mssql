import { DataAdapterBase, DataAdapterBaseHelper, DataAdapterDatabase, DataAdapterIndexes, DataAdapterMigration, DataAdapterTable, DataAdapterView } from '@themost/common';
import { Pool } from 'generic-pool'
export declare class MSSqlConnectionPoolManager {
    pools: Map<string, Pool<any>>;
    get(options: any, callback: (err?: Error, connection?: Pool<any>) => void): void;
    getAsync(options: any): Promise<Pool<any>>;
    finalize(callback: (err?: Error) => void): void;
    finalizeAsync(options: any): Promise<void>;
}

export declare class MSSqlAdapter implements DataAdapterBase, DataAdapterBaseHelper {
    static formatType(field: any): string;
    constructor(options?: any);
    rawConnection?: any;
    options?: any;
    selectIdentityAsync(entity: string, attribute: string): Promise<any>;
    executeInTransactionAsync(func: () => Promise<void>): Promise<void>;
    migrateAsync(obj: DataAdapterMigration): Promise<any>;
    formatType(field: any): string;
    open(callback: (err: Error) => void): void;
    close(callback: (err: Error) => void): void;
    openAsync(): Promise<void>;
    closeAsync(): Promise<void>;
    prepare(query: any, values?: Array<any>): any;
    createView(name: string, query: any, callback: (err: Error) => void): void;
    executeInTransaction(func: any, callback: (err: Error) => void): void;
    migrate(obj: DataAdapterMigration, callback: (err: Error) => void): void;
    selectIdentity(entity: string, attribute: string, callback: (err: Error, value: any) => void): void;
    execute(query: any, values: any, callback: (err: Error, value: any) => void): void;
    executeAsync(query: any, values: any): Promise<any>;
    executeAsync<T>(query: any, values: any): Promise<Array<T>>;
    table(name: string): DataAdapterTable;
    view(name: string): DataAdapterView;
    indexes(name: string): DataAdapterIndexes;
    database(name: string): DataAdapterDatabase;
    getConnectionPool(): Pool<any>;
    finalizeConnectionPool(callback: (err?: Error) => void): void;
    finalizeConnectionPoolAsync(options: any): Promise<void>;
}