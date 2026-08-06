import { NextRequest } from 'next/server';
import { requireAuth, privyServer } from '@/lib/privy/server';
import { prisma } from '@/lib/db/client';
import { toApiError } from '@/lib/utils/errors';
import { checksumAddress } from '@/lib/utils/address';

export async function PATCH(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    const { avatarUrl } = await req.json();

    if (typeof avatarUrl !== 'string') {
      return Response.json({ error: 'avatarUrl required' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { privyId: claims.userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });

    return Response.json(user);
  } catch (err) {
    return toApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const claims = await requireAuth(req);

    const privyId = claims.userId;
    const privyUser = await privyServer.getUser(privyId);
    const walletAccount = privyUser.linkedAccounts.find(
      (a: { type: string }) => a.type === 'wallet',
    ) as { type: string; address?: string } | undefined;
    const walletAddress = walletAccount?.address;

    if (!walletAddress) {
      return Response.json({ error: 'No wallet found on account' }, { status: 422 });
    }

    const checksummed = checksumAddress(walletAddress);

    // Extract Discord username from Privy linked accounts
    const discordAccount = privyUser.linkedAccounts.find(
      (a: { type: string }) => a.type === 'discord_oauth',
    ) as { type: string; username?: string } | undefined;

    const user = await prisma.user.upsert({
      where: { privyId },
      create: {
        privyId,
        walletAddress: checksummed,
        discordUsername: discordAccount?.username,
      },
      update: {
        walletAddress: checksummed,
        discordUsername: discordAccount?.username || null,
      },
      select: {
        id: true,
        privyId: true,
        walletAddress: true,
        email: true,
        username: true,
        avatarUrl: true,
        discordUsername: true,
        creator: { select: { id: true, handle: true, displayName: true, bio: true, bannerUrl: true, isVerified: true } },
      },
    });

    return Response.json(user);
  } catch (err) {
    return toApiError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const claims = await requireAuth(req);

    const privyId = claims.userId;
    const privyUser = await privyServer.getUser(privyId);
    const walletAccount = privyUser.linkedAccounts.find(
      (a: { type: string }) => a.type === 'wallet',
    ) as { type: string; address?: string } | undefined;
    const walletAddress = walletAccount?.address;

    if (!walletAddress) {
      return Response.json({ error: 'No wallet found on account' }, { status: 422 });
    }

    const checksummed = checksumAddress(walletAddress);

    // Extract Discord username from Privy linked accounts
    const discordAccount = privyUser.linkedAccounts.find(
      (a: { type: string }) => a.type === 'discord_oauth',
    ) as { type: string; username?: string } | undefined;

    const user = await prisma.user.upsert({
      where: { privyId },
      create: {
        privyId,
        walletAddress: checksummed,
        discordUsername: discordAccount?.username,
      },
      update: {
        walletAddress: checksummed,
        discordUsername: discordAccount?.username || null,
      },
      select: {
        id: true,
        privyId: true,
        walletAddress: true,
        email: true,
        username: true,
        avatarUrl: true,
        discordUsername: true,
        creator: { select: { id: true, handle: true, displayName: true, bio: true, bannerUrl: true, isVerified: true } },
      },
    });

    return Response.json(user);
  } catch (err) {
    return toApiError(err);
  }
}
