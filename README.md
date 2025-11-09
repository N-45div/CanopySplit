# CanopySplit

Donate your yield, keep your principal. CanopySplit is a DeFi protocol that lets you deposit an ERC-20 ASSET (e.g., USDC) into yield-generating strategies and automatically splits the profits among climate impact recipients.

## What it does

- Deposit ASSET (ERC-20) and earn yield from Aave v3
- Keep 100% of your principal
- All profits go to climate projects (tree planting, monitoring, maintenance)
- Transparent on-chain distribution with customizable epoch-based splits
- Innovative Uniswap v4 hook that donates a portion of swap fees

## Live on Sepolia

**Main Contracts**
- Aave Strategy: `0x99D8C89E43AA7Cf4628D6F496Ba749D077f78A8B`
- Splitter: `0xe1F4d6b65e37282D5E1d9e5e9bbd3b0F27683eea`
- Asset (USDC on Sepolia): `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

**Climate Recipients**
- Planters: `0xF9b2eFCAcc1B93c1bd7F898d0a8c4b34aBD78E53` (50%)
- MRV: `0x9261432cab3c0F83E86fa6e41E4a88dA06E7ecc6` (30%)
- Maintenance: `0x89C13e8e5a81E775160322df9d7869893926A8Cc` (20%)

## How it works

```mermaid
flowchart TD
    subgraph UserSide["User Side"]
        U["User Wallet<br/>(RainbowKit)"]
        FE["Frontend<br/>React + Vite + Wagmi"]
        U --> FE
    end

    subgraph OnChain["On-chain (Sepolia)"]
        ASSET["ASSET Token<br/>0x1c7D...7238"]
        STR["YieldDonatingStrategy<br/>0x99D8...8A8B"]
        SPL["TriSplitDonationSplitter<br/>0xe1F4...eea"]

        ASSET --> STR
        STR -- "yield/harvest" --> SPL
        SPL --> P["Planters<br/>0xF9b2...8E53"]
        SPL --> M["MRV<br/>0x9261...ecc6"]
        SPL --> MA["Maintenance<br/>0x89C1...A8Cc"]
    end

    FE <--> STR
    FE <--> SPL

    subgraph Roles
        MGMT["Strategy Management"]
        KP["Strategy Keeper"]
        OWN["Splitter Owner"]
    end

    MGMT -.-> STR
    KP -.-> STR
    OWN -.-> SPL
```

## Project structure

```
octant/
├── frontend/              # React dApp with wallet integration
├── smart-contracts/       # Main Octant v2 Yield Donating Strategies
│   ├── src/
│   │   ├── strategies/yieldDonating/
│   │   │   ├── YieldDonatingStrategy.sol          # Base idle strategy
│   │   │   ├── AaveYieldDonatingStrategy.sol      # Aave v3 integration
│   │   │   └── Aave4626YieldDonatingStrategy.sol  # ERC-4626 wrapper
│   │   └── periphery/
│   │       └── TriSplitDonationSplitter.sol       # Epoch-based splitter
│   ├── Aave-Vault/        # Aave ERC-4626 vault (submodule)
│   └── v4-template/       # Uniswap v4 hook (submodule)
│       └── src/
│           └── TriSplitDonationHook.sol           # Fee donation hook
└── README.md
```

## Getting started

### Frontend

```bash
cd frontend
npm install
```

Create `.env`:
```env
VITE_SEPOLIA_RPC_URL=your_rpc_url
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

Run:
```bash
npm run dev
```

### Smart contracts

```bash
cd smart-contracts
forge install
forge build
forge test
```

For deployment, copy `.env.example` to `.env` and configure your keys.

## Features

### Yield Donating Strategy (Octant v2)
- **Multiple yield sources**: Idle, Aave v3, and ERC-4626 adapters
- **Donation mechanics**: Profits mint shares to splitter, losses burn donation shares first
- **Role-based access**: Management, Keeper, and Emergency Admin roles
- **ERC-4626 compliant**: Standard vault interface

### TriSplit Donation Splitter
- **Epoch-based allocation**: Configurable weights per epoch
- **Three recipients**: Planters (50%), MRV (30%), Maintenance (20%)
- **Dynamic policy**: Owner can adjust future epoch weights
- **Event tracking**: Full on-chain receipts for donations

### Uniswap v4 Hook (Local PoC)
- **Swap fee donations**: Configurable basis points per pool
- **Transparent**: Events for every donation
- **Opt-in**: Traders choose to participate
- **Tested locally**: Full Foundry test suite

### Frontend
- **Multi-page UI**: Strategy, Splitter, Impact, and Hooks pages
- **Role-gated actions**: Different controls for users vs admins
- **Real-time updates**: Live metrics and event feeds
- **Wallet integration**: RainbowKit with Sepolia support
- **Dynamic asset detection**: Frontend reads `asset()` from the strategy (no hardcoded token address)

## Integrations

### Aave v3
- Uses Aave's ERC-4626 ATokenVault for the configured ASSET (USDC on Sepolia)
- Automatic yield accrual through aTokens
- Safety checks for supply caps and liquidity

### Uniswap v4 (Local)
- Custom hook that donates swap fees
- BeforeSwap/AfterSwap hooks with delta returns
- Configurable donation percentage per pool
- Full test coverage with local deployment scripts

## Prize Positioning

This project targets:
- ✅ **Best use of Yield Donating Strategy** - Full Octant v2 implementation with multiple adapters
- ✅ **Best Public Goods Project** - Climate impact with transparent allocation
- ✅ **Best Code Quality** - Comprehensive tests, clean architecture, documentation
- ✅ **Best use of Aave v3** - ERC-4626 vault integration with safety checks
- ✅ **Best Use of Uniswap v4 Hooks** - Novel fee donation mechanism
- ✅ **Most creative use of Octant v2** - Epoch-based splits + UI innovation
- ✅ **Best Tutorial** - Clear docs, video demos, runnable examples

## License

MIT
