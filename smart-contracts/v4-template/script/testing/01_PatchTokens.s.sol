// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseScript} from "../base/BaseScript.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import "forge-std/console2.sol";

/// @notice Patches local Anvil by etching MockERC20 code at BaseScript's fixed token addresses
/// and minting balances to the deployer. Required for CreatePool/AddLiquidity scripts that
/// assume ERC20s exist at those addresses.
contract PatchTokens is BaseScript {
    function run() public {
        require(block.chainid == 31337, "local only");

        // Deploy a dummy MockERC20 to get runtime bytecode
        MockERC20 dummy = new MockERC20("Test Token", "TEST", 18);
        bytes memory code = address(dummy).code;

        address t0 = address(token0);
        address t1 = address(token1);

        vm.startBroadcast();
        _etch(t0, code);
        _etch(t1, code);

        // Mint large balances to deployer for testing
        MockERC20(t0).mint(deployerAddress, 10_000_000 ether);
        MockERC20(t1).mint(deployerAddress, 10_000_000 ether);
        vm.stopBroadcast();

        console2.log("Patched token0 at:", t0);
        console2.log("Patched token1 at:", t1);
        console2.log("Deployer:", deployerAddress);
    }
}
