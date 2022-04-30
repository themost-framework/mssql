import {DataApplication} from '@themost/data';
import path from 'path';

describe('DataApplication', () => {

    it('should create instance', async () => {
        const app = new DataApplication(path.resolve(__dirname));
        expect(app).toBeTruthy();
        const context = app.createContext();
        const model = context.model('Category');
        expect(model).toBeTruthy();
    });

});