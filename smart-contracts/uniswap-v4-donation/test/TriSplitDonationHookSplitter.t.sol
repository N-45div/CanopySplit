// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Constants} from "@uniswap/v4-core/test/utils/Constants.sol";
import {EasyPosm} from "./utils/libraries/EasyPosm.sol";
import {TriSplitDonationHook} from "../src/TriSplitDonationHook.sol";
import {BaseTest} from "./utils/BaseTest.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

// Minimal splitter that mimics distributeRaw()
contract LocalTriSplitSplitter {
    address public immutable asset;
    address[3] public recipients;
    uint16[3] public bps;
    constructor(address _asset, address[3] memory _recipients, uint16[3] memory _bps) {
        asset = _asset; recipients = _recipients; bps = _bps;
    }
    function distributeRaw() external returns (uint256 out) {
        uint256 bal = MockERC20(asset).balanceOf(address(this));
        if (bal == 0) return 0;
        uint256 a0 = (bal * bps[0]) / 10_000;
        uint256 a1 = (bal * bps[1]) / 10_000;
        uint256 a2 = bal - a0 - a1;
        if (a0 > 0) MockERC20(asset).transfer(recipients[0], a0);
        if (a1 > 0) MockERC20(asset).transfer(recipients[1], a1);
        if (a2 > 0) MockERC20(asset).transfer(recipients[2], a2);
        return bal;
    }
}

contract TriSplitDonationHookSplitterTest is BaseTest {
    using EasyPosm for IPositionManager;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    Currency currency0; Currency currency1;
    PoolKey poolKey; PoolId poolId;
    TriSplitDonationHook hook;
    uint256 tokenId; int24 tickLower; int24 tickUpper;

    address r0 = address(0x1111);
    address r1 = address(0x2222);
    address r2 = address(0x3333);

    function setUp() public {
        deployArtifactsAndLabel();
        (currency0, currency1) = deployCurrencyPair();

        // Hook with before/after swap flags
        address flags = address(uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG) ^ (0x7777 << 144));
        bytes memory constructorArgs = abi.encode(poolManager);
        deployCodeTo("TriSplitDonationHook.sol:TriSplitDonationHook", constructorArgs, flags);
        hook = TriSplitDonationHook(flags);

        // Pool
        poolKey = PoolKey(currency0, currency1, 3000, 60, IHooks(hook));
        poolId = poolKey.toId();
        poolManager.initialize(poolKey, Constants.SQRT_PRICE_1_1);

        // Liquidity full-range
        tickLower = TickMath.minUsableTick(poolKey.tickSpacing);
        tickUpper = TickMath.maxUsableTick(poolKey.tickSpacing);
        uint128 L = 100e18;
        (uint256 a0, uint256 a1) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            L
        );
        (tokenId,) = positionManager.mint(poolKey, tickLower, tickUpper, L, a0 + 1, a1 + 1, address(this), block.timestamp, Constants.ZERO_BYTES);

        // Seed hook with token0 for donation
        address token0 = Currency.unwrap(currency0);
        MockERC20(token0).transfer(address(hook), 2e18);

        // Deploy local splitter and point hook to it
        LocalTriSplitSplitter splitter = new LocalTriSplitSplitter(
            token0,
            [r0, r1, r2],
            [uint16(5000), uint16(3000), uint16(2000)]
        );
        hook.setConfig(poolKey, 100, address(splitter), true); // 1.00% cap (PoC scale)
    }

    function testDonationThenDistributeRaw() public {
        address token0 = Currency.unwrap(currency0);
        uint256 b0 = MockERC20(token0).balanceOf(r0);
        uint256 b1 = MockERC20(token0).balanceOf(r1);
        uint256 b2 = MockERC20(token0).balanceOf(r2);

        // Swap to trigger donation
        uint256 amountIn = 1e18;
        BalanceDelta swapDelta = swapRouter.swapExactTokensForTokens({
            amountIn: amountIn,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });
        assertEq(int256(swapDelta.amount0()), -int256(amountIn));

        // Splitter should have received some token0 via hook donation; now distribute
        (, address target, ) = hook.poolConfig(poolId);
        LocalTriSplitSplitter splitter = LocalTriSplitSplitter(target);
        uint256 distributed = splitter.distributeRaw();
        assertGt(distributed, 0, "nothing distributed");

        // Recipients got funds
        assertGt(MockERC20(token0).balanceOf(r0), b0, "r0 not funded");
        assertGt(MockERC20(token0).balanceOf(r1), b1, "r1 not funded");
        assertGt(MockERC20(token0).balanceOf(r2), b2, "r2 not funded");
    }
}
