const assert = require("assert");
const { open, assertPromiseEqual, assertPromiseNotEqual, assertPromiseReverts } = require("../utils");
const { STATUS, ACTION, EVENT, autoDeployWithDeposit, autoStartEscrow, checkBalances, checkStatus, checkActions, checkEscrowLogs } = require("./utils");
const EscrowToken = require("./../../../build/contracts/EscrowToken");
const Escrow = require("./../../../build/contracts/Escrow");
const {
    emptyAddress,
    ownerPrivateKey, owner,
    user1PrivateKey, user1,
    user2PrivateKey, user2,
    user3PrivateKey, user3,
} = require("../config");

// start test
contract("Escrow (escrow)", (accounts) => {

    it("Start escrow", async () => {
        let escrow = await autoDeployWithDeposit([ownerPrivateKey, user1PrivateKey], '100');
        let user1Escrow = open(escrow, user1PrivateKey, Escrow);
        let user2Escrow = open(escrow, user2PrivateKey, Escrow);
        let user3Escrow = open(escrow, user3PrivateKey, Escrow);

        // check balance
        await checkBalances({ user1Escrow, user2Escrow, user3Escrow }, [[100, 0]]);
        await assertPromiseEqual(escrow.getContractBalance(), 0, "Incorrect contract balance");

        // start escrow
        const transaction = await user1Escrow.startEscrow(
            user2,
            user3,
            '100',
            '100',
            "Some note",
        );
        const receipt = await transaction.wait();
        const escrowId = receipt.events[0].args.escrowId;

        // check details
        const details = await user1Escrow.getDetails(escrowId);
        assert(details.id == escrowId, "Incorrect id");
        assert(details.creator == user1, "Incorrect creator");
        assert(details.broker == user2, "Incorrect broker");
        assert(details.recipient == user3, "Incorrect recipient");
        assert(details.notes == "Some note", "Incorrect notes");
        assert(details.amount == 97, "Incorrect amount");
        assert(details.brokerFee == 1, "Incorrect brokerFee");
        assert(details.contractFee == 2, "Incorrect contractFee");
        assert(details.status == STATUS.INITIATED, "Incorrect status");

        // check balance
        await checkBalances({ user1Escrow, user2Escrow, user3Escrow }, [[0, 98]]);
        await assertPromiseEqual(escrow.getContractBalance(), 2, "Incorrect contract balance");
    });

    it("Auto start escrow", async () => {
        let escrows = await autoStartEscrow('100', '100');

        // check balance
        await checkBalances(escrows, [[0, 98]]);
    });
});

