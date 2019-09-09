const EscrowToken = artifacts.require("EscrowToken");
const Escrow = artifacts.require("Escrow");

module.exports = async function (deployer) {
    await deployer.deploy(EscrowToken);
    await deployer.deploy(Escrow);

    let escrowToken = await EscrowToken.deployed();
    let escrow = await Escrow.deployed();
    escrow.setToken(escrowToken);

    console.log("Escrow token", escrowToken.address);
    console.log("Escrow", escrow.address);
};