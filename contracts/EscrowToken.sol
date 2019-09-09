pragma solidity >=0.4.21 <0.6.0;

import '../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol';
import '../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol';
import '../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol';
import '../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol';
import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';

contract EscrowToken is ERC20, ERC20Detailed, ERC20Mintable, ERC20Pausable, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 1000000 * 1e18;

    constructor() ERC20Detailed("Escrow", "ESC", 18) public {}

    // Override Mintable to limit supply.
	function mint(address account, uint256 amount) public whenNotPaused returns (bool) {
		require(totalSupply() + amount <= MAX_SUPPLY, "Max supply reached");
		return super.mint(account, amount);
	}
}