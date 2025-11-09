// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {YieldDonatingStrategy} from "./YieldDonatingStrategy.sol";

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

/// @title Aave-backed Yield Donating Strategy
/// @notice Minimal adapter that routes deposits to Aave v3 and withdraws from it; profits still minted to donationAddress via TokenizedStrategy
contract AaveYieldDonatingStrategy is YieldDonatingStrategy {
    using SafeERC20 for ERC20;

    address public immutable AAVE_POOL; // Aave v3 Pool
    address public immutable A_TOKEN;   // aToken corresponding to the asset (e.g., aUSDC)

    constructor(
        address _pool,
        address _aToken,
        address _asset,
        string memory _name,
        address _management,
        address _keeper,
        address _emergencyAdmin,
        address _donationAddress,
        bool _enableBurning,
        address _tokenizedStrategyAddress
    )
        // Pass the pool as the "yieldSource" for the base constructor approval wiring
        YieldDonatingStrategy(
            _pool,
            _asset,
            _name,
            _management,
            _keeper,
            _emergencyAdmin,
            _donationAddress,
            _enableBurning,
            _tokenizedStrategyAddress
        )
    {
        AAVE_POOL = _pool;
        A_TOKEN = _aToken;
    }

    /// @dev Deploy idle funds into Aave
    function _deployFunds(uint256 _amount) internal override {
        if (_amount == 0) return;
        IAavePool(AAVE_POOL).supply(address(asset), _amount, address(this), 0);
    }

    /// @dev Free funds from Aave
    function _freeFunds(uint256 _amount) internal override {
        if (_amount == 0) return;
        IAavePool(AAVE_POOL).withdraw(address(asset), _amount, address(this));
    }

    /// @dev Report total assets as loose asset + aToken balance
    function _harvestAndReport() internal override returns (uint256 _totalAssets) {
        uint256 loose = asset.balanceOf(address(this));
        uint256 aBal = IERC20(A_TOKEN).balanceOf(address(this));
        _totalAssets = loose + aBal;
    }
}
