pragma solidity >=0.4.21 <0.6.0;

import '../node_modules/openzeppelin-solidity/contracts/token/ERC20/IERC20.sol';
import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';
import '../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol';

contract Escrow is Ownable {
    using SafeMath for uint256;

    enum Status { INITIATED, PENDING, DISPUTE, CANCELLED, SUCCESS }

    struct EscrowStruct {
        bytes32 id;
        address creator;
        address broker;
        address recipient;
        string notes;
        uint256 amount;
        uint256 brokerFee;
        uint256 contractFee;
        Status status;
    }

    /**
     * Available events
    */
    event EscrowCreated(bytes32 indexed escrowId, address indexed sender, uint256 blocktime);
    event EscrowStatusChanged(bytes32 indexed escrowId, address indexed sender, Status status, uint256 blocktime);

    IERC20 private _token;
    uint256 private _index;
    uint256 private _contractFee;
    uint256 private _contractBalance;
    uint256 private _tokenBalance;
    mapping(address => uint256) private _balance;
    mapping(address => uint256) private _lockBalance;
    mapping(bytes32 => EscrowStruct) private _escrows;

    /**
     * Allow access only for creator
    */
    modifier isCreator(bytes32 escrowId) {
        require(_escrows[escrowId].creator == msg.sender, "Is not creator");
        _;
    }

    /**
     * Allow access only for broker
    */
    modifier isBroker(bytes32 escrowId) {
        require(_escrows[escrowId].broker == msg.sender, "Is not broker");
        _;
    }

    /**
     * Allow access only for recipient
    */
    modifier isRecipient(bytes32 escrowId) {
        require(_escrows[escrowId].recipient == msg.sender, "Is not recipient");
        _;
    }

    /**
     * Sets contract fee to 200
    */
    constructor() public {
        _contractFee = 200;
    }

    /**
     *  Gets contract fee
    */
    function getContractFee() public view returns (uint256) {
        return _contractFee;
    }

    /**
     *  Gets contract balance
    */
    function getContractBalance() public view onlyOwner() returns (uint256) {
        return _contractBalance;
    }

    /**
     *  Gets balance
    */
    function getBalance() public view returns (uint256) {
        return _balance[msg.sender];
    }

    /**
     *  Gets lock balance
    */
    function getLockBalance() public view returns (uint256) {
        return _lockBalance[msg.sender];
    }

    /**
     * Create contract and start new escrow transaction
     * @param brokerAddress broker wallet address
     * @param recipientAddress recipient wallet address
     * @param amount transaction value
     * @param fee fee for broker (<1, 5000> where 1 -> 0.01%, 5000 -> 50%)
     * @param notes escrow additional info (max 255 chars)
    */
    function startEscrow(address brokerAddress, address recipientAddress, uint256 amount, uint256 fee, string memory notes) public payable {
        require(amount <= _balance[msg.sender], "Insufficient funds");
        require(amount > 0 && amount < 2**64, "Value is not in range (0, 2**64)");
        require(msg.sender != brokerAddress, "Creator and broker can't be the same person");
        require(msg.sender != recipientAddress, "Creator and recipient can't be the same person");
        require(fee >= 1 && fee <= 5000, "Fee is not in range <1, 5000>");
        require(bytes(notes).length < 256, "Notes is too long");

        // calculate
        uint256 brokerFee = _normalizeFee(fee * amount);
        uint256 contractFee = _normalizeFee(_contractFee * amount);
        uint256 amountWithoutFee = amount - brokerFee - contractFee;

        // fill escrow
        EscrowStruct memory _escrow;
        _escrow.id = _getNewId(_index);
        _escrow.creator = msg.sender;
        _escrow.broker = brokerAddress;
        _escrow.recipient = recipientAddress;
        _escrow.amount = amountWithoutFee;
        _escrow.brokerFee = brokerFee;
        _escrow.contractFee = contractFee;
        _escrow.notes = notes;
        _escrow.status = Status.INITIATED;

        // set balance
        _contractBalance = _contractBalance.add(contractFee);
        _balance[msg.sender] = _balance[msg.sender].sub(amount);
        _lockBalance[msg.sender] = _lockBalance[msg.sender].add(amount - contractFee);

        // save escrow in contract
        _escrows[_escrow.id] = _escrow;
        _index = _index.add(1);

        emit EscrowCreated(_escrow.id, msg.sender, block.timestamp);
    }

    /**
     * Escrow transaction details
    */
    function getDetails(bytes32 escrowId) public view
        returns (bytes32 id, address creator, address broker, address recipient, string memory notes, uint amount, uint brokerFee, uint contractFee, Status status) {
            EscrowStruct storage escrow = _escrows[escrowId];
            return (escrow.id, escrow.creator, escrow.broker, escrow.recipient, escrow.notes, escrow.amount, escrow.brokerFee, escrow.contractFee, escrow.status);
    }

    /**
     * Escrow transaction status
     * INITIATED, PENDING, DISPUTE, CANCELLED, REJECTED, SUCCESS
    */
    function getStatus(bytes32 escrowId) public view returns (Status status) {
        return _escrows[escrowId].status;
    }

    /* CREATOR ACTIONS */
    /* ------------------------------------------------------ */

    function creatorAcceptTransaction(bytes32 escrowId) public isCreator(escrowId) {
        EscrowStruct storage escrow = _escrows[escrowId];
        require(
            escrow.status == Status.INITIATED ||
            escrow.status == Status.PENDING ||
            escrow.status == Status.DISPUTE,
            "Incorrect status");

        // all funds to recipient
        if (escrow.status == Status.INITIATED) {
            escrow.status = Status.SUCCESS;
            _balance[escrow.recipient] = _balance[escrow.recipient].add(escrow.amount + escrow.brokerFee);
            _lockBalance[escrow.creator] = _lockBalance[escrow.creator].sub(escrow.amount + escrow.brokerFee);
        } else { // funds to recipient fee to broker
            escrow.status = Status.SUCCESS;
            _balance[escrow.recipient] = _balance[escrow.recipient].add(escrow.amount);
            _balance[escrow.broker] = _balance[escrow.broker].add(escrow.brokerFee);
            _lockBalance[escrow.creator] = _lockBalance[escrow.creator].sub(escrow.amount + escrow.brokerFee);
        }

        emit EscrowStatusChanged(escrowId, msg.sender, escrow.status, block.timestamp);
    }

    function creatorCancelTransaction(bytes32 escrowId) public isCreator(escrowId) {
        EscrowStruct storage escrow = _escrows[escrowId];
        require(
            escrow.status == Status.INITIATED,
            "Incorrect status");
        escrow.status = Status.CANCELLED;

        // all funds to creator
        _balance[escrow.creator] = _balance[escrow.creator].add(escrow.amount + escrow.brokerFee);
        _lockBalance[escrow.creator] = _lockBalance[escrow.creator].sub(escrow.amount + escrow.brokerFee);

        emit EscrowStatusChanged(escrowId, msg.sender, escrow.status, block.timestamp);
    }

    function creatorOpenDispute(bytes32 escrowId) public isCreator(escrowId) {
        EscrowStruct storage escrow = _escrows[escrowId];
        require(
            escrow.status == Status.PENDING,
            "Incorrect status");
        escrow.status = Status.DISPUTE;

        emit EscrowStatusChanged(escrowId, msg.sender, escrow.status, block.timestamp);
    }

    /* BROKER ACTIONS */
    /* ------------------------------------------------------ */

    function brokerAcceptParticipation(bytes32 escrowId) public isBroker(escrowId) {
        EscrowStruct storage escrow = _escrows[escrowId];
        require(
            escrow.status == Status.INITIATED,
            "Incorrect status");
        escrow.status = Status.PENDING;

        emit EscrowStatusChanged(escrowId, msg.sender, escrow.status, block.timestamp);
    }

    function brokerRejectParticipation(bytes32 escrowId) public isBroker(escrowId) {
        EscrowStruct storage escrow = _escrows[escrowId];
        require(
            escrow.status == Status.INITIATED,
            "Incorrect status");
        escrow.status = Status.CANCELLED;

        // all funds to creator
        _balance[escrow.creator] = _balance[escrow.creator].add(escrow.amount + escrow.brokerFee);
        _lockBalance[escrow.creator] = _lockBalance[escrow.creator].sub(escrow.amount + escrow.brokerFee);

        emit EscrowStatusChanged(escrowId, msg.sender, escrow.status, block.timestamp);
    }

    function brokerAcceptTransaction(bytes32 escrowId) public isBroker(escrowId) {
        EscrowStruct storage escrow = _escrows[escrowId];
        require(
            escrow.status == Status.PENDING,
            "Incorrect status");
        escrow.status = Status.SUCCESS;

        // funds to recipient fee to broker
        _balance[escrow.recipient] = _balance[escrow.recipient].add(escrow.amount);
        _balance[escrow.broker] = _balance[escrow.broker].add(escrow.brokerFee);
        _lockBalance[escrow.creator] = _lockBalance[escrow.creator].sub(escrow.amount + escrow.brokerFee);

        emit EscrowStatusChanged(escrowId, msg.sender, escrow.status, block.timestamp);
    }

    function brokerCommitTransaction(bytes32 escrowId) public isBroker(escrowId) {
        EscrowStruct storage escrow = _escrows[escrowId];
        require(
            escrow.status == Status.DISPUTE,
            "Incorrect status");
        escrow.status = Status.SUCCESS;

        // funds to recipient fee to broker
        _balance[escrow.recipient] = _balance[escrow.recipient].add(escrow.amount);
        _balance[escrow.broker] = _balance[escrow.broker].add(escrow.brokerFee);
        _lockBalance[escrow.creator] = _lockBalance[escrow.creator].sub(escrow.amount + escrow.brokerFee);

        emit EscrowStatusChanged(escrowId, msg.sender, escrow.status, block.timestamp);
    }

    function brokerRevokeTransaction(bytes32 escrowId) public isBroker(escrowId) {
        EscrowStruct storage escrow = _escrows[escrowId];
        require(
            escrow.status == Status.DISPUTE,
            "Incorrect status");
        escrow.status = Status.CANCELLED;

        // funds to creator fee to broker
        _balance[escrow.creator] = _balance[escrow.creator].add(escrow.amount);
        _balance[escrow.broker] = _balance[escrow.broker].add(escrow.brokerFee);
        _lockBalance[escrow.creator] = _lockBalance[escrow.creator].sub(escrow.amount + escrow.brokerFee);

        emit EscrowStatusChanged(escrowId, msg.sender, escrow.status, block.timestamp);
    }

    /* DEPOSIT / WITHDRAW */
    /* ------------------------------------------------------ */

    /**
     * Deposit token
     */
    function deposit(uint256 amount) public {
        _token.transferFrom(msg.sender, address(this), amount);
        _balance[msg.sender] = _balance[msg.sender].add(amount);
    }

    /**
     * Withdraw token
     */
    function withdraw(uint256 amount) public {
        require(amount <= _balance[msg.sender], "Insufficient funds");
        _balance[msg.sender] = _balance[msg.sender].sub(amount);
        _token.transfer(msg.sender, amount);
    }

    /* TOKEN */
    /* ------------------------------------------------------ */

    /**
     * Gets assigned token
     */
    function getToken() public view returns (address) {
        return address(_token);
    }

    /**
     * Sets assigned token
     */
    function setToken(address token) public onlyOwner() {
        _token = IERC20(token);
    }

    /* PRIVATE UTILS */
    /* ------------------------------------------------------ */

    /**
     * Gets new id
     */
    function _getNewId(uint256 index) private pure returns (bytes32) {
        return keccak256(abi.encode(index));
    }

    /**
     * Normalize fee
     */
    function _normalizeFee(uint256 fee) private pure returns (uint256) {
        return fee / 10000;
    }
}