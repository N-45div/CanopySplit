# CanopySplit

Donate your yield, keep your principal. CanopySplit is a DeFi protocol that lets you deposit an ERC-20 ASSET (e.g., WETH) into yield-generating strategies and automatically splits the profits among climate impact recipients.

## TL;DR

- **Keep principal, donate yield**: Profits from your deposits are split to climate recipients.
- **Live demo**: Local Uniswap v4 hook skims tiny bps on swaps and emits donation events you can view in the UI.
- **Production path**: Aave v3 strategy on Sepolia with epoch-based splitter and transparent on-chain receipts.

## Table of Contents

- [What it does](#what-it-does)
- [Deployment (Sepolia)](#live-on-sepolia)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Quickstart: Local Hooks Demo (Uniswap v4)](#quickstart-local-hooks-demo-uniswap-v4)
- [Features](#features)
- [Integrations](#integrations)
- [The Problem It Solves](#the-problem-it-solves)
- [Challenges We Ran Into](#challenges-we-ran-into)
- [Key Learnings](#key-learnings)
- [License](#license)

## Quickstart: Local Hooks Demo (Uniswap v4)

Follow these steps to see live donation events in the UI from a local v4 hook.

1) Set env vars (Anvil default accounts):

```bash
export RPC=http://127.0.0.1:8545
export SENDER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export TOKEN0_ADDR=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  # USDC
export TOKEN1_ADDR=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2  # WETH
export DONATION_TARGET=$SENDER
export DONATION_BPS=100
```

2) Start Anvil (separate terminal):

```bash
anvil --port 8545
```

3) Deploy v4 core and export addresses (deterministic CREATE2):

```bash
forge script smart-contracts/uniswap-v4-donation/script/testing/00_DeployV4.s.sol:DeployLocalV4 \
  --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

export PERMIT2_ADDR=0x000000000022D473030F116dDEE9F6B43aC78BA3
export POOL_MANAGER_ADDR=0x0D9BAf34817Fccd3b3068768E5d20542B66424A5
export POSITION_MANAGER_ADDR=0x90aAE8e3C8dF1d226431D0C2C7feAaa775fAF86C
export SWAP_ROUTER_ADDR=0xB61598fa7E856D43384A8fcBBAbF2Aa6aa044FfC
```

4) Deploy the hook and export its address:

```bash
forge script smart-contracts/uniswap-v4-donation/script/00_DeployHook.s.sol:DeployHookScript \
  --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

export HOOK_ADDR=<printed_hook>
```

5) Patch local tokens for Anvil (optional USDC 6 decimals at token0), initialize pool, add liquidity, and set hook config:

```bash
forge script smart-contracts/uniswap-v4-donation/script/testing/01_PatchTokens.s.sol:PatchTokens \
  --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

forge script smart-contracts/uniswap-v4-donation/script/testing/02b_PatchUSDC6_Token0.s.sol:PatchUSDC6_Token0 \
  --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

forge script smart-contracts/uniswap-v4-donation/script/05_EnsureInitialized.s.sol:EnsureInitialized \
  --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

forge script smart-contracts/uniswap-v4-donation/script/02_AddLiquidity.s.sol:AddLiquidityScript \
  --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

forge script smart-contracts/uniswap-v4-donation/script/04_SetHookConfig.s.sol:SetHookConfigScript \
  --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY
```

6) Prefund the hook with token0 (USDC) so `DonationExecuted` is emitted in this PoC, then swap:

```bash
cast send $TOKEN0_ADDR "transfer(address,uint256)(bool)" $HOOK_ADDR 10000000 \
  --rpc-url $RPC --private-key $PRIVATE_KEY   # 10 USDC (6 decimals)

forge script smart-contracts/uniswap-v4-donation/script/03_Swap.s.sol:SwapScript \
  --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY
```

7) Open the UI and view donations (Hooks page):

```bash
cd frontend && npm install && npm run dev
# http://localhost:5173/hooks → RPC http://127.0.0.1:8545, Hook = $HOOK_ADDR → Load
```

8) Troubleshooting

