const { Contract, ContractFactory, Wallet, providers: { JsonRpcProvider } } = require("ethers");
const ganache = require("./../../../truffle");
const EscrowToken = require("./../../../build/contracts/EscrowToken");
const Escrow = require("./../../../build/contracts/Escrow");
const { assertPromiseEqual, assertPromiseReverts } = require("../utils");
const { parseLogs } = require("../logs");
const {
    ownerPrivateKey, owner,
    user1PrivateKey, user1,
    user2PrivateKey, user2,
    user3PrivateKey, user3,
} = require("../config");

const STATUS = {
    INITIATED: 0,
    PENDING: 1,
    DISPUTE: 2,
    CANCELLED: 3,
    SUCCESS: 4,
};

const ACTION = {
    CREATOR_ACCEPT: "CREATOR_ACCEPT",
    CREATOR_CANCEL: "CREATOR_CANCEL",
    CREATOR_OPEN_DISPUTE: "CREATOR_OPEN_DISPUTE",
    BROKER_ACCEPT_PARTICIPATION: "BROKER_ACCEPT_PARTICIPATION",
    BROKER_REJECT_PARTICIPATION: "BROKER_REJECT_PARTICIPATION",
    BROKER_COMMIT: "BROKER_COMMIT",
    BROKER_ACCEPT: "BROKER_ACCEPT",
    BROKER_REVOKE: "BROKER_REVOKE",
};

const EVENT = {
    ESCROW_CREATED: "EscrowCreated",
    ESCROW_STATUS_CHANGED: "EscrowStatusChanged"
};

// get provider
const getProvider = () => {
    const config = ganache.networks.ganache;
    return new JsonRpcProvider({ url: `http://${config.host}:${config.port}` });
};

// get wallet
const getWallet = (privateKey) => {
    const provider = getProvider();
    return new Wallet(privateKey, provider);
}

// deploy
const deploy = async () => {
    const wallet = getWallet(ownerPrivateKey);
    const tokenFactory = new ContractFactory(EscrowToken.abi, EscrowToken.bytecode, wallet);
    const escrowFactory = new ContractFactory(Escrow.abi, Escrow.bytecode, wallet);
    const token = await tokenFactory.deploy();
    const escrow = await escrowFactory.deploy();
    return { token, escrow };
};

// auto deploy
const autoDeploy = async () => {
    const { token, escrow } = await deploy();
    await escrow.setToken(token.address);
    return escrow;
};

// auto deploy with deposit
const autoDeployWithDeposit = async (privateKeys, amount) => {
    const { token, escrow } = await deploy();
    await escrow.setToken(token.address);
    for (const privateKey of privateKeys) {
        const userWallet = getWallet(privateKey);
        const userToken = new Contract(token.address, EscrowToken.abi, userWallet);
        const userEscrow = new Contract(escrow.address, Escrow.abi, userWallet);
        await token.mint(userWallet.address, amount);
        await userToken.approve(userEscrow.address, amount);
        await userEscrow.deposit(amount);
    }
    return escrow;
};

// auto start escrow
const autoStartEscrow = async (amount = '100', fee = '100') => {
    const escrow = await autoDeployWithDeposit([user1PrivateKey], amount);
    const user1Escrow = new Contract(escrow.address, Escrow.abi, getWallet(user1PrivateKey));
    const user2Escrow = new Contract(escrow.address, Escrow.abi, getWallet(user2PrivateKey));
    const user3Escrow = new Contract(escrow.address, Escrow.abi, getWallet(user3PrivateKey));
    const transaction = await user1Escrow.startEscrow(
        user2,
        user3,
        amount,
        fee,
        "Some note",
    );
    const receipt = await transaction.wait();
    const id = receipt.events[0].args.escrowId;
    return { id, user1Escrow, user2Escrow, user3Escrow };
};

// check balances
const checkBalances = async (escrows, balances = []) => {
    const escrowsKeys = Object.keys(escrows).filter((k) => k.includes("Escrow"));
    for (let i = 0; i < escrowsKeys.length; i++) {
        const escrow = escrows[escrowsKeys[i]];
        const balance = balances[i] || [0, 0];
        await assertPromiseEqual(escrow.getBalance(), balance[0], `Incorrect balance for ${escrowsKeys[i]}`);
        await assertPromiseEqual(escrow.getLockBalance(), balance[1], `Incorrect lock balance for ${escrowsKeys[i]}`);
    }
};

