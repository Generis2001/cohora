import { type PrivyClientConfig } from '@privy-io/react-auth';
import { arcTestnet } from '@/lib/wagmi/config';

export const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: 'dark',
    accentColor: '#F5F5F5',
    logo: '/assets/cohora-logo.svg',
  },
  embeddedWallets: {
    createOnLogin: 'users-without-wallets',
  },
  loginMethods: ['email', 'wallet', 'discord'],
  defaultChain: arcTestnet,
  supportedChains: [arcTestnet],
};
