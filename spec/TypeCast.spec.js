import { QueryEntity, QueryExpression, QueryField } from '@themost/query';
import { TestApplication } from './TestApplication';
import { MSSqlFormatter } from '../src/MSSqlFormatter';
import { Guid } from '@themost/common';

describe('Type Casting', () => {

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

    it('should use toGuid() in select statement', async () => {
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
    
    it('should use $toString function', async () => {
        const Product = new QueryEntity('ProductData');
        const Order = new QueryEntity('OrderData');
        const id = new QueryField('id').from(Product);
        let orderedItem = new QueryField('orderedItem').from(Order);
        let expr = new QueryExpression().where(id).equal(orderedItem);
        const formatter = new MSSqlFormatter();
        let sql = formatter.formatWhere(expr.$where);
        expect(sql).toEqual('([ProductData].[id]=[OrderData].[orderedItem])');
        orderedItem =new QueryField({
            '$toString': [
                new QueryField('orderedItem').from(Order)
            ]
        });
        expr = new QueryExpression().where(id).equal(orderedItem);
        sql = formatter.formatWhere(expr.$where);
        expect(sql).toEqual('([ProductData].[id]=CAST([OrderData].[orderedItem] AS NVARCHAR))');
    });

    it('should use $toString inside closure', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Products = new QueryEntity('ProductData');
            const q = new QueryExpression().select(({id, name, price}) => {
                return {
                    id,
                    price,
                    priceString: price.toString(),
                    name
                }
            }).from(Products);
            const items = await context.db.executeAsync(q);
            items.forEach(({price, priceString}) => {
                expect(typeof priceString).toEqual('string');
                const fromString = parseFloat(priceString);
                expect(price).toEqual(fromString);
            });
        });
    });

    it('should use $toInt inside closure', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Products = new QueryEntity('ProductData');
            const q = new QueryExpression().select(({id, name, price}) => {
                return {
                    id,
                    price,
                    priceInt: parseInt(price),
                    name
                }
            }).from(Products);
            const items = await context.db.executeAsync(q);
            items.forEach(({price, priceInt}) => {
                expect(typeof priceInt).toEqual('number');
                const fromInt = parseInt(price);
                expect(priceInt).toEqual(fromInt);
            });
        });
    });

    it('should use $toDouble inside closure', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Products = new QueryEntity('ProductData');
            const q = new QueryExpression().select(({id, name, price}) => {
                return {
                    id,
                    price,
                    priceFloat: parseFloat(price),
                    name
                }
            }).from(Products);
            const items = await context.db.executeAsync(q);
            items.forEach(({price, priceFloat}) => {
                const fromFloat = parseFloat(price);
                expect(priceFloat).toEqual(fromFloat);
            });
        });
    });
});