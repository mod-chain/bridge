// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function approve(address spender, uint256 value) external returns (bool);
}

interface IL1StandardBridge {
    function depositERC20(
        address _l1Token,
        address _l2Token,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    ) external payable;
}

interface IOptimismMintableERC20Factory {
    event StandardL2TokenCreated(address indexed _l1Token, address indexed _l2Token);
    function createStandardL2Token(
        address _l1Token,
        string calldata _name,
        string calldata _symbol
    ) external returns (address);
}
