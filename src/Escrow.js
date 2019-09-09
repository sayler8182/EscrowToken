const { Wallet, Contract, ContractFactory, utils: { BigNumber, formatEther, parseEther, parseUnits } } = require("ethers");
const { EscrowWallet } = require("./EscrowWallet");
const EscrowContract = require("../build/contracts/Escrow.json");
const config = require("./config");

const STATUS_NAME = {
    INITIATED: "INITIATED",
    PENDING: "PENDING",
    DISPUTE: "DISPUTE",
    CANCELLED: "CANCELLED",
    REJECTED: "REJECTED",
    SUCCESS: "SUCCESS",
};

const STATUS_CODE = {
    0: "INITIATED",
    1: "PENDING",
    2: "DISPUTE",
    3: "CANCELLED",
    4: "REJECTED",
    5: "SUCCESS",
};

class Escrow {
    constructor(wallet, { contractAddress } = {}) {
        this._contract = null;
        this._wallet = null;

        // set wallet
        if (wallet instanceof EscrowWallet) {
            this._wallet = wallet.getWallet();
        } else if (wallet instanceof Wallet) {
            this._wallet = wallet
        } else {
            throw new Error('Invalid Wallet')
        }

        // create contract 
        if (contractAddress) { // exist contract 
            this._contract = new Contract(contractAddress, EscrowContract.abi, this._wallet);
        }
    }

    getAddress() {
        return this._contract.address;
    }

    getFactory() {
        return new ContractFactory(EscrowContract.abi, EscrowContract.bytecode, this._wallet);
    }

    async getDetails() {
        const details = await this._contract.getDetails();
        return {
            creator: details.creator,
            broker: details.broker,
            recipient: details.recipient,
            notes: details.notes,
            brokerFee: formatEther(details.brokerFee),
            amount: formatEther(details.amount),
            status: STATUS_CODE[details.status],
        }
    }

    async getStatus() {
        const status = await this._contract.getStatus();
        return STATUS_CODE[status];
    }

    // start escrow

    async startEscrow({ recipientAddress, brokerAddress, amount, fee, notes }) {
        // deploy contract
        const factory = this.getFactory();
        const transaction = factory.getDeployTransaction(
            brokerAddress,
            recipientAddress,
            fee * 100,
            notes,
            {
                value: parseUnits(amount.toString(), 18),
            },
        );

        // deploy
        const deploy = await this._wallet.sendTransaction(transaction);
        const transactionResult = await deploy.wait(config.minConfirmationsRequired);

        // save new contract
        this._contract = new Contract(transactionResult.contractAddress, EscrowContract.abi, this._wallet);
    }

    // status modification

    async accept() {
        const tx = await this._contract.accept();
        await tx.wait(config.minConfirmationsRequired)
    }

    async cancel() {
        const tx = await this._contract.cancel();
        await tx.wait(config.minConfirmationsRequired)
    }

    async confirm() {
        const tx = await this._contract.confirm();
        await tx.wait(config.minConfirmationsRequired)
    }

    async dispute() {
        const tx = await this._contract.dispute();
        await tx.wait(config.minConfirmationsRequired)
    }

    async confirmDispute() {
        const tx = await this._contract.confirmDispute();
        await tx.wait(config.minConfirmationsRequired)
    }

    async rejectDispute() {
        const tx = await this._contract.rejectDispute();
        await tx.wait(config.minConfirmationsRequired)
    }

    // withdraw

    async availableWithdraw() {
        const amount = await this._contract.availableWithdraw();
        return formatEther(amount);
    }

    async withdraw() {
        const tx = await this._contract.withdraw();
        await tx.wait(config.minConfirmationsRequired)
    }
}

module.exports = {
    Escrow,
    STATUS_NAME,
    STATUS_CODE,
};