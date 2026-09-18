'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { useWallets } from '@privy-io/react-auth';
import { useCallback, useState } from 'react';
import { arcTestnet, arcTestnetAddParams } from '@/lib/wagmi/chains';

type SwitchState = 'idle' | 'switching' | 'error';

const arcTestnetAddParamsMetaMask = {
  ...arcTestnetAddParams,
  nativeCurrency: { ...arcTestnetAddParams.nativeCurrency, decimals: 18 },
};

function isMetaMask(provider: { isMetaMask?: boolean }): boolean {
  return !!provider?.isMetaMask;
}

export function useArcChain() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { wallets } = useWallets();
  const [state, setState] = useState<SwitchState>('idle');
  const [error, setError] = useState<string | null>(null);

  const isArcChain = chainId === arcTestnet.id;

  const switchOrAdd = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: arcTestnet.id });
    } catch (switchError: unknown) {
      const code = (switchError as { code?: number })?.code;
      if (code !== 4902) throw switchError;
      const wallet = wallets[0];
      if (!wallet) throw new Error('No wallet connected');
      const provider = await wallet.getEthereumProvider();
      const addParams = isMetaMask(provider as { isMetaMask?: boolean })
        ? arcTestnetAddParamsMetaMask
        : arcTestnetAddParams;
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [addParams],
      });
      await switchChainAsync({ chainId: arcTestnet.id });
    }
  }, [switchChainAsync, wallets]);

  const reportError = useCallback((err: unknown) => {
    const code = (err as { code?: number })?.code;
    if (code === 4001) {
      setError('Switch rejected. You must be on Arc to continue.');
    } else {
      setError(err instanceof Error ? err.message : 'Failed to switch network');
    }
    setState('error');
  }, []);

  const switchToArc = useCallback(async () => {
    setState('switching');
    setError(null);
    try {
      await switchOrAdd();
      setState('idle');
    } catch (err: unknown) {
      reportError(err);
    }
  }, [switchOrAdd, reportError]);

  const ensureArcChain = useCallback(async (): Promise<boolean> => {
    if (isArcChain) return true;
    setState('switching');
    setError(null);
    try {
      await switchOrAdd();
      setState('idle');
      return true;
    } catch (err: unknown) {
      reportError(err);
      return false;
    }
  }, [isArcChain, switchOrAdd, reportError]);

  return { isArcChain, switchToArc, ensureArcChain, state, error };
}
