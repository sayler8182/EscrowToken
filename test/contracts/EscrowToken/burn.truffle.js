const assert = require("assert");
const { deploy, open, assertPromiseEqual, assertPromiseReverts, balances } = require("../utils");
const EscrowToken = require("./../../../build/contracts/EscrowToken");
const {
    ownerPrivateKey, owner,
    user1PrivateKey, user1,
} = require("../config");

// start test
contract("Escrow Token (Burn)", (accounts) => {

    it("Burn Token by owner", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);

        // mint 100 and than burn 75
        await token.mint(owner, '100');
        await token.burn('75');
        await assertPromiseEqual(token.totalSupply(), 25, "Wrong final Total supply");
        await assertPromiseEqual(token.balanceOf(owner), 25, "Wrong final Balance");
    });

    it("Burn Token by other user", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);
        let userToken = await open(token, user1PrivateKey, EscrowToken);

        // mint 100 and than burn 75
        await token.mint(owner, '100');
        await token.mint(user1, '100');
        await userToken.burn('25');
        await assertPromiseEqual(token.totalSupply(), 175, "Wrong final Total supply");
        await assertPromiseEqual(token.balanceOf(owner), 100, "Wrong final Balance");
        await assertPromiseEqual(token.balanceOf(user1), 75, "Wrong final Balance");
    });
});
