'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReadContract } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { type Address } from 'viem';
import { ERC20_ABI, USDC_ADDRESS } from '@/lib/wagmi/contracts';
import { formatUsdc } from '@/lib/payments/usdc';

export const BALANCE_UPDATE_EVENT = 'usdc-balance-update';

export function triggerBalanceRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(BALANCE_UPDATE_EVENT));
    setTimeout(() => window.dispatchEvent(new Event(BALANCE_UPDATE_EVENT)), 2000);
    setTimeout(() => window.dispatchEvent(new Event(BALANCE_UPDATE_EVENT)), 5000);
  }
}

export function useUSDCBalance() {
  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address as Address | undefined;
  const [manualRefetching, setManualRefetching] = useState(false);

  const { data, isLoading, refetch } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: {
      enabled: Boolean(walletAddress),
      refetchInterval: 5_000,
    },
  });

  const handleRefetch = useCallback(async () => {
    setManualRefetching(true);
    try {
      await refetch();
    } finally {
      setManualRefetching(false);
    }
  }, [refetch]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onBalanceUpdate = () => {
      refetch();
    };
    window.addEventListener(BALANCE_UPDATE_EVENT, onBalanceUpdate);
    return () => {
      window.removeEventListener(BALANCE_UPDATE_EVENT, onBalanceUpdate);
    };
  }, [refetch]);

  const raw = data ?? 0n;

  return {
    raw,
    formatted: formatUsdc(raw),
    isLoading,
    isRefetching: manualRefetching,
    refetch: handleRefetch,
  };
}
