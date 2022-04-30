import {TestApplication} from './TestApplication';
import path from 'path';
// eslint-disable-next-line no-unused-vars
import { DataContext } from '@themost/data';

describe('DataApplication', () => {

    let app;
    beforeAll(async () => {
        app = new TestApplication(path.resolve(__dirname));
        await app.tryCreateDatabase();
    });

    it('should get items', async () => {
        const context = app.createContext();
        const items = await context.model('Category').silent().getItems();
        expect(items).toBeInstanceOf(Array);
        expect(items.length).toBeGreaterThan(0);
        await context.finalizeAsync();
    });

    it('should take items', async () => {
        /**
         * @type {DataContext}
         */
        const context = app.createContext();
        const items = await context.model('Category').asQueryable()
            .orderBy('name')
            .take(5).silent()
            .getItems();
        expect(items).toBeInstanceOf(Array);
        expect(items.length).toBeGreaterThan(0);
        await context.finalizeAsync();
    });

});