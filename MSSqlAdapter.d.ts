/**
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2014-2020, THEMOST LP themost-framework@themost.io
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */

export declare interface MSSqlAdapterTable {
    create(fields: Array<any>, callback: (err: Error) => void): void;
    createAsync(fields: Array<any>): Promise<void>;
    add(fields: Array<any>, callback: (err: Error) => void): void;
    addAsync(fields: Array<any>): Promise<void>;
    change(fields: Array<any>, callback: (err: Error) => void): void;
    changeAsync(fields: Array<any>): Promise<void>;
    exists(callback: (err: Error, result: boolean) => void): void;
    existsAsync(): Promise<boolean>;
    version(callback: (err: Error, result: string) => void): void;
    versionAsync(): Promise<string>;
    columns(callback: (err: Error, result: Array<any>) => void): void;
    columnsAsync(): Promise<Array<any>>;
}

export declare interface MSSqlAdapterIndex {
    name: string;
    columns: Array<string>;
}

export declare interface MSSqlAdapterIndexes {
    create(name: string, columns: Array<string>, callback: (err: Error, res?: number) => void): void;
    createAsync(name: string, columns: Array<string>): Promise<number>;
    drop(name: string, callback: (err: Error, res?: number) => void): void;
    dropAsync(name: string): Promise<number>;
    list(callback: (err: Error, res: Array<MSSqlAdapterIndex>) => void): void;
    listAsync(): Promise<Array<MSSqlAdapterIndex>>;
}

export declare interface MSSqlAdapterView {
    create(query: any, callback: (err: Error) => void): void;
    createAsync(query: any): Promise<void>;
    exists(callback: (err: Error, result: boolean) => void): void;
    existsAsync(): Promise<boolean>;
    drop(callback: (err: Error) => void): void;
    dropAsync(): Promise<void>;
}

export declare interface MSSqlAdapterDatabase {
    exists(callback: (err: Error, result: boolean) => void): void;
    existsAsync(): Promise<boolean>;
    create(callback: (err: Error) => void): void;
    createAsync(): Promise<void>;
}

export declare interface MSSqlAdapterMigration {
    add: Array<any>;
    change?: Array<any>;
    appliesTo: string;
    version: string;
}

export declare class MSSqlAdapter {
    static formatType(field: any): string;
    formatType(field: any): string;
    open(callback: (err: Error) => void): void;
    close(callback: (err: Error) => void): void;
    openAsync(): Promise<void>;
    closeAsync(): Promise<void>;
    prepare(query: any, values?: Array<any>): any;
    createView(name: string, query: any, callback: (err: Error) => void): void;
    executeInTransaction(func: any, callback: (err: Error) => void): void;
    executeInTransactionAsync(func: Promise<any>): Promise<any>;
    migrate(obj: MSSqlAdapterMigration, callback: (err: Error) => void): void;
    selectIdentity(entity: string, attribute: string, callback: (err: Error, value: any) => void): void;
    execute(query: any, values: any, callback: (err: Error, value: any) => void): void;
    executeAsync(query: any, values: any): Promise<any>;
    executeAsync<T>(query: any, values: any): Promise<Array<T>>;
    table(name: string): MSSqlAdapterTable;
    view(name: string): MSSqlAdapterView;
    indexes(name: string): MSSqlAdapterIndexes;
    database(name: string): MSSqlAdapterDatabase;
}