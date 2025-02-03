import { QueryExpression, QueryField, QueryEntity} from '@themost/query';
import { TestApplication } from './TestApplication';

describe('ConditionExpression', () => {

    /**
     * @type {TestApplication}
     */
    let app;
    beforeAll(async () => {
        app = new TestApplication(__dirname);
        await app.tryCreateDatabase();
        await app.trySetData();
    });
    afterAll(async () => {
        await app.finalizeAsync();
    })
    
    it('should use condition in select query', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const query = new QueryExpression().select(
                'id',
                'name',
                {
                    priceDescription: {
                        $cond: [
                            {
                                $gt: [
                                    { $name: 'price' },
                                    1000
                                ]
                            },
                            'Expensive',
                            'Normal'
                        ]
                    }
                }
            ).from('ProductData').take(10)
                .where('category').equal('Laptops')
                .orderBy('price');
            const results = await context.db.executeAsync(query);
            expect(results).toBeInstanceOf(Array);
            expect(results.length).toBeTruthy();
            const values = [
                'Expensive',
                'Normal'
            ];
            for (const result of results) {
                const priceDescription = Object.getOwnPropertyDescriptor(result, 'priceDescription');
                expect(priceDescription).toBeTruthy();
                expect(values.indexOf(priceDescription.value)).toBeGreaterThanOrEqual(0);
            }
        });
        
    });

    it('should use switch expression in select query', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const priceDescription = Object.assign(new QueryField(), {
                priceDescription: {
                    $switch: {
                        branches: [
                            {
                                case: {
                                    $gt: [
                                        { $name: 'price' },
                                        1000
                                    ]
                                },
                                then: 'Expensive'
                            },
                            {
                                case: {
                                    $lt: [
                                        { $name: 'price' },
                                        500
                                    ]
                                },
                                then: 'Cheap'
                            }
                        ],
                        default: 'Normal'
                    }
                }
            });
    
            const query = new QueryExpression().select(
                'id',
                'name',
                'price',
                priceDescription
            ).from('ProductData').where('category').equal('Laptops');
            const results = await context.db.executeAsync(query);
            expect(results).toBeInstanceOf(Array);
            expect(results.length).toBeTruthy();
            const values = [
                'Expensive',
                'Normal',
                'Cheap'
            ];
            for (const result of results) {
                const priceDescriptionValue = Object.getOwnPropertyDescriptor(result, 'priceDescription');
                expect(priceDescriptionValue).toBeTruthy();
                expect(values.indexOf(priceDescriptionValue.value)).toBeGreaterThanOrEqual(0);
            }
        });
        
    });
    
    it('should use condition closure', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Products = new QueryEntity('ProductData');
            let a = new QueryExpression().select( x => {
                // noinspection RedundantConditionalExpressionJS
                return {
                    expensive: x.price > 500 ? true : false
                }
            }).from(Products).take(10);
            let results = await context.db.executeAsync(a);
            expect(results.length).toBeTruthy();
        });
    });

    it('should use condition with sub-conditions closure', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Products = new QueryEntity('ProductData');
            let a = new QueryExpression().select( x => {
                // noinspection RedundantConditionalExpressionJS
                return {
                    priceCategory: x.price > 500 ? (x.price < 1000 ? 1 : 2) : 0
                }
            }).from(Products).take(10);
            let results = await context.db.executeAsync(a);
            expect(results.length).toBeTruthy();
        });
    });

});