// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {BaseScript} from "./base/BaseScript.sol";
import {LiquidityHelpers} from "./base/LiquidityHelpers.sol";

contract AddLiquidityScript is BaseScript, LiquidityHelpers {
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    /////////////////////////////////////
    // --- Configure These ---
    /////////////////////////////////////

    uint24 lpFee = 3000; // 0.30%
    int24 tickSpacing = 60;

    // --- liquidity position configuration --- //
    uint256 public token0Amount = 1e18;
    uint256 public token1Amount = 1e18;

    /////////////////////////////////////

    int24 tickLower;
    int24 tickUpper;

    function run() external {
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: lpFee,
            tickSpacing: tickSpacing,
            hooks: IHooks(vm.envAddress("HOOK_ADDR"))
        });

        uint128 liquidity;
        uint256 amount0Desired;
        uint256 amount1Desired;
        {
            uint8 d0 = currency0.isAddressZero() ? 18 : IERC20Metadata(Currency.unwrap(currency0)).decimals();
            uint8 d1 = currency1.isAddressZero() ? 18 : IERC20Metadata(Currency.unwrap(currency1)).decimals();
            amount0Desired = 10 ** d0;
            amount1Desired = 10 ** d1;

            (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKey.toId());
            int24 currentTick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);
            int24 baseTick = (currentTick / tickSpacing) * tickSpacing;
            int24 minUsableTick = (TickMath.MIN_TICK / tickSpacing) * tickSpacing;
            int24 maxUsableTick = (TickMath.MAX_TICK / tickSpacing) * tickSpacing;
            // if current tick is near extremes, recenter to 0
            if (currentTick < minUsableTick + 100000 || currentTick > maxUsableTick - 100000) {
                baseTick = 0;
            }
            int24 w = 10 * tickSpacing;
            tickLower = baseTick - w;
            tickUpper = baseTick + w;
            if (tickLower < minUsableTick) tickLower = minUsableTick;
            if (tickUpper > maxUsableTick) tickUpper = maxUsableTick;
            if (tickLower >= tickUpper) {
                tickLower = baseTick - tickSpacing;
                tickUpper = baseTick + tickSpacing;
            }

            liquidity = LiquidityAmounts.getLiquidityForAmounts(
                sqrtPriceX96,
                TickMath.getSqrtPriceAtTick(tickLower),
                TickMath.getSqrtPriceAtTick(tickUpper),
                amount0Desired,
                amount1Desired
            );
            if (liquidity == 0) liquidity = 1;
        }

        // slippage limits and mint params (inline to reduce stack pressure)
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(tickUpper);
        (uint160 sqrtAgain,,,) = poolManager.getSlot0(poolKey.toId());
        (uint256 req0, uint256 req1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtAgain, sqrtLower, sqrtUpper, liquidity
        );
        uint256 amount0Max = req0 + (req0 / 50) + 1; // +2% buffer
        uint256 amount1Max = req1 + (req1 / 50) + 1;

        (bytes memory actions, bytes[] memory mintParams) = _mintLiquidityParams(
            poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, deployerAddress, new bytes(0)
        );

        // multicall parameters
        bytes[] memory params = new bytes[](1);

        // Mint Liquidity
        params[0] = abi.encodeWithSelector(
            positionManager.modifyLiquidities.selector, abi.encode(actions, mintParams), block.timestamp + 1 days
        );

        vm.startBroadcast();
        tokenApprovals();

        // Add liquidity to existing pool
        positionManager.multicall{value: (currency0.isAddressZero() ? amount0Max : 0)}(params);
        vm.stopBroadcast();
    }
}
