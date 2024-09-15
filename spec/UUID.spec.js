import { QueryEntity, QueryExpression, QueryField } from '@themost/query';
import { TestApplication } from './TestApplication';

describe('UUID', () => {
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

    it('should use uuid()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const query = new QueryExpression().select(new QueryField({
                id: {
                    $uuid: []
                }
            })).from(new QueryEntity('t0'));
            query.$fixed = true;
            const [item] = await context.db.executeAsync(query);
            expect(item).toBeTruthy();
            expect(item.id).toBeTruthy();
        });
    });

});