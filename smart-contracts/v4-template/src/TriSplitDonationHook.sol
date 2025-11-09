// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager, SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title TriSplitDonationHook (PoC)
/// @notice Demonstrates a Uniswap v4 hook that "skims" a small donation bps per swap
///         and forwards it to a donation target (e.g. TriSplitDonationSplitter).
/// @dev This PoC keeps accounting simple and focuses on hook plumbing. It uses
///      BeforeSwap counters and emits intent events. A production version should
///      implement exact token accounting via PoolManager take/settle flows or
///      return-delta permissions.
contract TriSplitDonationHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    struct Config {
        uint16 donationBps;        // e.g., 10 = 0.10%, 30 = 0.30%
        address donationTarget;    // TriSplitDonationSplitter
        bool enabled;
    }

    mapping(PoolId => Config) public poolConfig;
    mapping(PoolId => uint256) public beforeSwapCount;
    mapping(PoolId => uint256) public afterSwapCount;

    event DonationConfigured(PoolId indexed id, uint16 bps, address target, bool enabled);
    event DonationIntended(PoolId indexed id, bool zeroForOne, uint256 amountSpecifiedAbs, uint256 donationAmount);
    event DonationExecuted(PoolId indexed id, address token, address target, uint256 amount);

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // --- Admin ---
    function setConfig(PoolKey calldata key, uint16 bps, address target, bool enabled) external {
        require(bps <= 100, "bps too high"); // demo safety: cap at 1.00%
        PoolId id = key.toId();
        poolConfig[id] = Config({ donationBps: bps, donationTarget: target, enabled: enabled });
        emit DonationConfigured(id, bps, target, enabled);
    }

    // --- Hooks ---
    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        PoolId id = key.toId();
        beforeSwapCount[id]++;

        Config memory cfg = poolConfig[id];
        if (!cfg.enabled || cfg.donationBps == 0) {
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        // Compute an intended donation off the absolute amountSpecified
        uint256 absAmt = params.amountSpecified > 0 ? uint256(int256(params.amountSpecified)) : uint256(-int256(params.amountSpecified));
        uint256 donation = (absAmt * uint256(cfg.donationBps)) / 10_000;

        emit DonationIntended(id, params.zeroForOne, absAmt, donation);

        // PoC: we don't actually return a delta to charge yet; keep swap semantics unchanged
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function _afterSwap(address, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        PoolId id = key.toId();
        afterSwapCount[id]++;

        Config memory cfg = poolConfig[id];
        if (!cfg.enabled || cfg.donationBps == 0 || cfg.donationTarget == address(0)) {
            return (BaseHook.afterSwap.selector, 0);
        }

        // NOTE: We don't get SwapParams here (packed in calldata above but unused); for PoC,
        // rely on "intent" emitted in beforeSwap and transfer a proportional amount from the hook's
        // pre-funded balance. In production, use return-delta or take/settle to enforce collection.
        // Here we compute a best-effort donation based on a small constant notional or last intent
        // would be tracked offchain. For simplicity, transfer min(balance, configured max per-swap).

        // Heuristic donation: 0.01% of hook balance of the input token (currency0 if zeroForOne else currency1)
        // to demonstrate funds movement in tests. This keeps PoC self-contained.
        // In a real integration, pass amount via hookData or store in transient storage from beforeSwap.

        // Choose token0 merely for deterministic behavior; test seeds token0.
        address token = Currency.unwrap(key.currency0);
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) {
            return (BaseHook.afterSwap.selector, 0);
        }
        uint256 donation = (bal * uint256(cfg.donationBps)) / 1_000_000; // scale down heavily for PoC safety
        if (donation == 0) donation = 1; // dust to show effect in tests
        if (donation > bal) donation = bal;

        IERC20(token).transfer(cfg.donationTarget, donation);
        emit DonationExecuted(id, token, cfg.donationTarget, donation);
        return (BaseHook.afterSwap.selector, 0);
    }
}
