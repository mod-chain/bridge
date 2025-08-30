// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import { ModNetL1Token } from "../src/ModNL1Token.sol";

contract DeployL1Token is Script {
    function run() external {
        string memory name = vm.envOr("L1_TOKEN_NAME", string("ModToken"));
        string memory symbol = vm.envOr("L1_TOKEN_SYMBOL", string("MODN"));
        address admin = vm.envAddress("L1_ADMIN");

        uint256 pk = vm.envUint("DEPLOYER_PK_DEC"); // Sepolia deployer
        vm.startBroadcast(pk);
        ModNetL1Token token = new ModNetL1Token(name, symbol, admin);
        vm.stopBroadcast();

        console2.log("L1 token deployed at:", address(token));
    }
}

