// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {YieldDonatingStrategy} from "./YieldDonatingStrategy.sol";

/// @title Aave ERC-4626 ATokenVault-backed Yield Donating Strategy
/// @notice Adapter that routes deposits/withdrawals via an ERC-4626 ATokenVault; profits are donated via TokenizedStrategy
contract Aave4626YieldDonatingStrategy is YieldDonatingStrategy {
    using SafeERC20 for ERC20;

    IERC4626 public immutable aTokenVault; // Aave ERC-4626 wrapper vault for the reserve

    constructor(
        address _aTokenVault,
        address _asset,
        string memory _name,
        address _management,
        address _keeper,
        address _emergencyAdmin,
        address _donationAddress,
        bool _enableBurning,
        address _tokenizedStrategyAddress
    )
        // Approve the 4626 vault to pull underlying
        YieldDonatingStrategy(
            _aTokenVault,
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
        aTokenVault = IERC4626(_aTokenVault);
    }

    /// @dev Deploy idle funds into the 4626 vault
    function _deployFunds(uint256 _amount) internal override {
        if (_amount == 0) return;
        // deposit underlying from this strategy, receive 4626 shares to this strategy
        aTokenVault.deposit(_amount, address(this));
    }

    /// @dev Free funds by withdrawing underlying from the 4626 vault
    function _freeFunds(uint256 _amount) internal override {
        if (_amount == 0) return;
        aTokenVault.withdraw(_amount, address(this), address(this));
    }

    /// @dev Report total assets as loose underlying + vault position valued in underlying
    function _harvestAndReport() internal override returns (uint256 _totalAssets) {
        uint256 loose = asset.balanceOf(address(this));
        uint256 shares = ERC20(address(aTokenVault)).balanceOf(address(this));
        uint256 vaultAssets = shares == 0 ? 0 : aTokenVault.convertToAssets(shares);
        _totalAssets = loose + vaultAssets;
    }
}
