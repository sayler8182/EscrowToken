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
contract("Escrow (Withdraw)", (accounts) => {

    it("Withdraw by user", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);
        let userToken = await open(token, user1PrivateKey, EscrowToken);
        let escrow = await deploy(ownerPrivateKey, Escrow);
        let userEscrow = await open(escrow, user1PrivateKey, Escrow);
        await escrow.setToken(token.address);
        await mint(escrow, [user1], '100');
        await userToken.approve(userEscrow.address, '100');
        await userEscrow.deposit('70');

        // withdraw
        await assertPromiseEqual(userEscrow.getBalance(), '70', "Incorrect user balance");
        await assertPromiseEqual(userToken.balanceOf(user1), '30', "Incorrect user balance");
        await userEscrow.withdraw('60');
        await assertPromiseEqual(userEscrow.getBalance(), '10', "Incorrect user balance");
        await assertPromiseEqual(userToken.balanceOf(user1), '90', "Incorrect user balance");

        // withdraw to many funds
        await assertPromiseReverts(userEscrow.withdraw('20'), null, "Should have insufficient funds");
    });
});
