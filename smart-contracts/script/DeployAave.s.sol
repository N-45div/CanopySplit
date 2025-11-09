// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITokenizedStrategy} from "@octant-core/core/interfaces/ITokenizedStrategy.sol";

import {TriSplitDonationSplitter} from "src/periphery/TriSplitDonationSplitter.sol";
import {YieldDonatingTokenizedStrategy} from "@octant-core/strategies/yieldDonating/YieldDonatingTokenizedStrategy.sol";
import {AaveYieldDonatingStrategy} from "src/strategies/yieldDonating/AaveYieldDonatingStrategy.sol";

/// @notice Deploy an Aave-backed Yield Donating Strategy and bind it to an existing TriSplit splitter.
/// Env:
///  - PRIVATE_KEY: deployer key
///  - SPLITTER_ADDRESS: existing TriSplitDonationSplitter address to receive donations
///  - AAVE_POOL: Aave v3 Pool (proxy) address on Sepolia
///  - AAVE_ATOKEN: aToken address for the asset (aUSDC) on Sepolia
contract DeployAave is Script {
    function run() external {
        uint256 pk = uint256(vm.envBytes32("PRIVATE_KEY"));
        address owner = vm.addr(pk);
        vm.startBroadcast(pk);

        // Env configuration
        address splitterAddr = vm.envAddress("SPLITTER_ADDRESS");
        address aavePool = vm.envAddress("AAVE_POOL");
        address aToken = vm.envAddress("AAVE_ATOKEN");

        // Sepolia USDC
        IERC20 usdc = IERC20(0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238);

        // Existing splitter
        TriSplitDonationSplitter splitter = TriSplitDonationSplitter(payable(splitterAddr));

        // TokenizedStrategy implementation (per-strategy clone pattern)
        YieldDonatingTokenizedStrategy tokenized = new YieldDonatingTokenizedStrategy();

        // Deploy Aave-backed strategy; donationAddress set to splitter
        AaveYieldDonatingStrategy strategy = new AaveYieldDonatingStrategy(
            aavePool,
            aToken,
            address(usdc),
            "CanopySplit Aave USDC",
            owner,      // management
            owner,      // keeper
            owner,      // emergencyAdmin
            splitterAddr,
            true,       // enableBurning
            address(tokenized)
        );

        // Bind splitter to the strategy vault if not already set
        if (address(splitter.vault()) == address(0)) {
            splitter.setVault(ITokenizedStrategy(address(strategy)));
        } else {
            console2.log("Splitter already has vault set to:", address(splitter.vault()));
            console2.log("Skipping setVault. If you want to use this new strategy, deploy a new splitter and bind it to this strategy.");
        }

        console2.log("Splitter:", splitterAddr);
        console2.log("Aave Strategy:", address(strategy));
        console2.log("Aave Pool:", aavePool);
        console2.log("aToken:", aToken);

        vm.stopBroadcast();
    }
}
