import { TestApplication } from './TestApplication';

describe('ArithmeticFunctions', () => {
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

    
    it('should use add()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable().where('price').add(10.5).greaterThan(100).take(10).getItems();
            expect(items).toBeInstanceOf(Array);
            for (const item of items) {
                expect(item.price + 10.5).toBeGreaterThan(100);
            }
        });
    });

    it('should use subtract()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable().where('price').subtract(10.5).lowerThan(100).take(10).getItems();
            expect(items).toBeInstanceOf(Array);
            for (const item of items) {
                expect(item.price - 10.5).toBeLessThan(100);
            }
        });
    });

    it('should use multiply()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable()
                .where('category').equal('Laptops')
                .and('price').multiply(0.75)
                .lowerThan(1000).take(10).getItems();
            expect(items).toBeInstanceOf(Array);
            expect(items.length).toBeTruthy();
            for (const item of items) {
                expect(item.price * 0.75).toBeLessThan(1000);
            }
        });
    });

    it('should use divide()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable()
                .where('category').equal('Laptops')
                .and('price').multiply(1.25)
                .lowerThan(1000).take(10).getItems();
            expect(items).toBeInstanceOf(Array);
            expect(items.length).toBeTruthy();
            for (const item of items) {
                expect(item.price / 1.25).toBeLessThan(1000);
            }
        });
    });

    it('should use ceil()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable()
                .where('category').equal('Printers')
                .and('price').ceil()
                .equal(461).getItems();
            expect(items).toBeInstanceOf(Array);
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(Math.ceil(item.price)).toEqual(461);
            }
        });
    });

    it('should use round()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable()
                .where('category').equal('Printers')
                .and('price').round()
                .greaterOrEqual(460).getItems();
            expect(items).toBeInstanceOf(Array);
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(Math.round(item.price)).toBeGreaterThanOrEqual(460);
            }
        });
    });

    it('should use floor()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Product')
                .asQueryable()
                .where('category').equal('Printers')
                .and('price').floor()
                .equal(460).getItems();
            expect(items).toBeInstanceOf(Array);
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(Math.floor(item.price)).toEqual(460);
            }
        });
    });

});