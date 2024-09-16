import { QueryEntity, QueryExpression, QueryField } from '@themost/query';
import { TestApplication } from './TestApplication';
import { Guid } from '@themost/common';

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

    it('should use toGuid()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const query = new QueryExpression().select(new QueryField({
                id: {
                    $toGuid: [
                        'Hello'
                    ]
                }
            })).from(new QueryEntity('t0'));
            query.$fixed = true;
            const [item] = await context.db.executeAsync(query);
            expect(item).toBeTruthy();
            expect(item.id.toLowerCase()).toEqual('8b1a9953-c461-1296-a827-abf8c47804d7');
        });
    });

    it('should use toGuid() with select', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Products = context.model('Product');
            const { viewAdapter: ProductView } = Products;
            const q = Products.where('category').equal('Laptops');
            q.query.select(
                new QueryField('id').from(ProductView),
                new QueryField('name').from(ProductView),
                new QueryField({
                    identifier: {
                        $toGuid: [
                            new QueryField('name').from(ProductView)
                        ]
                    }
                })
            ).take(25);
            const items = await q.getItems();
            for (const item of items) {
                expect(item.identifier).toBeTruthy();
                const sampleIdentifier = Guid.from(item.name).toString();
                expect(item.identifier.toLowerCase()).toEqual(sampleIdentifier);
            }
        });
    });

});