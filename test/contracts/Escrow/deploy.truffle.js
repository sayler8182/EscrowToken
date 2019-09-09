const assert = require("assert");
const { deploy, open, assertPromiseEqual, assertPromiseNotEqual, assertPromiseReverts } = require("../utils");
const { autoDeploy, autoDeployWithDeposit, mint } = require("./utils");
const EscrowToken = require("./../../../build/contracts/EscrowToken");
const Escrow = require("./../../../build/contracts/Escrow");
const {
    emptyAddress,
    ownerPrivateKey, owner,
    user1PrivateKey, user1,
    user2PrivateKey, user2,
} = require("../config");

// start test
contract("Escrow (Deploy)", (accounts) => {

    it("Deploy", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);
        let escrow = await deploy(ownerPrivateKey, Escrow);

        // deploy
        await assertPromiseNotEqual(token.address, emptyAddress, "Incorrect token address in escrow");
        await assertPromiseNotEqual(escrow.address, emptyAddress, "Incorrect token address in escrow");
        await assertPromiseEqual(escrow.getToken(), emptyAddress, "Incorrect token address in escrow");
    });

    it("Auto deploy", async () => {
        let escrow = await autoDeploy(ownerPrivateKey);

        // deploy
        await assertPromiseNotEqual(escrow.getToken(), emptyAddress, "Incorrect token address in escrow");
    });

    it("Auto deploy with deposit", async () => {
        let escrow = await autoDeployWithDeposit([ownerPrivateKey, user1PrivateKey], '100');
        let userEscrow = open(escrow, user1PrivateKey, Escrow);

        // deploy
        await assertPromiseNotEqual(escrow.getToken(), emptyAddress, "Incorrect token address in escrow");
        await assertPromiseNotEqual(userEscrow.getToken(), emptyAddress, "Incorrect token address in escrow");
        await assertPromiseEqual(escrow.getBalance(), 100, "Incorrect balance");
        await assertPromiseEqual(userEscrow.getBalance(), 100, "Incorrect balance");
    });

    it("Set token by owner", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);
        let newToken = await deploy(ownerPrivateKey, EscrowToken);
        let escrow = await deploy(ownerPrivateKey, Escrow);
        await assertPromiseNotEqual(token.address, newToken.address, "Addresses should be different");

        // set token
        await assertPromiseEqual(escrow.getToken(), emptyAddress, "Incorrect token address in escrow");
        await escrow.setToken(token.address);
        await assertPromiseEqual(escrow.getToken(), token.address, "Incorrect token address in escrow");

        // change token
        await escrow.setToken(newToken.address);
        await assertPromiseEqual(escrow.getToken(), newToken.address, "Incorrect token address in escrow");
    });

    it("Set token by user", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);
        let newToken = await deploy(user1PrivateKey, EscrowToken);
        let escrow = await deploy(ownerPrivateKey, Escrow);
        let userEscrow = open(escrow, user1PrivateKey, Escrow);
        await assertPromiseNotEqual(token.address, newToken.address, "Addresses should be different");

        // try set contract by user
        await assertPromiseReverts(userEscrow.setToken(token.address), null, "Incorrect token address in escrow");

        // set token
        await escrow.setToken(token.address);

        // try set contract by user
        await assertPromiseReverts(userEscrow.setToken(token.address), null, "Incorrect token address in escrow");

        // change token
        await assertPromiseReverts(userEscrow.setToken(token.address), null, "Incorrect token address in escrow");
    });

    it("Deploy and mint", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);
        let escrow = await deploy(ownerPrivateKey, Escrow);
        await escrow.setToken(token.address);

        // mint
        await mint(escrow, [owner, user1], '100');

        // deploy
        await assertPromiseEqual(token.balanceOf(owner), '100', "Incorrect owner balance");
        await assertPromiseEqual(token.balanceOf(user1), '100', "Incorrect user1 balance");
        await assertPromiseEqual(token.balanceOf(user2), '0', "Incorrect user2 balance");
    });
});
