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

    afterAll(async () => {
        await app.finalize();
    })

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
        await app.executeInTestContext(async (context) => {
            const items = await context.model('Person').asQueryable()
                .orderBy('id')
                .take(5).silent().getItems();
            expect(items).toBeInstanceOf(Array);
            expect(items.length).toBe(5);
            const moreItems = await context.model('Person').asQueryable()
                .orderBy('id')
                .take(1).skip(5).silent().getItems();
            expect(moreItems.length).toBe(1);
            const nextItem = moreItems[0];
            for (const item of items) {
                expect(nextItem.id).toBeGreaterThan(item.id);
            }
        });        
    });

    it('should use insert', async () => {
        await app.executeInTestTranscaction(async (context) => {

            const insertUser = {
                name: 'user1@example.com',
                description: 'Test User',
                groups: [
                    {
                        name: 'Users'
                    }
                ]
            };
            await context.model('User').silent().insert(insertUser);
            let newUser = await context.model('User').where('name').equal('user1@example.com').silent().getItem();
            expect(newUser).toBeTruthy();
            expect(newUser.id).toEqual(insertUser.id);
        });
    });

});