'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePayment } from '@/hooks/usePayment';
import { formatUsdc } from '@/lib/payments/usdc';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { PaymentIntent } from '@/types/payment';

interface PayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (txHash: `0x${string}`) => void;
  title: string;
  description?: string;
  grossAmountUsdc: bigint;
  payParams: {
    creatorId: string;
    tierId?: string;
    contentId?: string;
    productId?: string;
    communityId?: string;
    type: PaymentIntent['type'];
  };
}

const STEP_LABELS: Record<string, string> = {
  idle: 'Review & confirm',
  switching_chain: 'Switch to Arc in wallet...',
  fetching_intent: 'Preparing payment...',
  approving: 'Approve USDC spend in wallet...',
  paying: 'Confirm payment in wallet...',
  confirming: 'Waiting for confirmation...',
  done: 'Payment complete',
  error: 'Payment failed',
};

export function PayModal({
  open,
  onOpenChange,
  onSuccess,
  title,
  description,
  grossAmountUsdc,
  payParams,
}: PayModalProps) {
  const { pay, step, error, txHash, reset } = usePayment();

  const isLoading = ['switching_chain', 'fetching_intent', 'approving', 'paying', 'confirming'].includes(step);

  async function handleConfirm() {
    const result = await pay(payParams);
    onSuccess?.(result.txHash);
  }

  function handleClose(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {step === 'done' ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="font-medium">Payment confirmed</p>
            {txHash && (
              <p className="text-xs text-muted-foreground font-mono break-all">{txHash}</p>
            )}
            <Button className="w-full" onClick={() => handleClose(false)}>
              Done
            </Button>
          </div>
        ) : step === 'error' ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <XCircle className="h-12 w-12 text-destructive" />
            <p className="font-medium">Payment failed</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" className="w-full" onClick={reset}>
              Try Again
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-muted/50 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatUsdc(grossAmountUsdc)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Network</span>
                <span>Arc</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Token</span>
                <span>USDC</span>
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>{STEP_LABELS[step]}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button variant="cohora" onClick={handleConfirm} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {STEP_LABELS[step]}
                  </>
                ) : (
                  `Pay ${formatUsdc(grossAmountUsdc)}`
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
