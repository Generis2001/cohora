import { http } from 'wagmi'
import { createConfig } from '@privy-io/wagmi'
import { defineChain } from 'viem'

export const arcMainnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042),
  name: 'Arc',
  nativeCurrency: {
    decimals: 18,
    name: 'Arc',
    symbol: 'ARC',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.mainnet.arc.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: 'https://explorer.arc.io',
    },
  },
  testnet: false,
})

// Export arcTestnet alias pointing to arcMainnet for backwards-compatibility across the app
export const arcTestnet = arcMainnet

export const wagmiConfig = createConfig({
  chains: [arcMainnet],
  transports: {
    [arcMainnet.id]: http(
      process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.mainnet.arc.io'
    ),
  },
})
