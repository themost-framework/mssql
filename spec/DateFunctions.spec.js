import { TestApplication } from './TestApplication';
import moment from 'moment';
describe('DateFunctions', () => {
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
        await app.finalizeAsync();
    });
    afterEach(async () => {
        //
    });

    it('should use getDate()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getDate().equal('2019-04-15').silent().getItems();
            expect(Array.isArray(items)).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item.orderDate.getDate()).toEqual(15);
                expect(item.orderDate.getMonth()).toEqual(3);
                expect(item.orderDate.getFullYear()).toEqual(2019);
            }
        });
    });

    it('should use getDay()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getDay().equal(15).silent().getItems();
            expect(Array.isArray(items)).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item.orderDate.getDate()).toEqual(15);
            }
        });
    });

    it('should use getMonth()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getMonth().equal(4).silent().getItems();
            expect(Array.isArray(items)).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item.orderDate.getMonth()).toEqual(3);
            }
        });
    });

    it('should use getFullYear()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getFullYear().equal(2019).silent().getItems();
            expect(Array.isArray(items)).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item.orderDate.getFullYear()).toEqual(2019);
            }
        });
    });

    it('should use getHours()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getHours().equal(14).silent().getItems();
            expect(Array.isArray(items)).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item.orderDate.getHours()).toEqual(14);
            }
        });
    });

    it('should use getMinutes()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getMinutes().equal(45).silent().getItems();
            expect(Array.isArray(items)).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item.orderDate.getMinutes()).toEqual(45);
            }
        });
    });

    it('should use getSeconds()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getSeconds().equal(42).silent().getItems();
            expect(Array.isArray(items)).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item.orderDate.getSeconds()).toEqual(42);
            }
        });
    });

    it('should use datetimeoffset', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let user = await context.model('User').where('name').equal('alexis.rees@example.com')
                .silent().getItem();
            expect(user).toBeTruthy();
            const now = new Date();
            user.lastLogon = now;
            await context.model('User').silent().save(user);
            user = await context.model('User').where('name').equal('alexis.rees@example.com')
                .silent().getItem();
            expect(user.lastLogon).toEqual(now);
        });
    });

    it('should use date', async () => {
        await app.executeInTestTranscaction(async (context) => {
            // get AMD Radeon R9 290
            let product = await context.model('Product').where('name').equal('AMD Radeon R9 290')
                .silent().getItem();
            expect(product).toBeTruthy();
            const now = moment(new Date()).startOf('day').toDate();
            let releaseDate = now;
            product.releaseDate = new Date(releaseDate);
            await context.model('Product').silent().save(product);
            product = await context.model('Product').where('name').equal('AMD Radeon R9 290')
                .silent().getItem();
            expect(product.releaseDate).toEqual(now);
        });
    });

});