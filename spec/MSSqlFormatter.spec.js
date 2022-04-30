const {MSSqlFormatter} = require('@themost/mssql');

describe('MSSqlFormatter', () => {

    it('should create instance', async () => {
        const formatter = new MSSqlFormatter();
        expect(formatter).toBeTruthy();
    });

});