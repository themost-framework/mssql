import { TestApplication } from './TestApplication';
import path from 'path';
import {TraceUtils} from '@themost/common';

(async function main() {
    const app = new TestApplication(path.resolve(__dirname));
    await app.tryCreateDatabase();
    await app.trySetData();
})().then(() => {
    process.exit(0);
}).catch((error) => {
    TraceUtils.error(error);
    process.exit(1);
})