// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITokenizedStrategy} from "@octant-core/core/interfaces/ITokenizedStrategy.sol";

import {TriSplitDonationSplitter} from "src/periphery/TriSplitDonationSplitter.sol";
import {YieldDonatingStrategyFactory} from "src/strategies/yieldDonating/YieldDonatingStrategyFactory.sol";

contract DeployTriSplit is Script {
    function run() external {
        uint256 pk = uint256(vm.envBytes32("PRIVATE_KEY"));
        address owner = vm.addr(pk);
        vm.startBroadcast(pk);

        // Sepolia USDC
        IERC20 usdc = IERC20(0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238);

        // Recipients and weights
        address[3] memory recipients = [
            address(0xF9b2eFCAcc1B93c1bd7F898d0a8c4b34aBD78E53),
            address(0x9261432cab3c0F83E86fa6e41E4a88dA06E7ecc6),
            address(0x89C13e8e5a81E775160322df9d7869893926A8Cc)
        ];
        uint16[3] memory bps = [uint16(5000), uint16(3000), uint16(2000)];

        // 1) Deploy TriSplitDonationSplitter with no vault set yet
        TriSplitDonationSplitter splitter = new TriSplitDonationSplitter(
            ITokenizedStrategy(address(0)),
            owner,
            1,
            recipients,
            bps
        );

        // 2) Deploy Strategy Factory with donationAddress set to splitter
        // Use owner for all roles for now; can be updated later via setAddresses
        YieldDonatingStrategyFactory factory = new YieldDonatingStrategyFactory(
            owner,               // management
            address(splitter),   // donationAddress (dragon router)
            owner,               // keeper
            owner                // emergencyAdmin
        );

        // 3) Deploy YieldDonatingStrategy via factory (idle variant). Provide a non-zero yield source
        //    to satisfy the constructor's forceApprove; using splitter address as placeholder yield source.
        address strategy = factory.newStrategy(
            address(splitter),
            address(usdc),
            "TriSplit YDS USDC"
        );

        // 4) Bind splitter to the strategy as its vault (TokenizedStrategy interface lives on the strategy address)
        splitter.setVault(ITokenizedStrategy(strategy));

        console2.log("Splitter:", address(splitter));
        console2.log("Strategy:", strategy);

        vm.stopBroadcast();
    }
}
