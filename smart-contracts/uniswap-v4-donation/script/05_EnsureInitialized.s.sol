// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

import {BaseScript} from "./base/BaseScript.sol";

contract EnsureInitialized is BaseScript {
    using StateLibrary for IPoolManager;

    uint160 constant STARTING_PRICE = 2 ** 96; // 1:1

    function run() external {
        IHooks hooksVar = IHooks(vm.envAddress("HOOK_ADDR"));
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: hooksVar
        });

        vm.startBroadcast();
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKey.toId());
        if (sqrtPriceX96 == 0) {
            // initialize pool via PoolManager (2-arg signature)
            poolManager.initialize(poolKey, STARTING_PRICE);
        }
        vm.stopBroadcast();
    }
}
