// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseScript} from "../base/BaseScript.sol";
import {FakeUSDC} from "./tokens/FakeUSDC.sol";
import "forge-std/console2.sol";

/// @notice Etches a 6-decimal USDC implementation at TOKEN0_ADDR and mints balances (local Anvil only)
contract PatchUSDC6_Token0 is BaseScript {
    function run() public {
        require(block.chainid == 31337, "local only");

        address usdcAddr = address(token0); // USDC is token0 in this setup
        // Deploy a FakeUSDC to obtain code with decimals() = 6
        FakeUSDC fake = new FakeUSDC();
        bytes memory code = address(fake).code;

        vm.startBroadcast();
        _etch(usdcAddr, code);
        // Mint a large balance to deployer
        FakeUSDC(usdcAddr).mint(deployerAddress, 10_000_000 * 1e6);
        vm.stopBroadcast();

        console2.log("Patched USDC(6) at token0:", usdcAddr);
        console2.log("Deployer:", deployerAddress);
        console2.log("Deployer USDC balance:", FakeUSDC(usdcAddr).balanceOf(deployerAddress));
    }
}
