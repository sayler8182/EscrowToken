const ganache = require("../truffle");
const config = ganache.networks.ganache;

module.exports = {
    url: `http://${config.host}:${config.port}`,
    defaultPath: "m/44'/60'/0'/0/0",
    defaultPathForIndex: (index) => `m/44'/60'/0'/0/${index}`,
    exampleMnemonic: config.mnemonic,
    minConfirmationsRequired: 1,
}