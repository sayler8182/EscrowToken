const assert = require("assert");
const { deploy, assertPromiseEqual, assertPromiseReverts } = require("../utils");
const EscrowToken = require("./../../../build/contracts/EscrowToken");
const { ownerPrivateKey, owner } = require("../config");

// start test
contract("Escrow Token (Deploy)", (accounts) => {

    it("Deploy", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);

        // check deploy
        await assertPromiseEqual(token.name(), "Escrow", "Wrong name");
        await assertPromiseEqual(token.symbol(), "ESC", "Wrong symbol");
        await assertPromiseEqual(token.decimals(), 18, "Wrong decimals");
        await assertPromiseEqual(token.balanceOf(owner), 0, "Wrong initial Balance");
        await assertPromiseEqual(token.totalSupply(), 0, "Wrong initial Total supply");
    });
});
