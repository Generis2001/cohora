import { NextRequest } from 'next/server';
import { requireAuth, privyServer } from '@/lib/privy/server';
import { prisma } from '@/lib/db/client';
import { toApiError } from '@/lib/utils/errors';
import { checksumAddress } from '@/lib/utils/address';

// Core user shape existing features depend on. Deliberately excludes any
// additive columns (e.g. discordUsername) so that authentication never breaks
// if a later column has not been applied to the database yet.
const CORE_USER_SELECT = {
  id: true,
  privyId: true,
  walletAddress: true,
  email: true,
  username: true,
  avatarUrl: true,
  creator: {
    select: { id: true, handle: true, displayName: true, bio: true, bannerUrl: true, isVerified: true },
  },
} as const;

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

// POST and GET both ensure the user record exists for the authenticated Privy
// identity and return it. They share one implementation so the two paths can
// never diverge.
async function resolveUser(req: NextRequest) {
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

  // Core upsert: only the fields existing features rely on. This is the exact
  // behavior from before Discord binding was added, so existing users always
  // authenticate regardless of the state of any additive columns.
  const user = await prisma.user.upsert({
    where: { privyId },
    create: { privyId, walletAddress: checksummed },
    update: { walletAddress: checksummed },
    select: CORE_USER_SELECT,
  });

  // Best-effort Discord sync — purely additive. Any failure here (e.g. the
  // discordUsername column not yet applied) must not break authentication, so
  // it is isolated and swallowed.
  let discordUsername: string | null = null;
  try {
    const discordAccount = privyUser.linkedAccounts.find(
      (a: { type: string }) => a.type === 'discord_oauth',
    ) as { type: string; username?: string } | undefined;

    const synced = await prisma.user.update({
      where: { privyId },
      data: { discordUsername: discordAccount?.username ?? null },
      select: { discordUsername: true },
    });
    discordUsername = synced.discordUsername ?? null;
  } catch (err) {
    // Column missing or transient write failure — log and continue. Auth still
    // succeeds; Discord binding simply reflects as not-yet-linked.
    console.error('Discord username sync skipped:', err instanceof Error ? err.message : err);
  }

  return Response.json({ ...user, discordUsername });
}

export async function POST(req: NextRequest) {
  try {
    return await resolveUser(req);
  } catch (err) {
    return toApiError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    return await resolveUser(req);
  } catch (err) {
    return toApiError(err);
  }
}
