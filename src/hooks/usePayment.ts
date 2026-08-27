'use client';

import { useState, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address } from 'viem';
import { usePrivy } from '@privy-io/react-auth';
import {
  ERC20_ABI,
  PAYMENT_ROUTER_ABI,
  USDC_ADDRESS,
  PAYMENT_ROUTER_ADDRESS,
} from '@/lib/wagmi/contracts';
import { arcTestnet } from '@/lib/wagmi/config';
import { useArcChain } from '@/hooks/useArcChain';
import type { PaymentIntent } from '@/types/payment';

type PaymentStep = 'idle' | 'switching_chain' | 'fetching_intent' | 'approving' | 'paying' | 'confirming' | 'done' | 'error';

export function usePayment() {
  const { getAccessToken } = usePrivy();
  const { writeContractAsync } = useWriteContract();
  const { ensureArcChain } = useArcChain();
  const [step, setStep] = useState<PaymentStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash ?? undefined });

  const pay = useCallback(
    async (params: {
      creatorId: string;
      tierId?: string;
      contentId?: string;
      productId?: string;
      communityId?: string;
      type: PaymentIntent['type'];
    }) => {
      setError(null);
      setStep('switching_chain');

      try {
        // 0. Ensure the wallet is actually on Arc BEFORE doing anything else.
        //    wagmi/viem do not auto-switch: passing `chainId` to writeContract
        //    only asserts against the wallet's live chain and throws
        //    ChainMismatchError on a mismatch. Switching (and adding the network
        //    if the wallet doesn't know it) up front also avoids creating a
        //    server-side payment intent we couldn't fulfil.
        const onArc = await ensureArcChain();
        if (!onArc) {
          throw new Error('Please switch your wallet to Arc Testnet to complete this payment.');
        }

        setStep('fetching_intent');
        const token = await getAccessToken();

        // 1. Get payment intent from server
        const intentRes = await fetch('/api/payments/intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(params),
        });

        if (!intentRes.ok) {
          const { error: msg } = await intentRes.json();
          throw new Error(msg ?? 'Failed to create payment intent');
        }

        const intent: PaymentIntent = await intentRes.json();
        const amount = BigInt(intent.grossAmountUsdc);

        // 2. Approve USDC spend
        setStep('approving');
        await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [PAYMENT_ROUTER_ADDRESS, amount],
          chainId: arcTestnet.id,
        });

        // 3. Call PaymentRouter.pay
        setStep('paying');
        const typeIndex = ['SUBSCRIPTION_INITIAL', 'SUBSCRIPTION_RENEWAL', 'CONTENT_PURCHASE', 'PRODUCT_PURCHASE', 'COMMUNITY_JOIN'].indexOf(intent.type);
        // COMMUNITY_JOIN maps to PRODUCT_PURCHASE (3) on-chain
        const onChainTypeIndex = intent.type === 'COMMUNITY_JOIN' ? 3 : typeIndex;
        const hash = await writeContractAsync({
          address: PAYMENT_ROUTER_ADDRESS,
          abi: PAYMENT_ROUTER_ABI,
          functionName: 'pay',
          args: [
            intent.paymentId as `0x${string}`,
            intent.creatorWallet as Address,
            amount,
            onChainTypeIndex,
          ],
          chainId: arcTestnet.id,
        });

        setTxHash(hash);
        setStep('confirming');

        // 4. Notify server
        await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ paymentId: intent.paymentId, dbPaymentId: intent.dbPaymentId, txHash: hash, contentId: params.contentId, productId: params.productId, tierId: params.tierId, communityId: params.communityId }),
        });

        setStep('done');
        return { txHash: hash, paymentId: intent.paymentId };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Payment failed';
        setError(msg);
        setStep('error');
        throw err;
      }
    },
    [getAccessToken, writeContractAsync, ensureArcChain],
  );

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
    setTxHash(null);
  }, []);

  return { pay, step, error, txHash, isConfirming, reset };
}
