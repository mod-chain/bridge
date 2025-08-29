// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

interface IBridgableERC20 {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IL1StandardBridgeTo {
    function depositERC20To(
        address _l1Token,
        address _l2Token,
        address _to,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    ) external payable;
}

contract BridgeMinter is AccessControl, ReentrancyGuard {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    IBridgableERC20 public immutable token;
    IL1StandardBridgeTo public immutable bridge;
    address public immutable l2Token;

    mapping(bytes32 => bool) private _consumed;

    event RelayerSet(address indexed relayer, bool enabled);
    event Bridged(bytes32 indexed eventId, address indexed to, uint256 amount);
    event Consumed(bytes32 indexed eventId);

    error NotRelayer();
    error AlreadyConsumed();
    error ZeroAmount();

    constructor(address _token, address _l1StandardBridge, address _l2Token, address _admin) {
        require(_token != address(0) && _l1StandardBridge != address(0) && _l2Token != address(0) && _admin != address(0),
            "zero addr");
        token = IBridgableERC20(_token);
        bridge = IL1StandardBridgeTo(_l1StandardBridge);
        l2Token = _l2Token;
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    function consumed(bytes32 eventId) external view returns (bool) {
        return _consumed[eventId];
    }

    function setRelayer(address who, bool on) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (on) {
            _grantRole(RELAYER_ROLE, who);
        } else {
            _revokeRole(RELAYER_ROLE, who);
        }
        emit RelayerSet(who, on);
    }

    function setAdmin(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newAdmin != address(0), "zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        _revokeRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function mintAndBridge(
        bytes32 eventId,
        address to,
        uint256 amountWei,
        uint32 l2Gas
    ) external nonReentrant {
        if (!hasRole(RELAYER_ROLE, _msgSender())) revert NotRelayer();
        if (_consumed[eventId]) revert AlreadyConsumed();
        if (amountWei == 0) revert ZeroAmount();

        _consumed[eventId] = true;

        // Mint to this contract, approve bridge, deposit to L2 recipient
        token.mint(address(this), amountWei);
        require(token.approve(address(bridge), amountWei), "approve");
        bridge.depositERC20To(address(token), l2Token, to, amountWei, l2Gas, "");

        emit Consumed(eventId);
        emit Bridged(eventId, to, amountWei);
    }
}