- If you see custom error `0x7c9c6e8f` (price limit), either re-run `EnsureInitialized` (1:1) or do one swap with `zeroForOne=false` to move price away from the edge.
- If UI is empty, ensure the hook has USDC balance and you ran at least one successful swap.

## What it does

- Deposit ASSET (ERC-20) and earn yield from Aave v3
- Keep 100% of your principal
- All profits go to climate projects (tree planting, monitoring, maintenance)
- Transparent on-chain distribution with customizable epoch-based splits
- Innovative Uniswap v4 hook that donates a portion of swap fees

## Live on Sepolia

**Main Contracts**
- Aave Strategy: `0x0D1d8AE2dD0e4B06ca0Ef2949150eb021cAf6Ce9`
- Splitter: `0xda5fA1c26Ec29497C2B103B385569286B30EC248`
- Asset (WETH on Sepolia): `0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c`

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
- **Multiple yield sources**: Aave v3, and ERC-4626 adapters
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
- Uses Aave's ERC-4626 ATokenVault for the configured ASSET (WETH on Sepolia)
- Automatic yield accrual through aTokens
- Safety checks for supply caps and liquidity

### Uniswap v4 (Local)
- Custom hook that donates swap fees
- BeforeSwap/AfterSwap hooks with delta returns
- Configurable donation percentage per pool
- Full test coverage with local deployment scripts

## The Problem It Solves

**Passive Climate Impact Without Losing Principal**

CanopySplit enables users to support climate projects without donating their capital. By depositing WETH (or any ERC-20 asset) into yield-generating strategies, users:

- **Keep 100% of their principal** - withdraw anytime, no lock-ups
- **Automatically fund climate projects** - all profits go to tree planting, MRV (monitoring/reporting/verification), and maintenance
- **Zero manual intervention** - no performance fees, no middlemen, fully automated

**Transparent, Epoch-Based Allocation**

- **Dynamic splits**: Owner can adjust future epoch weights (e.g., 50% Planters, 30% MRV, 20% Maintenance)
- **On-chain receipts**: Every distribution emits `Distributed` events with full breakdown
- **Live tracking**: Frontend shows pending donations, lifetime donated, current epoch policy

**Multi-Source Yield Aggregation**

- **Aave v3 Integration**: Deposits earn yield through aTokens (18-decimal WETH on Sepolia)
- **ERC-4626 Wrapper**: Standard vault interface for composability
- **Uniswap v4 Hook (Local PoC)**: Swap fees can also donate to the same splitter

**Role-Based Governance**

- **Management/Keeper**: Can trigger `report()` to realize profits → mint donation shares
- **Owner**: Can adjust epoch weights and roll to new epochs
- **Users**: Just deposit/withdraw; yield flows automatically

## Challenges We Ran Into

### Challenge 1: Sepolia Gas Cap Hell (16.7M limit)

**The Bug:**
```bash
Error: server returned an error response: error code -32000: 
transaction gas limit too high (cap: 16777216, tx: 25000000)

# Then when we lowered it:
Error: execution reverted: EvmError: OutOfGas (gas: 16711680)

# Foundry said "Deployed to: 0x..." but:
cast code 0xA487... --rpc-url $SEPOLIA_RPC_URL
# Returns: 0x (NO CODE!)
```

**What Was Happening:**
- Deploying `YieldDonatingTokenizedStrategy` implementation hit Sepolia's **hard per-tx gas cap of 16,777,216**
- Contract creation bytecode was **too large** even with optimizer enabled
- Foundry printed "Deployed to..." **even when the tx reverted** (misleading!)

**How We Fixed It:**
```toml
# foundry.toml - AGGRESSIVE size reduction
[profile.default]
optimizer = true
optimizer_runs = 1          # Minimize runtime size
via_ir = false              # Reduce init complexity  
bytecode_hash = "none"      # Remove metadata
cbor_metadata = false       # Remove CBOR
```

