const assert = require("assert");
const { deploy, open, assertPromiseEqual, assertPromiseReverts } = require("../utils");
const EscrowToken = require("./../../../build/contracts/EscrowToken");
const {
    ownerPrivateKey, owner,
    user1PrivateKey, user1,
} = require("../config");

// start test
contract("Escrow Tokens (Mint)", (accounts) => {

    it("Mint Token by owner", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);

        // mint 100
        await token.mint(owner, '100');
        await assertPromiseEqual(token.totalSupply(), 100, "Wrong final Total supply");
        await assertPromiseEqual(token.balanceOf(owner), 100, "Wrong final Balance");
        await assertPromiseEqual(token.isMinter(owner), true, "Owner should be a minter");
    });

    it("Mint Token to other user", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);

        // mint 100
        await token.mint(user1, '100');
        await assertPromiseEqual(token.totalSupply(), 100, "Wrong final Total supply");
        await assertPromiseEqual(token.balanceOf(user1), 100, "Wrong final Balance");
        await assertPromiseEqual(token.isMinter(user1), false, "User should not be a minter");
    });

    it("Mint Token by minter", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);
        let userToken = await open(token, user1PrivateKey, EscrowToken);

        // try unauthorized mint 100
        await assertPromiseReverts(userToken.mint(user1, '100'), null, "Should not be able to mint");
        await assertPromiseEqual(userToken.isMinter(user1), false, "Should not be minter");

        // add minting role
        await token.addMinter(user1);
        await assertPromiseEqual(userToken.isMinter(user1), true, "Should be minter");

        // try authorized mint 100
        await userToken.mint(user1, '100');
        await assertPromiseEqual(userToken.balanceOf(user1), 100, "Wrong final Balance");
        await assertPromiseEqual(userToken.isMinter(user1), true, "Should be minter");

        // renounce minting role
        await userToken.renounceMinter();

        // try unauthorized mint 100
        await assertPromiseReverts(userToken.mint(user1, '100'), null, "Should not be able to mint");
    });
});
