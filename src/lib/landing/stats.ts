import { createPublicClient, http, zeroAddress, type Address } from 'viem';
import { prisma } from '@/lib/db/client';
import { arcMainnet } from '@/lib/wagmi/config';
import { PAYMENT_ROUTER_ABI, PAYMENT_ROUTER_ADDRESS } from '@/lib/wagmi/contracts';
import { formatUsdc } from '@/lib/payments/usdc';

let deploymentAddress: Address = zeroAddress;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mainnetDeployment = require('../../../contracts/deployments/arc-mainnet.json');
  if (mainnetDeployment?.paymentRouter) {
    deploymentAddress = mainnetDeployment.paymentRouter as Address;
  }
} catch {
  // Fallback if deployment file is absent
}

const paymentRouterAddress =
  PAYMENT_ROUTER_ADDRESS.length === 42 && PAYMENT_ROUTER_ADDRESS !== zeroAddress
    ? PAYMENT_ROUTER_ADDRESS
    : deploymentAddress;

export interface LandingStats {
  creatorHeartbeat: string;
  creatorCount: number | null;
  routerFeeLabel: string;
}

async function readRouterFeeLabel(): Promise<string> {
  if (!paymentRouterAddress || paymentRouterAddress === zeroAddress) {
    return 'Unavailable';
  }

  try {
    const publicClient = createPublicClient({
      chain: arcMainnet,
      transport: http(arcMainnet.rpcUrls.default.http[0]),
    });

    const feeBps = await publicClient.readContract({
      address: paymentRouterAddress,
      abi: PAYMENT_ROUTER_ABI,
      functionName: 'platformFeeBps',
    });

    const whole = Number(feeBps) / 100;
    return `${whole}%`;
  } catch {
    return 'Unavailable';
  }
}

export async function getLandingStats(): Promise<LandingStats> {
  const [databaseStats, routerFeeLabel] = await Promise.all([
    (async () => {
      try {
        const [creatorAggregate, creatorCount] = await Promise.all([
          prisma.creator.aggregate({
            where: { isActive: true },
            _sum: { totalEarned: true },
          }),
          prisma.creator.count({ where: { isActive: true } }),
        ]);

        return {
          settledEarnings: creatorAggregate._sum.totalEarned ?? 0n,
          creatorCount,
        };
      } catch {
        return null;
      }
    })(),
    readRouterFeeLabel(),
  ]);

  return {
    creatorHeartbeat: databaseStats ? formatUsdc(databaseStats.settledEarnings) : 'Unavailable',
    creatorCount: databaseStats?.creatorCount ?? null,
    routerFeeLabel,
  };
}