```bash
# Force clean rebuild
forge clean && forge build -vvv

# Deploy just under cap with legacy tx
forge create YieldDonatingTokenizedStrategy \
  --gas-limit 0xFD0000 \  # 16,646,144 (under cap)
  --gas-price 2gwei \
  --legacy \              # Avoid EIP-1559 estimation quirks
  --broadcast -vvvv

# VERIFY it actually exists:
cast code $IMPL --rpc-url $SEPOLIA_RPC_URL | wc -c  # > 2 = success!
```

**Result:** Successfully deployed implementation at `0xE668230D8F3289F9e252cA67Cc7dbEDaE9dB90E5`

---

### Challenge 2: WETH Pivot (USDC Supply Cap on Sepolia)

**The Bug:**
```bash
# Tried to deploy ATokenVault for USDC:
Error: call to non-contract address

# Then when we used correct PoolAddressesProvider:
# Deposits would fail with "supply cap reached" or liquidity issues
```

**What Was Happening:**
- Aave v3 Sepolia USDC market had **supply cap limits**
- Test USDC addresses on Sepolia were **fragmented** (multiple versions)
- PoolAddressesProvider address from mainnet docs **doesn't exist on Sepolia**

**How We Fixed It - THE WETH PIVOT:**
```bash
# Switched to WETH (18 decimals, no supply cap issues)
export USDC_UNDERLYING=0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c  # WETH!
export AAVE_ADDRESSES_PROVIDER=0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A  # Correct Sepolia

# Deploy ATokenVault for WETH
forge script script/DeployVault.s.sol:DeployVault \
  --rpc-url $SEPOLIA_RPC_URL --broadcast -vv

# SUCCESS:
# ATokenVault (proxy): 0x6938238e57CBe1b4B51Eb3B51389cEf8d3a88521
# ProxyAdmin: 0x119e5211b41f44362e6681e7EDF5fC07a46D7A4a
# Factory: 0x86b0e29414501643320B05AfF836D699681E450e
```

**Frontend Pivot:**
```typescript
// Dynamic asset detection (no hardcoded decimals)
const { data: asset } = useReadContract({ 
  address: strategyAddr, 
  abi: StrategyABI, 
  functionName: 'asset' 
});
const { data: decimals } = useReadContract({ 
  address: asset, 
  abi: ERC20ABI, 
  functionName: 'decimals' 
});
```

**Result:** Fully working Aave v3 integration with WETH (18 decimals), avoiding USDC supply cap issues entirely.

---

### Challenge 3: Permit2 Allowance Spender Confusion (Uniswap v4)

**The Bug:**
```bash
# Swap reverted with custom error:
Error: custom error 0xe450d38c  # InsufficientAllowance-style error

# Trace showed:
Currency0::transferFrom(deployer, PoolManager, 1e18)
└─ ← [Revert] custom error 0xe450d38c
```

**What Was Happening:**
- We granted Permit2 allowance to **PoolManager** as spender
- But the **Router** is the one that calls `permit2.transferFrom()` during settle
- Permit2 checks: `allowance[user][token][spender]` where spender = **Router**, not PoolManager!

**How We Fixed It:**
```solidity
// script/03_Swap.s.sol - BEFORE (wrong):
permit2.approve(address(token0), address(poolManager), type(uint160).max, type(uint48).max);

// AFTER (correct):
// 1. Grant ERC20 approval to Permit2
token0.approve(address(permit2), type(uint256).max);

// 2. Grant Permit2 allowance with Router as spender
permit2.approve(address(token0), address(swapRouter), type(uint160).max, type(uint48).max);

// 3. Also keep direct ERC20 approval to Router (fallback)
token0.approve(address(swapRouter), type(uint256).max);
```

**Result:** Swap executed successfully, hook emitted `DonationExecuted`, recipients received donations!

---

### Challenge 4: Token Decimal Handling (USDC 6 vs WETH 18)

**The Bug:**
```bash
# Swap with amountIn=1e18 (thinking WETH):
Error: insufficient balance

# Hook calculated donation as 1% of 1e18 = 1e16
# But USDC only has 6 decimals, so we needed 1e6!
```

