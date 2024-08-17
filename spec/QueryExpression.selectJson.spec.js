// noinspection SpellCheckingInspection

import {MemberExpression, MethodCallExpression, QueryEntity, QueryExpression} from '@themost/query';
import { MSSqlFormatter } from '../src';
import SimpleOrderSchema from './config/models/SimpleOrder.json';
import {TestApplication} from './TestApplication';

/**
 * @param { import('../src').MSSqlFormatter } db
 * @returns {Promise<void>}
 */
async function createSimpleOrders(db) {
    const { source } = SimpleOrderSchema;
    const exists = await db.table(source).existsAsync();
    if (!exists) {
        await db.table(source).createAsync(SimpleOrderSchema.fields);
    }
    // get some orders
    const orders = await db.executeAsync(
        new QueryExpression().from('OrderBase').select(
            ({orderDate, discount, discountCode, orderNumber, paymentDue,
                 dateCreated, dateModified, createdBy, modifiedBy,
                 orderStatus, orderedItem, paymentMethod, customer}) => {
                return { orderDate, discount, discountCode, orderNumber, paymentDue,
                    dateCreated, dateModified, createdBy, modifiedBy,
                    orderStatus, orderedItem, paymentMethod, customer};
            })
            .orderByDescending((x) => x.orderDate).take(10), []
    );
    const paymentMethods = await db.executeAsync(
        new QueryExpression().from('PaymentMethodBase').select(
            ({id, name, alternateName, description}) => {
                return { id, name, alternateName, description };
            }), []
    );
    const orderStatusTypes = await db.executeAsync(
        new QueryExpression().from('OrderStatusTypeBase').select(
            ({id, name, alternateName, description}) => {
                return { id, name, alternateName, description };
        }), []
    );
    const orderedItems = await db.executeAsync(
        new QueryExpression().from('ProductData').select(
            ({id, name, category, model, releaseDate, price}) => {
                return { id, name, category, model, releaseDate, price };
            }), []
    );
    const customers = await db.executeAsync(
        new QueryExpression().from('PersonData').select(
            ({id, familyName, givenName, jobTitle, email, description, address}) => {
                return { id, familyName, givenName, jobTitle, email, description, address };
            }), []
    );
    const postalAddresses = await db.executeAsync(
        new QueryExpression().from('PostalAddressData').select(
            ({id, streetAddress, postalCode, addressLocality, addressCountry, telephone}) => {
                return {id, streetAddress, postalCode, addressLocality, addressCountry, telephone };
            }), []
    );
    // get
    const items = orders.map((order) => {
        const { orderDate, discount, discountCode, orderNumber, paymentDue,
        dateCreated, dateModified, createdBy, modifiedBy } = order;
        const orderStatus = orderStatusTypes.find((x) => x.id === order.orderStatus);
        const orderedItem = orderedItems.find((x) => x.id === order.orderedItem);
        const paymentMethod = paymentMethods.find((x) => x.id === order.paymentMethod);
        const customer = customers.find((x) => x.id === order.customer);
        if (customer) {
            customer.address = postalAddresses.find((x) => x.id === customer.address);
            delete customer.address?.id;
        }
        return {
            orderDate,
            discount,
            discountCode,
            orderNumber,
            paymentDue,
            orderStatus,
            orderedItem,
            paymentMethod,
            customer,
            dateCreated,
            dateModified,
            createdBy,
            modifiedBy
        }
    });
    for (const item of items) {
        await db.executeAsync(new QueryExpression().insert(item).into(source), []);
    }
}

/**
 *
 * @param {{object: any, member: any, target: { $collection: string }, fullyQualifiedMember: string}} event
 */
function onResolvingJsonMember(event) {
    let member = event.fullyQualifiedMember.split('.');
    const field = SimpleOrderSchema.fields.find((x) => x.name === member[0]);
    if (field == null) {
        return;
    }
    if (field.type !== 'Json') {
        return;
    }
    event.object = event.target.$collection;
    // noinspection JSCheckFunctionSignatures
    event.member = new MethodCallExpression('jsonGet', [
        new MemberExpression(event.target.$collection + '.' + event.fullyQualifiedMember)
    ]);
}