contract("Escrow (INITIATED)", (accounts) => {

    it("INITIATED", async () => {
        let escrows = await autoStartEscrow('100', '100');

        // check status
        await checkStatus(escrows, STATUS.INITIATED);
        await checkActions(escrows, [
            [ACTION.CREATOR_ACCEPT, ACTION.CREATOR_CANCEL],
            [ACTION.BROKER_ACCEPT_PARTICIPATION, ACTION.BROKER_REJECT_PARTICIPATION],
        ]);
        await checkBalances(escrows, [[0, 98]]);
        await checkEscrowLogs(escrows, [
            [EVENT.ESCROW_CREATED, { sender: user1 }],
        ]);
    });

    it("Creator INITIATED -> CREATOR_ACCEPT", async () => {
        let escrows = await autoStartEscrow('100', '100');

        // accept 
        await escrows.user1Escrow.creatorAcceptTransaction(escrows.id);

        // check status
        await checkStatus(escrows, STATUS.SUCCESS);
        await checkActions(escrows);
        await checkBalances(escrows, [
            [0, 0],
            [0, 0],
            [98, 0],
        ]);
        await checkEscrowLogs(escrows, [
            [EVENT.ESCROW_CREATED, { sender: user1 }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user1, status: STATUS.SUCCESS }],
        ]);
    });

    it("Creator INITIATED -> CREATOR_CANCEL", async () => {
        let escrows = await autoStartEscrow('100', '100');

        // cancel 
        await escrows.user1Escrow.creatorCancelTransaction(escrows.id);

        // check status
        await checkStatus(escrows, STATUS.CANCELLED);
        await checkActions(escrows);
        await checkBalances(escrows, [
            [98, 0],
            [0, 0],
            [0, 0],
        ]);
        await checkEscrowLogs(escrows, [
            [EVENT.ESCROW_CREATED, { sender: user1 }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user1, status: STATUS.CANCELLED }],
        ]);
    });

    it("Broker INITIATED -> BROKER_ACCEPT_PARTICIPATION", async () => {
        let escrows = await autoStartEscrow('100', '100');

        // accept 
        await escrows.user2Escrow.brokerAcceptParticipation(escrows.id);

        // check status
        await checkStatus(escrows, STATUS.PENDING);
        await checkActions(escrows, [
            [ACTION.CREATOR_ACCEPT, ACTION.CREATOR_OPEN_DISPUTE],
            [ACTION.BROKER_ACCEPT],
        ]);
        await checkBalances(escrows, [
            [0, 98],
            [0, 0],
            [0, 0],
        ]);
        await checkEscrowLogs(escrows, [
            [EVENT.ESCROW_CREATED, { sender: user1 }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user2, status: STATUS.PENDING }],
        ]);
    });

    it("Broker INITIATED -> BROKER_REJECT_PARTICIPATION", async () => {
        let escrows = await autoStartEscrow('100', '100');

        // reject 
        await escrows.user2Escrow.brokerRejectParticipation(escrows.id);

        // check status
        await checkStatus(escrows, STATUS.CANCELLED);
        await checkActions(escrows);
        await checkBalances(escrows, [
            [98, 0],
            [0, 0],
            [0, 0],
        ]);
        await checkEscrowLogs(escrows, [
            [EVENT.ESCROW_CREATED, { sender: user1 }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user2, status: STATUS.CANCELLED }],
        ]);
    });

    it("Creator PENDING -> ACCEPT", async () => {
        let escrows = await autoStartEscrow('100', '100');
        await escrows.user2Escrow.brokerAcceptParticipation(escrows.id);

        // accept 
        await escrows.user1Escrow.creatorAcceptTransaction(escrows.id);

        // check status
        await checkStatus(escrows, STATUS.SUCCESS);
        await checkActions(escrows);
        await checkBalances(escrows, [
            [0, 0],
            [1, 0],
            [97, 0],
        ]);
        await checkEscrowLogs(escrows, [
            [EVENT.ESCROW_CREATED, { sender: user1 }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user2, status: STATUS.PENDING }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user1, status: STATUS.SUCCESS }],
        ]);
    });

    it("Creator PENDING -> OPEN_DISPUTE", async () => {
        let escrows = await autoStartEscrow('100', '100');
        await escrows.user2Escrow.brokerAcceptParticipation(escrows.id);

        // open dispute 
        await escrows.user1Escrow.creatorOpenDispute(escrows.id);

        // check status
        await checkStatus(escrows, STATUS.DISPUTE);
        await checkActions(escrows, [
            [ACTION.CREATOR_ACCEPT],
            [ACTION.BROKER_COMMIT, ACTION.BROKER_REVOKE],
        ]);
        await checkBalances(escrows, [
            [0, 98],
            [0, 0],
            [0, 0],
        ]);
        await checkEscrowLogs(escrows, [
            [EVENT.ESCROW_CREATED, { sender: user1 }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user2, status: STATUS.PENDING }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user1, status: STATUS.DISPUTE }],
        ]);
    });

    it("Broker PENDING -> ACCEPT", async () => {
        let escrows = await autoStartEscrow('100', '100');
        await escrows.user2Escrow.brokerAcceptParticipation(escrows.id);

        // accept 
        await escrows.user2Escrow.brokerAcceptTransaction(escrows.id);

        // check status
        await checkStatus(escrows, STATUS.SUCCESS);
        await checkActions(escrows);
        await checkBalances(escrows, [
            [0, 0],
            [1, 0],
            [97, 0],
        ]);
        await checkEscrowLogs(escrows, [
            [EVENT.ESCROW_CREATED, { sender: user1 }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user2, status: STATUS.PENDING }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user2, status: STATUS.SUCCESS }],
        ]);
    });

    it("Creator OPEN_DISPUTE -> ACCEPT", async () => {
        let escrows = await autoStartEscrow('100', '100');
        await escrows.user2Escrow.brokerAcceptParticipation(escrows.id);
        await escrows.user1Escrow.creatorOpenDispute(escrows.id);

        // accept
        await escrows.user1Escrow.creatorAcceptTransaction(escrows.id);

        // check status
        await checkStatus(escrows, STATUS.SUCCESS);
        await checkActions(escrows);
        await checkBalances(escrows, [
            [0, 0],
            [1, 0],
            [97, 0],
        ]);
        await checkEscrowLogs(escrows, [
            [EVENT.ESCROW_CREATED, { sender: user1 }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user2, status: STATUS.PENDING }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user1, status: STATUS.DISPUTE }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user1, status: STATUS.SUCCESS }],
        ]);
    });

    it("Broker OPEN_DISPUTE -> COMMIT", async () => {
        let escrows = await autoStartEscrow('100', '100');
        await escrows.user2Escrow.brokerAcceptParticipation(escrows.id);
        await escrows.user1Escrow.creatorOpenDispute(escrows.id);

        // commit
        await escrows.user2Escrow.brokerCommitTransaction(escrows.id);

        // check status
        await checkStatus(escrows, STATUS.SUCCESS);
        await checkActions(escrows);
        await checkBalances(escrows, [
            [0, 0],
            [1, 0],
            [97, 0],
        ]);
        await checkEscrowLogs(escrows, [
            [EVENT.ESCROW_CREATED, { sender: user1 }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user2, status: STATUS.PENDING }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user1, status: STATUS.DISPUTE }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user2, status: STATUS.SUCCESS }],
        ]);
    });

    it("Broker OPEN_DISPUTE -> REVOKE", async () => {
        let escrows = await autoStartEscrow('100', '100');
        await escrows.user2Escrow.brokerAcceptParticipation(escrows.id);
        await escrows.user1Escrow.creatorOpenDispute(escrows.id);

        // commit
        await escrows.user2Escrow.brokerRevokeTransaction(escrows.id);

        // check status
        await checkStatus(escrows, STATUS.CANCELLED);
        await checkActions(escrows);
        await checkBalances(escrows, [
            [97, 0],
            [1, 0],
            [0, 0],
        ]);
        await checkEscrowLogs(escrows, [
            [EVENT.ESCROW_CREATED, { sender: user1 }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user2, status: STATUS.PENDING }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user1, status: STATUS.DISPUTE }],
            [EVENT.ESCROW_STATUS_CHANGED, { sender: user2, status: STATUS.CANCELLED }],
        ]);
    });
});