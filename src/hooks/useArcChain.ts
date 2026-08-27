'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { useWallets } from '@privy-io/react-auth';
import { useCallback, useState } from 'react';
import { arcTestnet, arcTestnetAddParams } from '@/lib/wagmi/chains';

type SwitchState = 'idle' | 'switching' | 'error';

// MetaMask rejects wallet_addEthereumChain when nativeCurrency.decimals !== 18.
// Arc Testnet uses USDC (6 decimals) as native, so we send decimals=18 to satisfy
// MetaMask's validation — the value is cosmetic in MetaMask's UI only.
const arcTestnetAddParamsMetaMask = {
  ...arcTestnetAddParams,
  nativeCurrency: { ...arcTestnetAddParams.nativeCurrency, decimals: 18 },
};

function isMetaMask(provider: { isMetaMask?: boolean }): boolean {
  return !!provider?.isMetaMask;
}

export function useArcChain() {
  // Use the *connected wallet's* chain (useAccount), NOT useChainId().
  //
  // wagmiConfig declares a single chain (Arc, 5042002). wagmi only syncs
  // config.state.chainId — what useChainId() returns — to chains that are in
  // the config; it explicitly ignores unconfigured chains (see @wagmi/core
  // createConfig "Update default chain when connector chain changes"). So when
  // the wallet is on any other network (e.g. 1979), useChainId() stays pinned
  // at 5042002 and would make us believe we're already on Arc. useAccount()
  // reads the live connection chainId and correctly reports the real chain.
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { wallets } = useWallets();
  const [state, setState] = useState<SwitchState>('idle');
  const [error, setError] = useState<string | null>(null);

  const isArcChain = chainId === arcTestnet.id;

  // Core switch with add-network fallback. Resolves once the wallet is on Arc,
  // throws otherwise (so callers can distinguish success from failure).
  const switchOrAdd = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: arcTestnet.id });
    } catch (switchError: unknown) {
      const code = (switchError as { code?: number })?.code;
      if (code !== 4902) throw switchError;
      // 4902: chain unknown to the wallet — add it, then switch.
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
      setError('Switch rejected. You must be on Arc Testnet to continue.');
    } else {
      setError(err instanceof Error ? err.message : 'Failed to switch network');
    }
    setState('error');
  }, []);

  // Fire-and-forget switch used by the ChainGuard UI (button + effect).
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

  // Imperative guard for critical flows (payments). Resolves `true` only when
  // the wallet is confirmed on Arc, so the caller can safely send a transaction
  // without hitting viem's ChainMismatchError.
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
