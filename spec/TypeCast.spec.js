import { QueryEntity, QueryExpression, QueryField } from '@themost/query';
import { TestApplication } from './TestApplication';
import { MSSqlFormatter } from '../src/MSSqlFormatter';

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
});