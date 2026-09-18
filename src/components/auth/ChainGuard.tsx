'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useArcChain } from '@/hooks/useArcChain';
import { Button } from '@/components/ui/button';

interface ChainGuardProps {
  children: React.ReactNode;
}

export function ChainGuard({ children }: ChainGuardProps) {
  const { status } = useAccount();
  const { isArcChain, switchToArc, state, error } = useArcChain();

  useEffect(() => {
    if (status === 'connected' && !isArcChain && state === 'idle') {
      switchToArc();
    }
  }, [status, isArcChain, state, switchToArc]);

  if (status === 'reconnecting' || status === 'connecting') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/[0.68]" />
      </div>
    );
  }

  if (isArcChain) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="cohora-panel max-w-sm space-y-5 p-8 text-center">
        <div className="flex justify-center">
          <div className="rounded-full border border-amber-300/[0.15] bg-amber-400/[0.10] p-4">
            <AlertTriangle className="h-8 w-8 text-amber-300" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Wrong network</h2>
          <p className="text-sm text-white/[0.58]">
            Cohora runs on Arc. Switch your wallet to continue.
          </p>
        </div>

        {error && (
          <p className="rounded-2xl bg-destructive/[0.12] px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button variant="cohora" size="lg" className="w-full" onClick={switchToArc} disabled={state === 'switching'}>
          {state === 'switching' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Arc...
            </>
          ) : state === 'error' ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </>
          ) : (
            'Switch to Arc'
          )}
        </Button>
      </div>
    </div>
  );
}
