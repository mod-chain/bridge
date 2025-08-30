// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import { BridgeMinter } from "../src/BridgeMinter.sol";

contract DeployBridgeMinter is Script {
    function run() external {
        // Inputs via env or addresses.json
        address token = vm.envAddress("L1_TOKEN");
        address l1Bridge = vm.envAddress("L1_STANDARD_BRIDGE");
        address l2Token = vm.envAddress("L2_TOKEN");
        address admin = vm.envAddress("L1_ADMIN");

        require(token != address(0) && l1Bridge != address(0) && l2Token != address(0) && admin != address(0), "missing env");

        uint256 pk = vm.envUint("DEPLOYER_PK_DEC");
        vm.startBroadcast(pk);
        BridgeMinter minter = new BridgeMinter(token, l1Bridge, l2Token, admin);
        vm.stopBroadcast();

        console2.log("BridgeMinter:", address(minter));
    }
}
