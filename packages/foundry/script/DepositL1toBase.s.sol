// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import { IERC20, IL1StandardBridge } from "../src/Interfaces.sol";

contract DepositL1toBase is Script {
    function run() external {
        address bridge = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"), "$.ethereum.L1StandardBridge");
        address l1Token = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"), "$.ethereum.L1Token");
        address l2Token = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"), "$.base.L2Token");
        if (l2Token == address(0)) {
            l2Token = vm.parseJsonAddress(vm.readFile("../../ops/addresses.json"), "$.base_sepolia.L2Token");
        }

        uint256 amount = vm.envUint("AMOUNT");
        uint32 l2Gas = uint32(vm.envUint("L2_GAS"));
        require(bridge != address(0), "bridge not set");
        require(l1Token != address(0), "l1 token not set");
        require(l2Token != address(0), "l2 token not set");
        require(amount > 0, "amount must be > 0");
        
        vm.startBroadcast(vm.envUint("DEPLOYER_PK_DEC"));
        require(IERC20(l1Token).approve(bridge, amount));
        IL1StandardBridge(bridge).depositERC20(l1Token, l2Token, amount, l2Gas, "");
        vm.stopBroadcast();
    }
}