// check status
const checkStatus = async (escrows, status) => {
    const escrowsKeys = Object.keys(escrows).filter((k) => k.includes("Escrow"));;
    for (let i = 0; i < escrowsKeys.length; i++) {
        const escrow = escrows[escrowsKeys[i]];
        await assertPromiseEqual(escrow.getStatus(escrows.id), status, `Incorrect status for ${escrowsKeys[i]}`);
    }
};

// check actions
const checkActions = async (escrows, actions = []) => {
    const escrowsKeys = Object.keys(escrows).filter((k) => k.includes("Escrow"));;
    for (let i = 0; i < escrowsKeys.length; i++) {
        const escrow = escrows[escrowsKeys[i]];
        const escrowActions = actions[i] || [];
        if (!escrowActions.includes(ACTION.CREATOR_ACCEPT)) {
            await assertPromiseReverts(escrow.creatorAcceptTransaction(escrows.id), null, ACTION.CREATOR_ACCEPT);
        }
        if (!escrowActions.includes(ACTION.CREATOR_CANCEL)) {
            await assertPromiseReverts(escrow.creatorCancelTransaction(escrows.id), null, ACTION.CREATOR_CANCEL);
        }
        if (!escrowActions.includes(ACTION.CREATOR_OPEN_DISPUTE)) {
            await assertPromiseReverts(escrow.creatorOpenDispute(escrows.id), null, ACTION.CREATOR_OPEN_DISPUTE);
        }
        if (!escrowActions.includes(ACTION.BROKER_ACCEPT_PARTICIPATION)) {
            await assertPromiseReverts(escrow.brokerAcceptParticipation(escrows.id), null, ACTION.BROKER_ACCEPT_PARTICIPATION);
        }
        if (!escrowActions.includes(ACTION.BROKER_REJECT_PARTICIPATION)) {
            await assertPromiseReverts(escrow.brokerRejectParticipation(escrows.id), null), ACTION.BROKER_REJECT_PARTICIPATION;
        }
        if (!escrowActions.includes(ACTION.BROKER_COMMIT)) {
            await assertPromiseReverts(escrow.brokerCommitTransaction(escrows.id), null, ACTION.BROKER_COMMIT);
        }
        if (!escrowActions.includes(ACTION.BROKER_ACCEPT)) {
            await assertPromiseReverts(escrow.brokerAcceptTransaction(escrows.id), null, ACTION.BROKER_ACCEPT);
        }
        if (!escrowActions.includes(ACTION.BROKER_REVOKE)) {
            await assertPromiseReverts(escrow.brokerRevokeTransaction(escrows.id), null, ACTION.BROKER_REVOKE);
        }
    }
};

// check escrow logs
const checkEscrowLogs = async (escrows, events) => {
    const escrowCreated = {
        fromBlock: 0,
        address: escrows.user1Escrow.address,
        topics: [
            null,
            escrows.id,
        ]
    }
    const provider = getProvider();
    const logs = await provider.getLogs(escrowCreated);
    const eventsLogs = parseLogs(logs, Escrow.abi);
    assert(events.length == eventsLogs.length, `Incorrect events length ${events.length} to ${eventsLogs.length}`);
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const eventLog = eventsLogs[i];
        assert(event[0] == eventLog.name, "Incorrect events length");
        assert(escrows.id == eventLog.args['escrowId'], "Incorrect escrow id");
        const argsEvent = event[1] || {};
        const eventKeys = Object.keys(argsEvent);
        for (let j = 0; j < eventKeys.length; j++) {
            const eventKey = eventKeys[j];
            const argEvent = argsEvent[eventKey];
            const argEventLog = eventLog.args[eventKey];
            assert(argEvent == argEventLog, `Mismatch argument: ${argEvent} and ${eventLog}`);
        }
    }
};

// mint 
const mint = async (escrow, addresses, amount) => {
    const tokenAddress = await escrow.getToken();
    const wallet = getWallet(ownerPrivateKey);
    const token = new Contract(tokenAddress, EscrowToken.abi, wallet);
    for (const address of addresses) {
        await token.mint(address, amount);
    }
};

module.exports = {
    STATUS,
    ACTION,
    EVENT,
    autoDeploy,
    autoDeployWithDeposit,
    autoStartEscrow,
    mint,
    checkBalances,
    checkStatus,
    checkActions,
    checkEscrowLogs,
};