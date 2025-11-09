// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITokenizedStrategy} from "@octant-core/core/interfaces/ITokenizedStrategy.sol";

import {TriSplitDonationSplitter} from "src/periphery/TriSplitDonationSplitter.sol";
import {YieldDonatingTokenizedStrategy} from "@octant-core/strategies/yieldDonating/YieldDonatingTokenizedStrategy.sol";
import {Aave4626YieldDonatingStrategy} from "src/strategies/yieldDonating/Aave4626YieldDonatingStrategy.sol";

/// @notice Deploy NEW TriSplit + NEW Aave 4626-backed strategy and bind them together.
/// Env:
///  - PRIVATE_KEY: deployer key
///  - SPLITTER_ADDRESS: existing TriSplitDonationSplitter to copy current epoch + weights from
///  - USDC_UNDERLYING: underlying USDC (e.g. 0x94a9...E4C8 on Sepolia)
///  - ATOKEN_VAULT: deployed Aave ERC-4626 ATokenVault address for that underlying
contract DeployAave4626WithNewSplitter is Script {
    function run() external {
        uint256 pk = uint256(vm.envBytes32("PRIVATE_KEY"));
        address owner = vm.addr(pk);
        vm.startBroadcast(pk);

        address sourceSplitterAddr = vm.envAddress("SPLITTER_ADDRESS");
        address usdcUnderlying = vm.envAddress("USDC_UNDERLYING");
        address aTokenVault = vm.envAddress("ATOKEN_VAULT");

        IERC20 usdc = IERC20(usdcUnderlying);

        // Read current epoch + weights from source splitter
        TriSplitDonationSplitter source = TriSplitDonationSplitter(payable(sourceSplitterAddr));
        uint256 epoch = source.currentEpoch();
        (address[3] memory recipients, uint16[3] memory bps) = source.getEpochWeights(epoch);

        // 1) New splitter
        TriSplitDonationSplitter newSplitter = new TriSplitDonationSplitter(
            ITokenizedStrategy(address(0)),
            owner,
            epoch,
            recipients,
            bps
        );

        // 2) TokenizedStrategy implementation (per-strategy clone pattern)
        YieldDonatingTokenizedStrategy tokenized = new YieldDonatingTokenizedStrategy();

        // 3) New Aave 4626-backed strategy; donationAddress set to the NEW splitter
        Aave4626YieldDonatingStrategy strategy = new Aave4626YieldDonatingStrategy(
            aTokenVault,
            address(usdc),
            "CanopySplit Aave 4626 USDC",
            owner,      // management
            owner,      // keeper
            owner,      // emergencyAdmin
            address(newSplitter),
            true,       // enableBurning
            address(tokenized)
        );

        // 4) Bind splitter to the strategy as its vault (one-time)
        newSplitter.setVault(ITokenizedStrategy(address(strategy)));

        console2.log("Source Splitter (copied):", sourceSplitterAddr);
        console2.log("New Splitter:", address(newSplitter));
        console2.log("Aave 4626 Strategy:", address(strategy));
        console2.log("ATokenVault:", aTokenVault);
        console2.log("Underlying USDC:", usdcUnderlying);

        vm.stopBroadcast();
    }
}
