const { QueryEntity, QueryExpression, QueryField } = require('@themost/query');
const { MSSqlAdapter } = require('../index');
const moment = require('moment/moment');
const { tryCreateTestDatabase, tryDropTestDatabase, testConnectionOptions } = require('./utils');

describe('Type Casting', () => {

    /**
     * @type {MSSqlAdapter}
     */
    let db;
    beforeAll(async () => {
        /**
         * @type {MSSqlAdapter}
         */
        db = new MSSqlAdapter(testConnectionOptions);
        await tryCreateTestDatabase();
    });
    afterAll(async () => {
        await tryDropTestDatabase();
        await db.closeAsync();
    });

    it('should use uuid()', async () => {
        const query = new QueryExpression().select(new QueryField({
            id: {
                $uuid: []
            }
        })).from(new QueryEntity('t0'));
        query.$fixed = true;
        const [item] = await db.executeAsync(query, []);
        expect(item).toBeTruthy();
        expect(item.id).toBeTruthy();
    });

    it('should use getDate()', async () => {
        const query = new QueryExpression().select(new QueryField({
            currentDate: {
                $getDate: [
                    'date'
                ]
            }
        })).from(new QueryEntity('t0'));
        query.$fixed = true;
        const [item] = await db.executeAsync(query, []);
        expect(item).toBeTruthy();
        expect(item.currentDate instanceof Date).toBeTruthy();
    });

    it('should use toGuid()', async () => {
        const query = new QueryExpression().select(new QueryField({
            id: {
                $toGuid: [
                    'Hello'
                ]
            }
        })).from(new QueryEntity('t0'));
        query.$fixed = true;
        const [item] = await db.executeAsync(query, []);
        expect(item).toBeTruthy();
        expect(item.id.toLowerCase()).toEqual('8b1a9953-c461-1296-a827-abf8c47804d7');
    });

    it('should use $toString()', async () => {
        const query = new QueryExpression().select(new QueryField({
            priceStr: {
                $toString: [
                    120.25
                ]
            }
        })).from(new QueryEntity('t0'));
        query.$fixed = true;
        const [item] = await db.executeAsync(query, []);
        expect(item).toBeTruthy();
        expect(item.priceStr).toEqual('120.25');
    });

    it('should use $toInt()', async () => {
        const query = new QueryExpression().select(new QueryField({
            priceInt: {
                $toInt: [
                    '120.25'
                ]
            }
        })).from(new QueryEntity('t0'));
        query.$fixed = true;
        const [item] = await db.executeAsync(query, []);
        expect(item).toBeTruthy();
        expect(item.priceInt).toEqual(120);
    });

    it('should use $toDouble()', async () => {
        const query = new QueryExpression().select(new QueryField({
            priceDouble: {
                $toDouble: [
                    '120.25'
                ]
            }
        })).from(new QueryEntity('t0'));
        query.$fixed = true;
        const [item] = await db.executeAsync(query, []);
        expect(item).toBeTruthy();
        expect(item.priceDouble).toEqual(120.25);
    });

    it('should use getDate()', async () => {
        const query = new QueryExpression().select(new QueryField({
            currentDate: {
                $getDate: [
                    'datetime'
                ]
            }
        })).from(new QueryEntity('t0'));
        query.$fixed = true;
        const [item] = await db.executeAsync(query, []);
        expect(item).toBeTruthy();
        const now = new Date();
        const { currentDate } = item;
        expect(currentDate).toBeTruthy();
        expect(moment(now).format('YYYY-MM-DD'))
            .toEqual(moment(currentDate).format('YYYY-MM-DD'));
    });
});