describe('SqlFormatter', () => {

    /**
     * @type {TestApplication}
     */
    let app;
    let context;
    beforeAll(async () => {
        app = new TestApplication(__dirname);
        context = app.createContext();
        const {db} = context;
        await createSimpleOrders(db);
    });
    beforeEach(async () => {
        await context.finalizeAsync();
    });

    it('should select json field', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Orders = new QueryEntity('SimpleOrders');
            const query = new QueryExpression();
            query.resolvingJoinMember.subscribe(onResolvingJsonMember);
            query.select((x) => {
                // noinspection JSUnresolvedReference
                return {
                    id: x.id,
                    customer: x.customer.description
                }
            })
                .from(Orders);
            const formatter = new MSSqlFormatter();
            const sql = formatter.format(query);
            /**
             * @type {Array<{id: number, customer: string}>}
             */
            const results = await context.db.executeAsync(sql, []);
            expect(results).toBeTruthy();
            for (const result of results) {
                expect(result).toBeTruthy();
                expect(result.id).toBeTruthy();
                expect(result.customer).toBeTruthy();
            }
        });
    });

    it('should select nested json field', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Orders = new QueryEntity('SimpleOrders');
            const query = new QueryExpression();
            query.resolvingJoinMember.subscribe(onResolvingJsonMember);
            query.select((x) => {
                // noinspection JSUnresolvedReference
                return {
                    id: x.id,
                    customer: x.customer.description,
                    address: x.customer.address.streetAddress
                }
            })
                .from(Orders);
            const formatter = new MSSqlFormatter();
            const sql = formatter.format(query);
            /**
             * @type {Array<{id: number, customer: string}>}
             */
            const results = await context.db.executeAsync(sql, []);
            expect(results).toBeTruthy();
            for (const result of results) {
                expect(result).toBeTruthy();
                expect(result.id).toBeTruthy();
                expect(result.customer).toBeTruthy();
            }
        });
    });

    it('should select nested json field with method', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Orders = new QueryEntity('SimpleOrders');
            const query = new QueryExpression();
            query.resolvingJoinMember.subscribe(onResolvingJsonMember);
            query.select((x) => {
                // noinspection JSUnresolvedReference
                return {
                    id: x.id,
                    customer: x.customer.description,
                    releaseYear: x.orderedItem.releaseDate.getFullYear()
                }
            })
                .from(Orders);
            const formatter = new MSSqlFormatter();
            const sql = formatter.format(query);
            /**
             * @type {Array<{id: number, customer: string, releaseYear: number}>}
             */
            const results = await context.db.executeAsync(sql, []);
            expect(results).toBeTruthy();
            for (const result of results) {
                expect(result).toBeTruthy();
                expect(result.releaseYear).toBeTruthy();
            }
        });
    });

    it('should select json object', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Orders = new QueryEntity('SimpleOrders');
            const query = new QueryExpression();
            query.resolvingJoinMember.subscribe(onResolvingJsonMember);
            query.select((x) => {
                // noinspection JSUnresolvedReference
                return {
                    id: x.id,
                    customer: x.customer,
                    orderedItem: x.orderedItem
                }
            })
                .from(Orders);
            const formatter = new MSSqlFormatter();
            const sql = formatter.format(query);
            /**
             * @type {Array<{id: number, customer: string, releaseYear: number}>}
             */
            const results = await context.db.executeAsync(sql, []);
            expect(results).toBeTruthy();
            for (const result of results) {
                if (typeof result.customer === 'string') {
                    const customer = JSON.parse(result.customer);
                    expect(customer).toBeTruthy();
                }
            }
        });
    });

    it('should select and return attribute from json field using closures', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Orders = context.model('SimpleOrder').silent();
            const results = await Orders.select((x) => {
                return {
                    id: x.id,
                    customer: x.customer.description,
                    streetAddress: x.customer.address.streetAddress,
                    releaseYear: x.orderedItem.releaseDate.getFullYear()
                }
            }).getItems();
            expect(results).toBeTruthy();
            for (const result of results) {
                expect(result).toBeTruthy();
                expect(result.releaseYear).toBeTruthy();
            }
        });
    });

    it('should filter results using attribute extracted from json field', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Orders = context.model('SimpleOrder').silent();
            const results = await Orders.select((x) => {
                return {
                    id: x.id,
                    customerIdentifier: x.customer.id,
                    customer: x.customer.description
                }
            })
                .where((x) => x.customer.description === 'Eric Thomas')
                .getItems();
            expect(results).toBeTruthy();
            for (const result of results) {
                expect(result).toBeTruthy();
                expect(result.customer).toEqual('Eric Thomas');
            }
        });
    });

    it('should select and return attribute from json field', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Orders = context.model('SimpleOrder').silent();
            const q = await Orders.filterAsync({
                $select: 'id,customer/description as customer,year(orderedItem/releaseDate) as releaseYear',
            })
            const results = await q.getItems();
            expect(results).toBeTruthy();
            for (const result of results) {
                expect(result).toBeTruthy();
                expect(result.releaseYear).toBeTruthy();
            }
        });
    });

    it('should filter using attribute from json field', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Orders = context.model('SimpleOrder').silent();
            const q = await Orders.filterAsync({
                $select: 'id,customer/id as customerIdentifier, customer/description as customer,year(orderedItem/releaseDate) as releaseYear',
                $filter: 'customer/description eq \'Eric Thomas\''
            })
            const results = await q.getItems();
            expect(results).toBeTruthy();
            for (const result of results) {
                expect(result).toBeTruthy();
                expect(result.customer).toEqual('Eric Thomas');
            }
        });
    });

});
