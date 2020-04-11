const {MSSqlFormatter} = require('../index');

describe('MSSqlFormatter', () => {

    it('should create instance', async () => {
        const formatter = new MSSqlFormatter();
        expect(formatter).toBeTruthy();
    });

});