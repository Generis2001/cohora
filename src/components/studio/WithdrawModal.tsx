'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { isValidAddress } from '@/lib/utils/address';
import { triggerBalanceRefresh } from '@/hooks/useUSDCBalance';

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxAmount: string;
  defaultAddress: string;
}

type Step = 'form' | 'confirming' | 'done' | 'error';

export function WithdrawModal({ open, onOpenChange, maxAmount, defaultAddress }: WithdrawModalProps) {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [toAddress, setToAddress] = useState(defaultAddress);
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!amount || !toAddress) return;
    if (!isValidAddress(toAddress)) {
      setError('Invalid wallet address');
      return;
    }

    const amountNum = parseFloat(amount);
    const maxNum = parseFloat(maxAmount);
    if (isNaN(amountNum) || amountNum <= 0 || amountNum > maxNum) {
      setError(`Amount must be between 0 and ${maxAmount}`);
      return;
    }

    setStep('confirming');
    setError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch('/api/payouts/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, toAddress }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? 'Withdrawal failed');
      }

      setStep('done');
      triggerBalanceRefresh();
      queryClient.invalidateQueries({ queryKey: ['creator-balance'] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed');
      setStep('error');
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      setStep('form');
      setError(null);
      setAmount('');
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Withdraw USDC</DialogTitle>
        </DialogHeader>

        {step === 'done' ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="font-medium">Withdrawal complete!</p>
            <p className="text-sm text-muted-foreground">
              USDC has been sent to your wallet.
            </p>
            <Button className="w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount (USDC)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  max={maxAmount}
                  step="0.01"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(maxAmount)}
                  className="shrink-0"
                >
                  Max
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Available: {maxAmount} USDC</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Destination address</label>
              <Input
                placeholder="0x..."
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive rounded-md bg-destructive/[0.10] px-3 py-2">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                variant="cohora"
                onClick={handleSubmit}
                disabled={step === 'confirming' || !amount || !toAddress}
              >
                {step === 'confirming' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Withdraw'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
