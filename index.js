import { AppHelper } from './modules/AppHelper.js'

const appHelper = new AppHelper(process.argv);

process.stdin.on('data', chunk => {
    const str = chunk.toString().trim();

    appHelper.navigateHandtler(str);
})

process.on('SIGINT', appHelper.exitHandler.bind(appHelper))