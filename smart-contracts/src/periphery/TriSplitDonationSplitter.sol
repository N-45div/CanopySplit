// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ITokenizedStrategy} from "@octant-core/core/interfaces/ITokenizedStrategy.sol";

/// @title TriSplitDonationSplitter
/// @notice Receives strategy shares (minted as donated yield) and redeems them
/// into underlying assets, forwarding to three recipients by epoch weights.
contract TriSplitDonationSplitter is Ownable {
    using SafeERC20 for IERC20;

    struct Weights {
        address[3] recipients;
        uint16[3] bps; // must sum to 10000
    }

    ITokenizedStrategy public vault; // Octant TokenizedStrategy (ERC4626-compatible)
    IERC20 public asset;             // Underlying ERC20 asset of the strategy

    uint256 public currentEpoch;
    mapping(uint256 => Weights) private epochWeights; // epoch => weights

    event WeightsSet(uint256 indexed epoch, address[3] recipients, uint16[3] bps);
    event VaultSet(address indexed vault, address indexed asset);
    event EpochRolled(uint256 indexed newEpoch);
    event Distributed(uint256 indexed epoch, uint256 sharesRedeemed, uint256 assetsDistributed);

    error BadWeights();

    constructor(
        ITokenizedStrategy _vault,
        address _owner,
        uint256 _startEpoch,
        address[3] memory _recipients,
        uint16[3] memory _bps
    ) Ownable(_owner) {
        if (address(_vault) != address(0)) {
            vault = _vault;
            asset = IERC20(_vault.asset());
            emit VaultSet(address(_vault), address(asset));
        }
        currentEpoch = _startEpoch;
        _setWeights(_startEpoch, _recipients, _bps);
    }

    /// @notice One-time set of the associated TokenizedStrategy; binds asset as well.
    function setVault(ITokenizedStrategy _vault) external onlyOwner {
        require(address(vault) == address(0), "vault already set");
        vault = _vault;
        asset = IERC20(_vault.asset());
        emit VaultSet(address(_vault), address(asset));
    }

    // --- Admin ---

    function setEpochWeights(
        uint256 epoch,
        address[3] memory recipients,
        uint16[3] memory bps
    ) external onlyOwner {
        _setWeights(epoch, recipients, bps);
    }

    function rollEpoch(uint256 newEpoch) external onlyOwner {
        require(newEpoch > currentEpoch, "epoch not increasing");
        currentEpoch = newEpoch;
        emit EpochRolled(newEpoch);
    }

    /// @notice Convenience: update weights for the current epoch.
    function setCurrentEpochWeights(
        address[3] memory recipients,
        uint16[3] memory bps
    ) external onlyOwner {
        _setWeights(currentEpoch, recipients, bps);
    }

    function _setWeights(
        uint256 epoch,
        address[3] memory recipients,
        uint16[3] memory bps
    ) internal {
        uint256 sum = uint256(bps[0]) + bps[1] + bps[2];
        if (sum != 10_000) revert BadWeights();
        epochWeights[epoch] = Weights({recipients: recipients, bps: bps});
        emit WeightsSet(epoch, recipients, bps);
    }

    /// @notice Getter for epoch weights (recipients, bps).
    function getEpochWeights(uint256 epoch)
        external
        view
        returns (address[3] memory recipients, uint16[3] memory bps)
    {
        Weights memory w = epochWeights[epoch];
        return (w.recipients, w.bps);
    }

    // --- Distribution ---

    /// @notice Number of strategy shares currently held (donations awaiting redemption).
    function pendingShares() public view returns (uint256) {
        if (address(vault) == address(0)) return 0;
        return IERC20(address(vault)).balanceOf(address(this));
    }

    /// @notice Redeem all shares and forward underlying assets to recipients per current epoch weights.
    function distributeAll() external returns (uint256 sharesRedeemed, uint256 assetsOut) {
        uint256 shares = pendingShares();
        return distribute(shares);
    }

    /// @notice Redeem `shares` and forward underlying assets to recipients per current epoch weights.
    function distribute(uint256 shares)
        public
        returns (uint256 sharesRedeemed, uint256 assetsOut)
    {
        if (shares == 0) return (0, 0);
        require(address(vault) != address(0), "vault not set");

        Weights memory w = epochWeights[currentEpoch];
        // Redeem to this contract, from this contract, with 0 maxLoss tolerance.
        uint256 assetsReceived = vault.redeem(shares, address(this), address(this), 0);

        // Split by bps and transfer
        uint256 a0 = (assetsReceived * w.bps[0]) / 10_000;
        uint256 a1 = (assetsReceived * w.bps[1]) / 10_000;
        uint256 a2 = assetsReceived - a0 - a1; // avoid rounding dust

        if (a0 > 0) asset.safeTransfer(w.recipients[0], a0);
        if (a1 > 0) asset.safeTransfer(w.recipients[1], a1);
        if (a2 > 0) asset.safeTransfer(w.recipients[2], a2);

        emit Distributed(currentEpoch, shares, assetsReceived);
        return (shares, assetsReceived);
    }

    /// @notice Split the splitter's current asset balance by epoch weights (without redeeming shares).
    function distributeRaw() external returns (uint256 assetsOut) {
        require(address(asset) != address(0), "asset not set");
        Weights memory w = epochWeights[currentEpoch];
        uint256 assetsReceived = asset.balanceOf(address(this));
        if (assetsReceived == 0) return 0;

        uint256 a0 = (assetsReceived * w.bps[0]) / 10_000;
        uint256 a1 = (assetsReceived * w.bps[1]) / 10_000;
        uint256 a2 = assetsReceived - a0 - a1;

        if (a0 > 0) asset.safeTransfer(w.recipients[0], a0);
        if (a1 > 0) asset.safeTransfer(w.recipients[1], a1);
        if (a2 > 0) asset.safeTransfer(w.recipients[2], a2);

        emit Distributed(currentEpoch, 0, assetsReceived);
        return assetsReceived;
    }

    /// @notice Rescue any ERC20 mistakenly sent.
    function sweep(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
