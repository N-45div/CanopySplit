import { http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

export const wagmiConfig = getDefaultConfig({
  appName: 'TriSplit YDS',
  projectId: (import.meta as any).env.VITE_WALLETCONNECT_PROJECT_ID || 'tri-split-yds',
  chains: [sepolia],
  transports: {
    [sepolia.id]: http((import.meta as any).env.VITE_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org'),
  },
  ssr: false,
}) as any
