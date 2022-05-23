import { TestApplication } from './TestApplication';

describe('StringFunctions', () => {
    /**
     * @type {TestApplication}
     */
    let app;
    beforeAll(async () => {
        app = new TestApplication(__dirname);
        await app.tryCreateDatabase();
        await app.trySetData();
        
    });
    beforeEach(async () => {
        //
    });
    afterAll(async () => {
        await app.finalize();
    });
    afterEach(async () => {
        //
    });

    it('should use indexOf()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable().where('name').substr(0, 2).equal('Ap').getItems();
            expect(items).toBeInstanceOf(Array);
            for (const item of items) {
                expect(item.name.substr(0, 2)).toEqual('Ap');
            }
        });
    });

    it('should use startsWith()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable().where('name').startsWith('Apple').equal(true).getItems();
            expect(items).toBeInstanceOf(Array);
            for (const item of items) {
                expect(item.name.startsWith('Apple')).toBeTruthy();
            }
        });
    });

    it('should use lower()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable().where('name').toLowerCase().equal('apple ipad air').getItems();
            expect(items).toBeInstanceOf(Array);
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item.name.toLowerCase()).toEqual('apple ipad air');
            }
        });
    });

    it('should use upper()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable().where('name').toUpperCase().equal('APPLE IPAD AIR').getItems();
            expect(items).toBeInstanceOf(Array);
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item.name.toUpperCase()).toEqual('APPLE IPAD AIR');
            }
        });
    });

    it('should use endsWith()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable().where('name').endsWith('Touch').equal(true).getItems();
            expect(items).toBeInstanceOf(Array);
            for (const item of items) {
                expect(item.name.endsWith('Touch')).toBeTruthy();
            }
        });
    });

    it('should use length()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable().where('name').length().equal(14).getItems();
            expect(items).toBeInstanceOf(Array);
            for (const item of items) {
                expect(item.name.length).toEqual(14);
            }
        });
    });

    it('should use substr()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable().where('name').indexOf('Apple').greaterOrEqual(0).getItems();
            expect(items).toBeInstanceOf(Array);
            for (const item of items) {
                expect(item.name.indexOf('Apple')).toBeGreaterThanOrEqual(0);
            }
        });
    });

    it('should use indexOf()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable().where('name').substr(0, 2).equal('Ap').getItems();
            expect(items).toBeInstanceOf(Array);
            for (const item of items) {
                expect(item.name.substr(0, 2)).toEqual('Ap');
            }
        });
    });

    it('should use contains()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable().where('name').contains('iMac').equal(true).getItems();
            expect(items).toBeInstanceOf(Array);
            for (const item of items) {
                expect(item.name.includes('iMac')).toBeTruthy();
            }
        });
    });


});