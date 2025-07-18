import { MSSqlFormatter } from '../src';
import { QueryExpression } from '@themost/query';
import { TestApplication } from './TestApplication';

describe('MSSqlAdapter', () => {
    /**
     * @type {TestApplication}
     */
    let app;
    beforeAll(async () => {
        app = new TestApplication(__dirname);
        await app.tryCreateDatabase();
    });
    beforeEach(async () => {
        //
    });
    afterAll(async () => {
        await app.finalizeAsync();
    });
    afterEach(async () => {
        //
    });
    it('should check database', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let exists = await context.db.database('a_test_database').existsAsync();
            expect(exists).toBeFalsy();
            exists = await context.db.database('test_db').existsAsync();
            expect(exists).toBeTruthy();
        });
    });

    it('should check table', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const exists = await context.db.table('Table1').existsAsync();
            expect(exists).toBeFalsy();
        });
    });

    it('should get tables', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const tables = await context.db.tables().listAsync();
            expect(Array.isArray(tables)).toBeTruthy();
            expect(tables.length).toBeGreaterThan(0);
            const table1 = tables.find((table) => table.name === 'UserBase');
            expect(table1).toBeTruthy();
        });
    });

    it('should get views', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const views = await context.db.views().listAsync();
            expect(Array.isArray(views)).toBeTruthy();
            expect(views.length).toBeGreaterThan(0);
            const view1 = views.find((table) => table.name === 'UserData');
            expect(view1).toBeTruthy();
        });
    });

    it('should create table', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const db = context.db;
            let exists = await db.table('Table1').existsAsync();
            expect(exists).toBeFalsy();
            await context.db.table('Table1').createAsync([
                {
                    name: 'id',
                    type: 'Counter',
                    primary: true,
                    nullable: false
                },
                {
                    name: 'name',
                    type: 'Text',
                    size: 255,
                    nullable: false
                },
                {
                    name: 'description',
                    type: 'Text',
                    size: 255,
                    nullable: true
                }
            ]);
            exists = await db.table('Table1').existsAsync();
            expect(exists).toBeTruthy();
            // get columns
            const columns = await db.table('Table1').columnsAsync();
            expect(columns).toBeInstanceOf(Array);
            let column = columns.find((col) => col.name === 'id');
            expect(column).toBeTruthy();
            expect(column.nullable).toBeFalsy();
            column = columns.find((col) => col.name === 'description');
            expect(column).toBeTruthy();
            expect(column.nullable).toBeTruthy();
            expect(column.size).toBe(255);
            await db.executeAsync(`DROP TABLE ${new MSSqlFormatter().escapeName('Table1')}`);
        });
    });

    it('should alter table', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const db = context.db;
            let exists = await db.table('Table2').existsAsync();
            expect(exists).toBeFalsy();
            await db.table('Table2').createAsync([
                {
                    name: 'id',
                    type: 'Counter',
                    primary: true,
                    nullable: false
                },
                {
                    name: 'name',
                    type: 'Text',
                    size: 255,
                    nullable: false
                }
            ]);
            exists = await db.table('Table2').existsAsync();
            expect(exists).toBeTruthy();
            await db.table('Table2').addAsync([
                {
                    name: 'description',
                    type: 'Text',
                    size: 255,
                    nullable: true
                }
            ]);
            // get columns
            let columns = await db.table('Table2').columnsAsync();
            expect(columns).toBeInstanceOf(Array);
            let column = columns.find((col) => col.name === 'description');
            expect(column).toBeTruthy();

            await db.table('Table2').changeAsync([
                {
                    name: 'description',
                    type: 'Text',
                    size: 512,
                    nullable: true
                }
            ]);
            columns = await db.table('Table2').columnsAsync();
            column = columns.find((col) => col.name === 'description');
            expect(column.size).toEqual(512);
            expect(column.nullable).toBeTruthy();
            await db.executeAsync(`DROP TABLE ${new MSSqlFormatter().escapeName('Table2')}`);
        });

    });


    it('should create view', async () => {

        await app.executeInTestTranscaction(async (context) => {
            const db = context.db;
            let exists = await db.table('Table1').existsAsync();
            expect(exists).toBeFalsy();
            await db.table('Table1').createAsync([
                {
                    name: 'id',
                    type: 'Counter',
                    primary: true,
                    nullable: false
                },
                {
                    name: 'name',
                    type: 'Text',
                    size: 255,
                    nullable: false
                },
                {
                    name: 'description',
                    type: 'Text',
                    size: 255,
                    nullable: true
                }
            ]);
            exists = await db.table('Table1').existsAsync();
            expect(exists).toBeTruthy();

            exists = await db.view('View1').existsAsync();
            expect(exists).toBeFalsy();

            const query = new QueryExpression().select('id', 'name', 'description').from('Table1');
            await db.view('View1').createAsync(query);

            exists = await db.view('View1').existsAsync();
            expect(exists).toBeTruthy();

            await db.view('View1').dropAsync();

            exists = await db.view('View1').existsAsync();
            expect(exists).toBeFalsy();
            await db.executeAsync(`DROP TABLE ${new MSSqlFormatter().escapeName('Table1')}`);
        });
    });

    it('should create index', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const db = context.db;
            let exists = await db.table('Table1').existsAsync();
            expect(exists).toBeFalsy();
            await db.table('Table1').createAsync([
                {
                    name: 'id',
                    type: 'Counter',
                    primary: true,
                    nullable: false
                },
                {
                    name: 'name',
                    type: 'Text',
                    size: 255,
                    nullable: false
                },
                {
                    name: 'description',
                    type: 'Text',
                    size: 255,
                    nullable: true
                }
            ]);
            exists = await db.table('Table1').existsAsync();
            expect(exists).toBeTruthy();

            let list = await db.indexes('Table1').listAsync();
            expect(list).toBeInstanceOf(Array);
            exists = list.findIndex((index) => index.name === 'idx_name') < 0;

            await db.indexes('Table1').createAsync('idx_name', [
                'name'
            ]);

            list = await db.indexes('Table1').listAsync();
            expect(list).toBeInstanceOf(Array);
            exists = list.findIndex((index) => index.name === 'idx_name') >= 0;
            expect(exists).toBeTruthy();

            await db.indexes('Table1').dropAsync('idx_name');

            list = await db.indexes('Table1').listAsync();
            expect(list).toBeInstanceOf(Array);
            exists = list.findIndex((index) => index.name === 'idx_name') >= 0;
            expect(exists).toBeFalsy();

            await db.executeAsync(`DROP TABLE ${new MSSqlFormatter().escapeName('Table1')}`);
        });
    });

    it('should retry a wrong query string', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const db = context.db;
            let exists = await db.table('Table1').existsAsync();
            expect(exists).toBeFalsy();
            await db.table('Table1').createAsync([
                {
                    name: 'id',
                    type: 'Counter',
                    primary: true,
                    nullable: false
                },
                {
                    name: 'name',
                    type: 'Text',
                    size: 255,
                    nullable: false
                },
                {
                    name: 'description',
                    type: 'Text',
                    size: 255,
                    nullable: true
                }
            ]);
            exists = await db.table('Table1').existsAsync();
            expect(exists).toBeTruthy();

            try {
                // this query is wrong because it does not contain a FROM clause
                await db.executeAsync('SELECT *');
            } catch (err) {
                expect(err).toBeTruthy();
            }

            // retry the query with a FROM clause
            const result = await db.executeAsync('SELECT * FROM Table1');
            expect(result).toBeTruthy();
            expect(result.length).toBe(0);

            await db.executeAsync(`DROP TABLE ${new MSSqlFormatter().escapeName('Table1')}`);
        });
    });

    it('should select identity multiple times', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const db = context.db;
            let exists = await db.table('Table1').existsAsync();
            expect(exists).toBeFalsy();
            await db.table('Table1').createAsync([
                {
                    name: 'id',
                    type: 'Integer',
                    primary: true,
                    nullable: false
                },
                {
                    name: 'name',
                    type: 'Text',
                    size: 255,
                    nullable: false
                },
                {
                    name: 'description',
                    type: 'Text',
                    size: 255,
                    nullable: true
                }
            ]);
            exists = await db.table('Table1').existsAsync();
            expect(exists).toBeTruthy();

            await db.executeAsync(new QueryExpression().insert({
                id: 1,
                name: 'Test Name #1',
                description: 'Test Description #1'
            }).into('Table1'));

            // insert a row
            let id = await db.selectIdentityAsync('Table1', 'id');
            expect(id).toBe(2);
            await db.executeAsync(new QueryExpression().insert({
                id: id,
                name: 'Test Name',
                description: 'Test Description'
            }).into('Table1'));
            id = await db.selectIdentityAsync('Table1', 'id');
            expect(id).toBe(3);
            await db.executeAsync(new QueryExpression().insert({
                id: id,
                name: 'New Test Name',
                description: 'New Test Description'
            }).into('Table1'));

        });
    });

    it('should custom identity multiple times', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const db = context.db;
            let exists = await db.table('Table2').existsAsync();
            expect(exists).toBeFalsy();
            await db.table('Table2').createAsync([
                {
                    name: 'id',
                    type: 'Integer',
                    primary: true,
                    nullable: false
                },
                {
                    name: 'name',
                    type: 'Text',
                    size: 255,
                    nullable: false
                }
            ]);
            exists = await db.table('Table2').existsAsync();
            expect(exists).toBeTruthy();

            await db.executeAsync(new QueryExpression().insert({
                id: 1,
                name: 'Test Name #1'
            }).into('Table2'));

            // insert a row
            let id = await db.selectIdentityAsync('CustomTable2', 'id');
            expect(id).toBe(2);
            await db.executeAsync(new QueryExpression().insert({
                id: id,
                name: 'Test Name'
            }).into('Table2'));
            id = await db.selectIdentityAsync('CustomTable2', 'id');
            expect(id).toBe(3);
            await db.executeAsync(new QueryExpression().insert({
                id: id,
                name: 'New Test Name'
            }).into('Table2'));

        });
    });

    it('should use custom identify of a missing column', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const db = context.db;
            let exists = await db.table('Table2').existsAsync();
            expect(exists).toBeFalsy();
            await db.table('Table2').createAsync([
                {
                    name: 'id',
                    type: 'Integer',
                    primary: true,
                    nullable: false
                },
                {
                    name: 'name',
                    type: 'Text',
                    size: 255,
                    nullable: false
                }
            ]);
            exists = await db.table('Table2').existsAsync();
            expect(exists).toBeTruthy();

            // insert a row
            let id = await db.selectIdentityAsync('Table2', 'index');
            expect(id).toBe(2);
            await db.executeAsync(new QueryExpression().insert({
                id: id,
                name: 'Test Name'
            }).into('Table2'));
            

        });
    });

});