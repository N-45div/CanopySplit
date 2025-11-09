// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {BaseScript} from "./base/BaseScript.sol";
import {TriSplitDonationHook} from "../src/TriSplitDonationHook.sol";

/// @notice Configure donation bps/target for the deployed hook using env vars
/// Env:
/// - HOOK_ADDR (address)
/// - DONATION_TARGET (address)
/// - DONATION_BPS (uint, default 100 = 1.00%)
/// - DONATION_ENABLED (bool, default true)
/// Uses currency0/currency1/lpFee/tickSpacing from BaseScript defaults
contract SetHookConfigScript is BaseScript {
    function run() external {
        IHooks hooks = IHooks(vm.envAddress("HOOK_ADDR"));
        TriSplitDonationHook hook = TriSplitDonationHook(address(hooks));
        address target = vm.envAddress("DONATION_TARGET");
        uint256 bpsU = vm.envOr("DONATION_BPS", uint256(100));
        bool enabled = vm.envOr("DONATION_ENABLED", true);

        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: hooks
        });

        vm.startBroadcast();
        hook.setConfig(poolKey, uint16(bpsU), target, enabled);
        vm.stopBroadcast();
    }
}
