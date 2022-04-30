import path from 'path';
require('module-alias').addAliases({
    '@themost/mssql': path.resolve(__dirname, '../../src/index')
});