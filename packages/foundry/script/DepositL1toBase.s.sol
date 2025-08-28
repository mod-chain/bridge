// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import { IERC20, IL1StandardBridge } from "../src/Interfaces.sol";

contract DepositL1toBase is Script {
    function run() external {
        // ---- config knobs ----
        // NETWORK: "mainnet" or "sepolia". Defaults to sepolia.
        string memory network = vm.envOr("NETWORK", string("sepolia"));
        // USE_JSON: set false to skip reading addresses.json
        bool useJson = vm.envOr("USE_JSON", true);
        // ADDRS_JSON: path to addresses.json if you want to use it
        string memory addrsPath = vm.envOr("ADDRS_JSON", string("../../ops/addresses.json"));

        // Optional direct env overrides (take precedence if set)
        address bridge = vm.envOr("L1_STANDARD_BRIDGE", address(0));
        address l1Token = vm.envOr("L1_TOKEN", address(0));
        address l2Token = vm.envOr("L2_TOKEN", address(0));

        // Fill from JSON if requested and anything is still missing
        if (useJson && (bridge == address(0) || l1Token == address(0) || l2Token == address(0))) {
            string memory json = vm.readFile(addrsPath);

            // map network → keys in JSON
            string memory l1Key = keccak256(bytes(network)) == keccak256("mainnet")
                ? "ethereum"
                : "sepolia";
            string memory l2Key = keccak256(bytes(network)) == keccak256("mainnet")
                ? "base"
                : "base_sepolia";

            if (bridge == address(0)) {
                bridge = vm.parseJsonAddress(json, string.concat("$.", l1Key, ".L1StandardBridge"));
            }
            if (l1Token == address(0)) {
                l1Token = vm.parseJsonAddress(json, string.concat("$.", l1Key, ".L1Token"));
            }
            if (l2Token == address(0)) {
                l2Token = vm.parseJsonAddress(json, string.concat("$.", l2Key, ".L2Token"));
                // second chance, in case only "base" was filled
                if (l2Token == address(0)) {
                    l2Token = vm.parseJsonAddress(json, "$.base.L2Token");
                }
            }
        }

        // Final safety default for the L1 bridge if still empty
        if (bridge == address(0)) {
            // Known canonical L1 bridge addresses
            if (keccak256(bytes(network)) == keccak256("mainnet")) {
                bridge = 0x3154Cf16ccdb4C6d922629664174b904d80F2C35; // Ethereum mainnet
            } else {
                bridge = 0xfd0Bf71F60660E2f608ed56e1659C450eB113120; // Ethereum Sepolia
            }
        }

        // Required runtime inputs
        uint256 amount = vm.envUint("AMOUNT");
        uint32 l2Gas = uint32(vm.envOr("L2_GAS", uint256(200_000)));

        require(bridge != address(0), "bridge not set");
        require(l1Token != address(0), "l1 token not set");
        require(l2Token != address(0), "l2 token not set");
        require(amount > 0, "amount must be > 0");

        // prefer DEPLOYER_PK_DEC, fall back to PRIVATE_KEY if you only set that
        uint256 pk = vm.envOr("DEPLOYER_PK_DEC", uint256(0));
        if (pk == 0) {
            pk = vm.envUint("PRIVATE_KEY");
        }

        console2.log("NETWORK:", network);
        console2.log("Bridge:", bridge);
        console2.log("L1Token:", l1Token);
        console2.log("L2Token:", l2Token);
        console2.log("Amount:", amount);
        console2.log("L2 Gas:", l2Gas);

        vm.startBroadcast(pk);
        require(IERC20(l1Token).approve(bridge, amount), "approve failed");
        IL1StandardBridge(bridge).depositERC20(l1Token, l2Token, amount, l2Gas, "");
        vm.stopBroadcast();
    }
}
