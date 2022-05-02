import {MSSqlFormatter} from '@themost/mssql';
import {TestApplication} from './TestApplication';
import path from 'path';
// eslint-disable-next-line no-unused-vars
import { DataContext } from '@themost/data';

describe('MSSqlFormatter', () => {

    /**
     * @type {TestApplication}
     */
    let app;
    beforeAll(async () => {
        app = new TestApplication(path.resolve(__dirname));
        await app.tryCreateDatabase();
    });

    it('should create instance', async () => {
        const formatter = new MSSqlFormatter();
        expect(formatter).toBeTruthy();
    });

    it('should should use select', async () => {
        /**
         * @type {DataContext}
         */
        const context = app.createContext();
        expect(context).toBeTruthy();
        const item = await context.model('ActionStatusType')
            .where('alternateName').equal('ActiveActionStatus')
            .getItem();
        expect(item).toBeTruthy();
        expect(item.alternateName).toEqual('ActiveActionStatus');
        await context.finalizeAsync();
    });

    it('should should use limit select', async () => {
        await app.runInContext(async (context) => {
            const items = await context.model('Person').asQueryable()
                .orderBy('familyName')
                .thenBy('givenName')
                .take(10).silent().getItems();
            expect(items).toBeInstanceOf(Array);
            expect(items.length).toBe(10);
        });
    });

});