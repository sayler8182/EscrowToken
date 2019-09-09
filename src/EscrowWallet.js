const { Wallet, providers: { JsonRpcProvider } } = require("ethers");
const config = require("./config");

class EscrowWallet {
    constructor({ privateKey, mnemonic, path = config.defaultPath } = {}) {
        this._provider = new JsonRpcProvider({ url: config.url });
        this._wallet = null;

        // set wallet
        if (privateKey) { // try create from private key
            this._wallet = new Wallet(privateKey, this._provider);
        }
        else if (mnemonic) { // then try create from mnemonic
            const mnemonicWallet = Wallet.fromMnemonic(mnemonic, path);
            this._wallet = mnemonicWallet.connect(this._provider);
        }
        else { // finally try create random
            const randomWallet = Wallet.createRandom({ path });
            this._wallet = randomWallet.connect(this._provider);
        }
    }

    getAddress() {
        return this._wallet.address;
    }

    getBlockNumber() {
        return this._provider.getBlockNumber().toString();
    }

    getDetails() {
        return {
            path: this._wallet.signingKey.path,
            address: this._wallet.address,
            mnemonic: this._wallet.mnemonic,
            publicKey: this._wallet.signingKey.publicKey,
            privateKey: this._wallet.signingKey.privateKey,
        }
    }

    getWallet() {
        return this._wallet;
    }
}

module.exports = { EscrowWallet };
