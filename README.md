# CanopySplit

A two-part project showcasing a Yield-Donating Strategy that routes strategy yield to climate recipients via a tri-split donation splitter. Deployed on Sepolia. Frontend demonstrates a polished UX with role-gated actions, skeleton loaders, recipient branding, and Etherscan-linked toasts.

## Deployed (Sepolia)

- Strategy: `0x99D8C89E43AA7Cf4628D6F496Ba749D077f78A8B`
- Splitter: `0xe1F4d6b65e37282D5E1d9e5e9bbd3b0F27683eea`
- USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- Recipients:
  - Planters: `0xF9b2eFCAcc1B93c1bd7F898d0a8c4b34aBD78E53`
  - MRV: `0x9261432cab3c0F83E86fa6e41E4a88dA06E7ecc6`
  - Maintenance: `0x89C13e8e5a81E775160322df9d7869893926A8Cc`

## Architecture

```mermaid
flowchart TD
  subgraph User Side
    U[User Wallet\n(RainbowKit)]
    FE[Frontend\nReact + Vite + Wagmi + Viem]
    U --> FE
  end

  subgraph On-chain (Sepolia)
    USDC[USDC Token\n0x1c7D...7238]
    STR[YieldDonatingStrategy\n0x99D8...8A8B]
    SPL[TriSplitDonationSplitter\n0xe1F4...eea]

    USDC --> STR
    STR -- yield/harvest --> SPL
    SPL --> P[Planters\n0xF9b2...8E53]
    SPL --> M[MRV\n0x9261...ecc6]
    SPL --> MA[Maintenance\n0x89C1...A8Cc]
  end

  FE <-- RPC (Sepolia) --> STR
  FE <-- RPC (Sepolia) --> SPL

  subgraph Roles
    MGMT[Strategy Management]
    KP[Strategy Keeper]
    OWN[Splitter Owner]
  end

  MGMT -. gated actions .-> STR
  KP -. gated actions .-> STR
  OWN -. policy editor .-> SPL
```

## Repos

- `frontend/` – React dApp with role-gated actions, skeleton loaders, recipient branding, and Etherscan-linked toasts.
- `smart-contracts/` – Foundry project containing `YieldDonatingStrategy` and `TriSplitDonationSplitter` (Ownable), deployment scripts, and configs.

## Frontend setup

1. Enter `frontend/` and install deps
   - `npm install` (or `yarn`/`pnpm i`)
2. Configure `.env`
   - `VITE_SEPOLIA_RPC_URL` – your HTTPS Sepolia RPC
   - `VITE_WALLETCONNECT_PROJECT_ID` – from cloud.walletconnect.com
3. Run the app
   - `npm run dev`

### Key features

- Role-gated buttons:
  - Management or Keeper: `report()`
  - Management only: `simulateProfit()` (demo)
  - Owner only (splitter): set next-epoch policy and roll epoch
- Polished UX: skeleton loaders, recipient logos, copy-to-clipboard, subtle press animations
- Etherscan-linked toasts for all write actions
- Auto-refreshes reads and logs after writes

## Smart contracts setup

1. Enter `smart-contracts/`
2. Install Foundry (https://book.getfoundry.sh/)
   - `foundryup` (after installing the toolchain)
3. Dependencies
   - `forge build`
4. Tests
   - `forge test -vvv`
5. Deployment
   - See `smart-contracts/README.md` for network env and script usage

## UI concepts and gating

- Splitter is `Ownable`: only owner can set policy and roll epoch
- Strategy exposes `management()` and `keeper()`; `report()` is gated to those roles
- Recipients are fixed at deploy for epoch 0 and can be updated per-epoch via policy

## Environment variables

- Frontend: see `frontend/.env`
- Smart contracts: copy from `smart-contracts/.env.example` to `.env` and fill RPC/keys

## Developer notes

- The repo uses a root `.gitignore` to ignore common artifacts (`node_modules`, `dist`, `broadcast/**/dry-run/`, `.env`, etc.)
- The `frontend/` and `smart-contracts/` directories may be managed as separate repos or merged into a single monorepo (see below).

## Monorepo vs nested repos

- If you want a single root repo that tracks both `frontend/` and `smart-contracts/` contents, remove the nested `.git` directories inside each and commit at the root.
- If you keep nested repos, commit and push each independently from their own folder.

## License

MIT
