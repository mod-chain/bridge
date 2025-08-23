// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import { IOptimismMintableERC20Factory } from "../src/Interfaces.sol";

contract DeployL2Token is Script {
    function run() external {
        address factory = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"),
            "$.base.OptimismMintableERC20Factory");
        if (factory == address(0)) {
            factory = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"),
                "$.base_sepolia.OptimismMintableERC20Factory");
        }
        address l1Token = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"), "$.ethereum.L1Token");
        if (l1Token == address(0)) {
            l1Token = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"), "$.sepolia.L1Token");
        }
        string memory name = vm.envString("L2_TOKEN_NAME");
        string memory symbol = vm.envString("L2_TOKEN_SYMBOL");
        require(factory != address(0), "factory not set");
        require(l1Token != address(0), "l1 token not set");
        
        vm.startBroadcast(vm.envUint("DEPLOYER_PK_DEC"));
        address l2Token = IOptimismMintableERC20Factory(factory).createStandardL2Token(l1Token, name, symbol);
        vm.stopBroadcast();

        console2.log("L2 token:", l2Token);
    }
}
