// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import { ModNetL1Token } from "../src/ModNL1Token.sol";
import { BridgeMinter } from "../src/BridgeMinter.sol";

contract ConfigureMinter is Script {
    function run() external {
        address token = vm.envAddress("L1_TOKEN");
        address minter = vm.envAddress("BRIDGE_MINTER");
        address admin = vm.envAddress("L1_ADMIN");
        // Optional single relayer EOA
        address relayer = vm.envOr("RELAYER_EOA", address(0));

        require(token != address(0) && minter != address(0) && admin != address(0), "missing env");

        uint256 pk = vm.envUint("DEPLOYER_PK_DEC");
        vm.startBroadcast(pk);

        // 1) Grant MINTER_ROLE on the L1 token to the BridgeMinter contract
        bytes32 MINTER_ROLE = ModNetL1Token(token).MINTER_ROLE();
        ModNetL1Token(token).grantRole(MINTER_ROLE, minter);

        // 2) Whitelist relayer, if provided
        if (relayer != address(0)) {
            BridgeMinter(minter).setRelayer(relayer, true);
        }

        vm.stopBroadcast();
    }
}
