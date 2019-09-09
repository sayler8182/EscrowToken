const assert = require("assert");
const { deploy, open, assertPromiseEqual, assertPromiseNotEqual, assertPromiseReverts } = require("../utils");
const { autoDeploy, mint } = require("./utils");
const EscrowToken = require("./../../../build/contracts/EscrowToken");
const Escrow = require("./../../../build/contracts/Escrow");
const {
    emptyAddress,
    ownerPrivateKey, owner,
    user1PrivateKey, user1,
} = require("../config");

// start test
contract("Escrow (Deposit)", (accounts) => {

    it("Approve", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);
        let userToken = await open(token, user1PrivateKey, EscrowToken);
        let escrow = await deploy(ownerPrivateKey, Escrow);
        let userEscrow = await open(escrow, user1PrivateKey, Escrow);
        await escrow.setToken(token.address);
        await mint(escrow, [user1], '100');

        // approve
        await assertPromiseEqual(userToken.allowance(user1, userEscrow.address), '0', "Incorrect allowance");
        await userToken.approve(userEscrow.address, '100');
        await assertPromiseEqual(userToken.allowance(user1, userEscrow.address), '100', "Incorrect allowance");
        await userEscrow.deposit('75');
        await assertPromiseEqual(userToken.allowance(user1, userEscrow.address), '25', "Incorrect allowance");

        // remove approval
        await userToken.approve(userEscrow.address, '0');
        await assertPromiseEqual(userToken.allowance(user1, userEscrow.address), '0', "Incorrect allowance");

        // approve to many balance
        await userToken.approve(userEscrow.address, '200');
        await assertPromiseEqual(userToken.allowance(user1, userEscrow.address), '200', "Incorrect allowance");
    });

    it("Deposit by user", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);
        let userToken = await open(token, user1PrivateKey, EscrowToken);
        let escrow = await deploy(ownerPrivateKey, Escrow);
        let userEscrow = await open(escrow, user1PrivateKey, Escrow);
        await escrow.setToken(token.address);
        await mint(escrow, [user1], '100');

        // allow and deposit
        await assertPromiseEqual(userEscrow.getBalance(), '0', "Incorrect user balance");
        await assertPromiseEqual(userToken.balanceOf(user1), '100', "Incorrect user balance");
        await userToken.approve(userEscrow.address, '100');
        await userEscrow.deposit('75');
        await assertPromiseEqual(userEscrow.getBalance(), '75', "Incorrect owner balance");
        await assertPromiseEqual(userToken.balanceOf(user1), '25', "Incorrect owner balance");

        // deposit to many funds
        await assertPromiseReverts(userEscrow.deposit('26'), null, "Should have insufficient funds");
    });
});
