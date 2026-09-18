'use client';

import { useState, useCallback } from 'react';
import { useWriteContract, usePublicClient } from 'wagmi';
import { ERC20_ABI, USDC_ADDRESS, PLATFORM_WALLET, LISTING_FEE_UNITS } from '@/lib/wagmi/contracts';
import { arcTestnet } from '@/lib/wagmi/config';
import { useArcChain } from '@/hooks/useArcChain';
import { triggerBalanceRefresh } from '@/hooks/useUSDCBalance';

type FeeStep = 'idle' | 'switching_chain' | 'approving' | 'paying' | 'confirming' | 'done' | 'error';

export function useListingFee() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { ensureArcChain } = useArcChain();
  const [step, setStep] = useState<FeeStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const payFee = useCallback(async (): Promise<`0x${string}`> => {
    setStep('switching_chain');
    setError(null);
    try {
      const onArc = await ensureArcChain();
      if (!onArc) {
        throw new Error('Please switch your wallet to Arc to pay the listing fee.');
      }

      // Step 1: Approve 0.10 USDC spend in connected wallet
      setStep('approving');
      const approveHash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [PLATFORM_WALLET, LISTING_FEE_UNITS],
        chainId: arcTestnet.id,
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // Step 2: Transfer (subtract) 0.10 USDC from connected wallet
      setStep('paying');
      const transferHash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [PLATFORM_WALLET, LISTING_FEE_UNITS],
        chainId: arcTestnet.id,
      });
      setTxHash(transferHash);

      // Step 3: Wait for transaction receipt confirmation of 0.10 USDC subtraction
      setStep('confirming');
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: transferHash });
        if (receipt.status !== 'success') {
          throw new Error('0.10 USDC listing fee transfer reverted on-chain.');
        }
      }

      setStep('done');
      triggerBalanceRefresh();
      return transferHash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      setError(msg.includes('rejected') || msg.includes('denied') ? 'Transaction cancelled.' : msg);
      setStep('error');
      throw err;
    }
  }, [writeContractAsync, publicClient, ensureArcChain]);

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
    setTxHash(null);
  }, []);

  return { payFee, step, error, txHash, isConfirming: step === 'confirming', isDone: step === 'done', reset };
}