**How We Fixed It:**
```solidity
// script/testing/02b_PatchUSDC6_Token0.s.sol
// Deploy FakeUSDC with 6 decimals at token0 address
FakeUSDC fake = new FakeUSDC();  // decimals() = 6
vm.etch(token0Addr, address(fake).code);
FakeUSDC(token0Addr).mint(deployer, 10_000_000 * 1e6);

// script/03_Swap.s.sol
swapRouter.swapExactTokensForTokens({
  amountIn: 1e6,  // 1 USDC (6 decimals), not 1e18!
  amountOutMin: 0,
  zeroForOne: true,
  // ...
});
```

**Result:** Correct decimal handling for both USDC (6) and WETH (18) in local v4 tests.

---

### Challenge 5: Aave Deployment Errors

**Error 1: `Ownable: new owner is the zero address`**
```bash
# Deployment failed because:
admin.transferOwnership(address(0))  # Disallowed by OpenZeppelin
```

**Fix:** Changed to `admin.renounceOwnership()` instead.

**Error 2: `call to non-contract address`**
```bash
# Wrong PoolAddressesProvider address (mainnet address on Sepolia)
```

**Fix:** Used correct Sepolia address: `0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A`

---

## Key Learnings

1. **Sepolia gas limits are REAL** - Always check caps, use `via_ir=false` + `optimizer_runs=1` for large contracts
2. **WETH > USDC on testnets** - Avoids supply cap issues, 18 decimals are standard
3. **Permit2 spender matters** - The contract calling `transferFrom()` must be the approved spender
4. **Dynamic asset detection** - Read `asset()` and `decimals()` from contracts, never hardcode
5. **One splitter per strategy** - Avoid "vault already set" by deploying fresh splitters

# Local Testing of Uniswap V4 hook

Start a local Anvil node (port 8545) and keep it running in a separate terminal:

```bash
anvil --port 8545
```

Deploy v4 core (prints addresses):
forge script script/testing/00_DeployV4.s.sol:DeployLocalV4 --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

Export the printed addresses:
export PERMIT2_ADDR=0x000000000022D473030F116dDEE9F6B43aC78BA3
export POOL_MANAGER_ADDR=0x0D9BAf34817Fccd3b3068768E5d20542B66424A5
export POSITION_MANAGER_ADDR=0x90aAE8e3C8dF1d226431D0C2C7feAaa775fAF86C
export SWAP_ROUTER_ADDR=0xB61598fa7E856D43384A8fcBBAbF2Aa6aa044FfC

Deploy the hook for this PoolManager:
forge script script/00_DeployHook.s.sol:DeployHookScript --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

export HOOK_ADDR=<printed_hook>

# Patch tokens (Anvil only)
forge script script/testing/01_PatchTokens.s.sol:PatchTokens --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

# Optional if USDC needs to be token0 with 6 decimals
forge script script/testing/02b_PatchUSDC6_Token0.s.sol:PatchUSDC6_Token0 --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

# Initialize pool if needed
forge script script/05_EnsureInitialized.s.sol:EnsureInitialized --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

# Add liquidity
forge script script/02_AddLiquidity.s.sol:AddLiquidityScript --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

# Configure hook
forge script script/04_SetHookConfig.s.sol:SetHookConfigScript --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

# Prefund the hook with token0 (USDC) so DonationExecuted events are emitted in this PoC
cast send $TOKEN0_ADDR "transfer(address,uint256)(bool)" $HOOK_ADDR 10000000 \
  --rpc-url $RPC --private-key $PRIVATE_KEY  # 10 USDC (6 decimals)

# Swap (USDC -> WETH, triggers donation)
forge script script/03_Swap.s.sol:SwapScript --rpc-url $RPC --broadcast --sender $SENDER --private-key $PRIVATE_KEY

# View in UI
cd frontend && npm install && npm run dev
# Open http://localhost:5173/hooks, enter RPC http://127.0.0.1:8545 and your HOOK_ADDR, then click "Load".

### Troubleshooting
- If swap reverts with custom error 0x7c9c6e8f (PriceLimitAlreadyExceeded), either:
  - Re-run `EnsureInitialized` to reset price to 1:1; or
  - Temporarily flip `zeroForOne` to `false` in `script/03_Swap.s.sol` for one swap to move price away from the edge, then switch back.

