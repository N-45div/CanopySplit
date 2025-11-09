// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITokenizedStrategy} from "@octant-core/core/interfaces/ITokenizedStrategy.sol";

import {TriSplitDonationSplitter} from "src/periphery/TriSplitDonationSplitter.sol";
import {YieldDonatingTokenizedStrategy} from "@octant-core/strategies/yieldDonating/YieldDonatingTokenizedStrategy.sol";
import {AaveYieldDonatingStrategy} from "src/strategies/yieldDonating/AaveYieldDonatingStrategy.sol";

/// @notice Deploy a NEW TriSplit splitter bound to a NEW Aave-backed strategy.
///         Copies recipients/bps and current epoch from the existing splitter.
/// Env:
///  - PRIVATE_KEY: deployer key
///  - SPLITTER_ADDRESS: existing TriSplitDonationSplitter to copy config from
///  - AAVE_POOL: Aave v3 Pool (proxy) address on Sepolia
///  - AAVE_ATOKEN: aToken address for the asset (aUSDC) on Sepolia
///  - USDC_UNDERLYING: underlying USDC ERC20 used by Aave reserve (e.g. 0x94a9...E4C8)
contract DeployAaveWithNewSplitter is Script {
    function run() external {
        uint256 pk = uint256(vm.envBytes32("PRIVATE_KEY"));
        address owner = vm.addr(pk);
        vm.startBroadcast(pk);

        // Env configuration
        address sourceSplitterAddr = vm.envAddress("SPLITTER_ADDRESS");
        address aavePool = vm.envAddress("AAVE_POOL");
        address aToken = vm.envAddress("AAVE_ATOKEN");

        // Underlying USDC for the Aave reserve (passed via env)
        IERC20 usdc = IERC20(vm.envAddress("USDC_UNDERLYING"));

        // Read config from existing splitter
        TriSplitDonationSplitter source = TriSplitDonationSplitter(payable(sourceSplitterAddr));
        uint256 epoch = source.currentEpoch();
        (address[3] memory recipients, uint16[3] memory bps) = source.getEpochWeights(epoch);

        // 1) Deploy NEW splitter (no vault yet), copying current epoch and weights
        TriSplitDonationSplitter newSplitter = new TriSplitDonationSplitter(
            ITokenizedStrategy(address(0)),
            owner,
            epoch,
            recipients,
            bps
        );

        // 2) Deploy TokenizedStrategy implementation (per-strategy clone pattern)
        YieldDonatingTokenizedStrategy tokenized = new YieldDonatingTokenizedStrategy();

        // 3) Deploy Aave-backed strategy; donationAddress set to the NEW splitter
        AaveYieldDonatingStrategy strategy = new AaveYieldDonatingStrategy(
            aavePool,
            aToken,
            address(usdc),
            "CanopySplit Aave USDC",
            owner,      // management
            owner,      // keeper
            owner,      // emergencyAdmin
            address(newSplitter), // donationAddress -> NEW splitter
            true,       // enableBurning
            address(tokenized)
        );

        // 4) Bind NEW splitter to the NEW strategy as its vault
        newSplitter.setVault(ITokenizedStrategy(address(strategy)));

        console2.log("Old Splitter (copied):", sourceSplitterAddr);
        console2.log("New Splitter:", address(newSplitter));
        console2.log("Aave Strategy:", address(strategy));
        console2.log("Aave Pool:", aavePool);
        console2.log("aToken:", aToken);

        vm.stopBroadcast();
    }
}
