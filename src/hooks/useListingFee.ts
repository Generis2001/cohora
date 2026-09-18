'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ERC20_ABI, USDC_ADDRESS, PLATFORM_WALLET, LISTING_FEE_UNITS } from '@/lib/wagmi/contracts';
import { arcTestnet } from '@/lib/wagmi/config';
import { useArcChain } from '@/hooks/useArcChain';
import { triggerBalanceRefresh } from '@/hooks/useUSDCBalance';

type FeeStep = 'idle' | 'waiting_wallet' | 'confirming' | 'done' | 'error';

export function useListingFee() {
  const { writeContractAsync } = useWriteContract();
  const { ensureArcChain } = useArcChain();
  const [step, setStep] = useState<FeeStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const { isLoading: isConfirming, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  useEffect(() => {
    if (step !== 'confirming' || !receipt) return;
    if (receipt.status === 'success') {
      setStep('done');
      triggerBalanceRefresh();
    } else {
      setError('Transaction reverted on-chain. Check your USDC balance and try again.');
      setStep('error');
    }
  }, [step, receipt]);

  const payFee = useCallback(async (): Promise<`0x${string}`> => {
    setStep('waiting_wallet');
    setError(null);
    try {
      const onArc = await ensureArcChain();
      if (!onArc) {
        throw new Error('Please switch your wallet to Arc to pay the listing fee.');
      }
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [PLATFORM_WALLET, LISTING_FEE_UNITS],
        chainId: arcTestnet.id,
      });
      setTxHash(hash);
      setStep('confirming');
      return hash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      setError(msg.includes('rejected') || msg.includes('denied') ? 'Transaction cancelled.' : msg);
      setStep('error');
      throw err;
    }
  }, [writeContractAsync, ensureArcChain]);

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
    setTxHash(null);
  }, []);

  return { payFee, step, error, txHash, isConfirming, isDone: step === 'done', reset };
}
