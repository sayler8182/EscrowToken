const assert = require("assert");
const { deploy, open, assertPromiseEqual, assertPromiseReverts } = require("../utils");
const EscrowToken = require("./../../../build/contracts/EscrowToken");
const {
    ownerPrivateKey, owner,
    user1PrivateKey, user1,
} = require("../config");

// start test
contract("Escrow Token (Pause)", (accounts) => {

    it("Pause / unpause Token by owner", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);

        // pause and try mint
        await assertPromiseEqual(token.paused(), false, "Should not be paused");
        await token.pause();
        await assertPromiseEqual(token.paused(), true, "Should be paused");
        await assertPromiseReverts(token.mint(owner, '100'), null, "Should prevent minting when paused");
        await assertPromiseReverts(token.burn('100'), null, "Should prevent minting when paused");
        await token.unpause();
        await assertPromiseEqual(token.paused(), false, "Should not be paused");
        await token.mint(owner, '100');
        await token.burn('100');
    });

    it("Pause / unpause Token by pauser", async () => {
        let token = await deploy(ownerPrivateKey, EscrowToken);
        let userToken = await open(token, user1PrivateKey, EscrowToken);

        // try unauthorized pause / unpause
        await assertPromiseReverts(userToken.pause(), null, "Should not be able to pause");
        await assertPromiseReverts(userToken.unpause(), null, "Should not be able to unpause");

        // add pauser role
        await token.addPauser(user1);
        await assertPromiseEqual(userToken.isPauser(user1), true, "Should be minter");

        // try authorized pause / unpause
        await userToken.pause();
        await assertPromiseEqual(userToken.paused(), true, "Should be paused");
        await userToken.unpause();
        await assertPromiseEqual(userToken.paused(), false, "Should not be paused");

        // renounce minting role
        await userToken.renouncePauser();

        // // try unauthorized pause / unpause
        // await assertPromiseReverts(userToken.pause(), null, "Should not be able to pause");
        // await assertPromiseReverts(userToken.unpause(), null, "Should not be able to unpause");
    });
});
