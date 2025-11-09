// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

import {BaseScript} from "./base/BaseScript.sol";

contract SwapScript is BaseScript {
    function run() external {
        IHooks hooksVar = IHooks(vm.envAddress("HOOK_ADDR"));
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: hooksVar // This must match the pool
        });
        bytes memory hookData = new bytes(0);

        vm.startBroadcast();

        // Grant ERC20 approvals to Permit2 (so Permit2 can pull from the user)
        token0.approve(address(permit2), type(uint256).max);
        token1.approve(address(permit2), type(uint256).max);

        // Permit2 allowances to the Router (the router is the spender that will call permit2.transferFrom)
        permit2.approve(address(token0), address(swapRouter), type(uint160).max, type(uint48).max);
        permit2.approve(address(token1), address(swapRouter), type(uint160).max, type(uint48).max);

        // We'll approve both, just for testing.
        token1.approve(address(swapRouter), type(uint256).max);
        token0.approve(address(swapRouter), type(uint256).max);

        // Execute swap
        swapRouter.swapExactTokensForTokens({
            amountIn: 1e6,
            amountOutMin: 0, // Very bad, but we want to allow for unlimited price impact
            zeroForOne: true,
            poolKey: poolKey,
            hookData: hookData,
            receiver: deployerAddress,
            deadline: block.timestamp + 1 days
        });

        vm.stopBroadcast();
    }
}
