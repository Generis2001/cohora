// One-time backfill: approve legacy content that predates media moderation.
//
// Content created before the moderation system existed defaults to
// moderationStatus = PENDING (schema default) with a null nsfwScore. Every
// display/access query now filters for moderationStatus = APPROVED, so that
// legacy content silently disappeared from creator pages, explore, and
// purchase flows.
//
// New uploads are created as APPROVED after passing the client-side NSFW
// scan, and content that fails moderation is set to FLAGGED. So any remaining
// PENDING row is legacy pre-moderation content and is safe to approve. FLAGGED
// content is left untouched.
//
// Usage: node scripts/backfill-moderation-status.mjs
// Reads DATABASE_URL from the environment or from .env.

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
      if (match) {
        process.env.DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, '');
        break;
      }
    }
  } catch {
    // no .env file — rely on the ambient environment
  }
}

const prisma = new PrismaClient();

try {
  const before = await prisma.content.groupBy({
    by: ['moderationStatus'],
    _count: { _all: true },
  });
  console.log('Before:', JSON.stringify(before));

  const { count } = await prisma.content.updateMany({
    where: { moderationStatus: 'PENDING' },
    data: { moderationStatus: 'APPROVED' },
  });
  console.log(`Approved ${count} legacy PENDING content item(s).`);

  const after = await prisma.content.groupBy({
    by: ['moderationStatus'],
    _count: { _all: true },
  });
  console.log('After:', JSON.stringify(after));
} finally {
  await prisma.$disconnect();
}
