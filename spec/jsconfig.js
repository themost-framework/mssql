const { addAliases } = require('module-alias');
const jsconfig = require('../jsconfig.json');
const path = require('path');

const baseUrl = jsconfig.compilerOptions && jsconfig.compilerOptions.baseUrl || '.';
const paths = jsconfig.compilerOptions && jsconfig.compilerOptions.paths;
const aliases = Object.keys(paths).reduce((previousValue, currentValue) => {
    const [currentPath] = paths[currentValue];
    Object.assign(previousValue, {
        [currentValue]: path.resolve(process.cwd(), baseUrl, currentPath)
    });
    return previousValue;
}, {});
addAliases(aliases);