import {TestApplication} from './TestApplication';
import path from 'path';

describe('DataApplication', () => {

    it('should create instance', async () => {
        const app = new TestApplication(path.resolve(__dirname));
        expect(app).toBeTruthy();
        const context = app.createContext();
        const model = context.model('Category');
        expect(model).toBeTruthy();
    });

});