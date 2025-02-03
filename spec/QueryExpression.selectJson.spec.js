// noinspection SpellCheckingInspection

import {MemberExpression, MethodCallExpression, QueryEntity, QueryExpression, QueryField} from '@themost/query';
import { MSSqlFormatter } from '../src';
import SimpleOrderSchema from './config/models/SimpleOrder.json';
import {TestApplication} from './TestApplication';
import { TraceUtils } from '@themost/common';
import { DataPermissionEventListener } from '@themost/data';
import { promisify } from 'util';
const beforeExecuteAsync = promisify(DataPermissionEventListener.prototype.beforeExecute);

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
        await app.finalizeAsync();
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

    it('should use jsonObject', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const Orders = context.model('Order').silent();
            const q = Orders.select(
                'id', 'orderedItem', 'orderDate'
            ).where('customer/description').equal('Eric Thomas');
            const select = q.query.$select[Orders.viewAdapter];
            select.push({
                customer: {
                    $jsonObject: [
                        new QueryField('familyName').from('customer'),
                        new QueryField('givenName').from('customer'),
                    ]
                }
            });
            const start = Date.now();
            const items = await q.getItems();
            const end = Date.now();
            TraceUtils.log('Elapsed time: ' + (end-start) + 'ms');
            expect(items).toBeTruthy();
            for (const item of items) {
                expect(item.customer).toBeTruthy();
                expect(item.customer.familyName).toEqual('Thomas');
                expect(item.customer.givenName).toEqual('Eric');
            }
        });
    });

    it('should use jsonObject in ad-hoc queries', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const {viewAdapter: Orders} = context.model('Order');
            const {viewAdapter: Customers} = context.model('Person');
            const {viewAdapter: OrderStatusTypes} = context.model('OrderStatusType');
            const q = new QueryExpression().select(
                'id', 'orderDate'
            ).from(Orders).join(new QueryEntity(Customers).as('customers')).with(
                new QueryExpression().where(
                    new QueryField('customer').from(Orders)
                ).equal(
                    new QueryField('id').from('customers')
                )
            ).join(new QueryEntity(OrderStatusTypes).as('orderStatusTypes')).with(
                new QueryExpression().where(
                    new QueryField('orderStatus').from(Orders)
                ).equal(
                    new QueryField('id').from('orderStatusTypes')
                )
            ).where(new QueryField('description').from('customers')).equal('Eric Thomas');
            const select = q.$select[Orders];
            select.push({
                customer: {
                    $jsonObject: [
                        new QueryField('familyName').from('customers'),
                        new QueryField('givenName').from('customers'),
                    ]
                }
            }, {
                orderStatus: {
                    $jsonObject: [
                        new QueryField('name').from('orderStatusTypes'),
                        new QueryField('alternateName').from('orderStatusTypes'),
                    ]
                }
            });
            /**
             * @type {Array<{id: number, orderedItem: number, orderDate: Date, orderStatus: { name: string, alternateName: string }, customer: {familyName: string, givenName: string}}>}
             */
            const items = await context.db.executeAsync(q, []);
            expect(items).toBeTruthy();
            for (const item of items) {
                expect(item.customer).toBeTruthy();
                expect(item.customer.familyName).toEqual('Thomas');
                expect(item.customer.givenName).toEqual('Eric');
                expect(item.orderStatus).toBeTruthy();
                expect(item.orderStatus.name).toBeTruthy();
            }

        });
    });

    it('should use json queries for expand entities', async () => {
        // set context user
        context.user = {
            name: 'james.may@example.com'
          };
        let start= new Date().getTime();
        const items = await context.model('Order').asQueryable().select(
            'id', 'orderDate', 'orderStatus', 'customer', 'orderedItem'
        ).expand('customer', 'orderStatus', 'orderedItem').getItems();
        let end = new Date().getTime();
        TraceUtils.log('Elapsed time: ' + (end-start) + 'ms');
        expect(items.length).toBeTruthy();
        // create ad-hoc query
        const { viewAdapter: Orders } = context.model('Order');
        const { viewAdapter: People  } = context.model('Person');
        const { viewAdapter: Products } = context.model('Product');
        const { viewAdapter: OrderStatusTypes } = context.model('OrderStatusType');
        const personAttributes = context.model('Person').select().query.$select[People].map((x) => {
            return x.from('customer');
        });
        const productAttributes = context.model('Product').select().query.$select[Products].map((x) => {
            return x.from('orderedItem');
        });
        const orderStatusAttributes = context.model('OrderStatusType').select().query.$select[OrderStatusTypes].map((x) => {
            return x.from('orderStatus');
        });
        const q = new QueryExpression().select(
            new QueryField('id').from(Orders),
            new QueryField('orderDate').from(Orders),
            new QueryField({
                customer: {
                    $jsonObject: personAttributes
                }
            }),
            new QueryField({
                product: {
                    $jsonObject: productAttributes
                }
            }),
            new QueryField({
                orderStatus: {
                    $jsonObject: orderStatusAttributes
                }
            })
        ).from(Orders).join(new QueryEntity(People).as('customer')).with(
            new QueryExpression().where(
                new QueryField('customer').from(Orders)
            ).equal(
                new QueryField('id').from('customer')
            )
        ).join(new QueryEntity(Products).as('orderedItem')).with(
            new QueryExpression().where(
                new QueryField('orderedItem').from(Orders)
            ).equal(
                new QueryField('id').from('orderedItem')
            )
        ).join(new QueryEntity(OrderStatusTypes).as('orderStatus')).with(
            new QueryExpression().where(
                new QueryField('orderStatus').from(Orders)
            ).equal(
                new QueryField('id').from('orderStatus')
            )
        ).where(new QueryField('email').from('customer')).equal(context.user.name);

        start= new Date().getTime();
        const customerOrders = await context.db.executeAsync(q, []);
        end = new Date().getTime();
        TraceUtils.log('Elapsed time: ' + (end-start) + 'ms');
        expect(customerOrders.length).toBeTruthy();
        expect(items.length).toEqual(customerOrders.length);
    });

    it('should use json queries and validate permission', async () => {
        // set context user
        context.user = {
            name: 'james.may@example.com'
          };
        const queryOrders = context.model('Order').asQueryable().select().flatten();
        const { viewAdapter: Orders } = queryOrders.model;
        expect(queryOrders).toBeTruthy();
        // prepare query for customer
        const queryPeople = context.model('Person').asQueryable().select().flatten();
        await beforeExecuteAsync({
            model: queryPeople.model,
            emitter: queryPeople,
            query: queryPeople.query,
        });
        expect(queryPeople).toBeTruthy();
        // prepare query for order status
        const queryOrderStatus = context.model('OrderStatusType').asQueryable().select().flatten();
        await beforeExecuteAsync({
            model: queryOrderStatus.model,
            emitter: queryOrderStatus,
            query: queryOrderStatus.query,
        });
        // prepare query for ordered item
        const queryProducts = context.model('Product').asQueryable().select().flatten();
        await beforeExecuteAsync({
            model: queryProducts.model,
            emitter: queryProducts,
            query: queryProducts.query,
        });

        // phase 1: join customers in order to get customer as json object
        const { viewAdapter: People  } = queryPeople.model;
        // select customer as json object
        const selectCustomer = new QueryField({
            customer: {
                $jsonObject: queryPeople.query.$select[People].map((x) => {
                    return x.from('customer');
                })
            }
        });
        // remove select arguments from nested query and push a wildcard select
        // important note: this operation reduces the size of the subquery used for join entity
        queryPeople.query.$select[People] = [new QueryField(`${People}.*`)];
        // join entity
        queryOrders.query.join(queryPeople.query.as('customer')).with(
            new QueryExpression().where(
                new QueryField('customer').from(Orders)
            ).equal(
                new QueryField('id').from('customer')
            )
        )
        // append customer json object
        
        const selectOrders = queryOrders.query.$select[Orders];
        // remove previoulsy selected customer field
        let removeIndex = selectOrders.findIndex((x) => x instanceof QueryField && x.$name === `${Orders}.customer`);
        if (removeIndex >= 0) {
            selectOrders.splice(removeIndex, 1);
        }
        // add customer json object
        selectOrders.push(selectCustomer);

        // phase 2: join ordered items in order to get ordered item as json object
        const { viewAdapter: Products } = queryProducts.model;
        // select ordered item as json object
        const selectOrderedItem = new QueryField({
            orderedItem: {
                $jsonObject: queryProducts.query.$select[Products].map((x) => {
                    return x.from('orderedItem');
                })
            }
        });
        // remove select arguments from nested query and push a wildcard select
        // important note: this operation reduces the size of the subquery used for join entity
        queryProducts.query.$select[Products] = [new QueryField(`${Products}.*`)];
        // join entity
        queryOrders.query.join(queryProducts.query.as('orderedItem')).with(
            new QueryExpression().where(
                new QueryField('orderedItem').from(Orders)
            ).equal(
                new QueryField('id').from('orderedItem')
            )
        )
        removeIndex = selectOrders.findIndex((x) => x instanceof QueryField && x.$name === `${Orders}.orderedItem`);
        if (removeIndex >= 0) {
            selectOrders.splice(removeIndex, 1);
        }
        // add ordered json object
        selectOrders.push(selectOrderedItem);

        // phase 3: join order status in order to get order status as json object
        const { viewAdapter: OrderStatusTypes } = queryOrderStatus.model;
        // select order status as json object
        const selectOrderStatus = new QueryField({
            orderStatus: {
                $jsonObject: queryOrderStatus.query.$select[OrderStatusTypes].map((x) => {
                    return x.from('orderStatus');
                })
            }
        });
        // remove select arguments from nested query and push a wildcard select
        // important note: this operation reduces the size of the subquery used for join entity
        queryOrderStatus.query.$select[OrderStatusTypes] = [new QueryField(`${OrderStatusTypes}.*`)];
        // join entity
        queryOrders.query.join(queryOrderStatus.query.as('orderStatus')).with(
            new QueryExpression().where(
                new QueryField('orderStatus').from(Orders)
            ).equal(
                new QueryField('id').from('orderStatus')
            )
        );
        removeIndex = selectOrders.findIndex((x) => x instanceof QueryField && x.$name === `${Orders}.orderStatus`);
        if (removeIndex >= 0) {
            selectOrders.splice(removeIndex, 1);
        }
        // add order status json object
        selectOrders.push(selectOrderStatus);

        let start= new Date().getTime();
        const items = await queryOrders.getItems();
        let end = new Date().getTime();
        TraceUtils.log('Elapsed time: ' + (end-start) + 'ms');
        expect(items.length).toBeTruthy();
        for (const item of items) {
            expect(typeof item.customer).toEqual('object');
            expect(typeof item.orderedItem).toEqual('object');
        }
    });

});
