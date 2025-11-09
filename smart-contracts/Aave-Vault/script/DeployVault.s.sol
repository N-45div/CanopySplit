// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {ProxyAdmin} from "@openzeppelin/proxy/transparent/ProxyAdmin.sol";
import {IPoolAddressesProvider} from "@aave-v3-core/interfaces/IPoolAddressesProvider.sol";
import {ATokenVaultFactory} from "src/ATokenVaultFactory.sol";

contract DeployVault is Script {
    function run() external {
        uint256 pk = uint256(vm.envBytes32("PRIVATE_KEY"));
        address owner = vm.addr(pk);
        vm.startBroadcast(pk);

        address underlying = vm.envAddress("USDC_UNDERLYING");
        address provider = vm.envAddress("AAVE_ADDRESSES_PROVIDER");
        uint256 initialLock = vm.envUint("INITIAL_LOCK_DEPOSIT"); // e.g. 1000000 for 1 USDC (6dp)
        uint256 initialFee = 0; // optional: set via script constant
        uint16 referralCode = 0; // optional: set via script constant
        string memory shareName = "Aave USDC Vault";
        string memory shareSymbol = "vaUSDC";

        // 1) ProxyAdmin with renounced ownership
        ProxyAdmin admin = new ProxyAdmin();
        admin.renounceOwnership();

        // 2) Factory
        ATokenVaultFactory factory = new ATokenVaultFactory(address(admin));

        // 3) Approve factory to pull initial lock deposit from deployer
        IERC20(underlying).approve(address(factory), initialLock);

        // 4) Deploy vault
        ATokenVaultFactory.VaultParams memory params = ATokenVaultFactory.VaultParams({
            underlying: underlying,
            referralCode: referralCode,
            poolAddressesProvider: IPoolAddressesProvider(provider),
            owner: owner,
            initialFee: initialFee,
            shareName: shareName,
            shareSymbol: shareSymbol,
            initialLockDeposit: initialLock
        });

        address vault = factory.deployVault(params);

        console2.log("ProxyAdmin:", address(admin));
        console2.log("ATokenVaultFactory:", address(factory));
        console2.log("ATokenVault (proxy):", vault);

        vm.stopBroadcast();
    }
}
