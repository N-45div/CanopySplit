// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IPermit2} from "permit2/src/interfaces/IPermit2.sol";

import {IUniswapV4Router04} from "hookmate/interfaces/router/IUniswapV4Router04.sol";
import {AddressConstants} from "hookmate/constants/AddressConstants.sol";

import {Deployers} from "test/utils/Deployers.sol";

/// @notice Shared configuration between scripts
contract BaseScript is Script, Deployers {
    address immutable deployerAddress;

    /////////////////////////////////////
    // --- Configure These ---
    /////////////////////////////////////
    IERC20 internal token0;
    IERC20 internal token1;
    IHooks constant hookContract = IHooks(address(0));
    /////////////////////////////////////

    Currency immutable currency0;
    Currency immutable currency1;

    constructor() {
        // Make sure artifacts are available, either deploy or configure.
        deployArtifacts();

        deployerAddress = getDeployer();

        // Configure token addresses (allow env override)
        address t0 = vm.envOr("TOKEN0_ADDR", address(0x0165878A594ca255338adfa4d48449f69242Eb8F));
        address t1 = vm.envOr("TOKEN1_ADDR", address(0xa513E6E4b8f2a923D98304ec87F64353C4D5C853));
        token0 = IERC20(t0);
        token1 = IERC20(t1);

        (currency0, currency1) = getCurrencies();

        // Optional: override with env-provided addresses (from a prior 00_DeployV4 run)
        address pm = vm.envOr("POOL_MANAGER_ADDR", address(0));
        address posm = vm.envOr("POSITION_MANAGER_ADDR", address(0));
        address router = vm.envOr("SWAP_ROUTER_ADDR", address(0));
        address p2 = vm.envOr("PERMIT2_ADDR", address(0));
        if (pm != address(0)) {
            poolManager = IPoolManager(pm);
        }
        if (posm != address(0)) {
            positionManager = IPositionManager(posm);
        }
        if (router != address(0)) {
            swapRouter = IUniswapV4Router04(payable(router));
        }
        if (p2 != address(0)) {
            permit2 = IPermit2(p2);
        }

        vm.label(address(permit2), "Permit2");
        vm.label(address(poolManager), "V4PoolManager");
        vm.label(address(positionManager), "V4PositionManager");
        vm.label(address(swapRouter), "V4SwapRouter");

        vm.label(address(token0), "Currency0");
        vm.label(address(token1), "Currency1");

        vm.label(address(hookContract), "HookContract");
    }

    function _etch(address target, bytes memory bytecode) internal override {
        if (block.chainid == 31337) {
            vm.rpc("anvil_setCode", string.concat('["', vm.toString(target), '",', '"', vm.toString(bytecode), '"]'));
        } else {
            revert("Unsupported etch on this network");
        }
    }

    function getCurrencies() internal view returns (Currency, Currency) {
        address t0 = address(token0);
        address t1 = address(token1);
        require(t0 != t1, "token addrs equal");

        if (t0 < t1) {
            return (Currency.wrap(t0), Currency.wrap(t1));
        } else {
            return (Currency.wrap(t1), Currency.wrap(t0));
        }
    }

    function getDeployer() internal returns (address) {
        address[] memory wallets = vm.getWallets();

        if (wallets.length > 0) {
            return wallets[0];
        } else {
            return msg.sender;
        }
    }
}
