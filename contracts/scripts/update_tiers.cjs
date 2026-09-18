const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.subscriptionTier.updateMany({
    data: { priceUsdc: 250000n }
  });
  console.log('Updated tiers:', res.count);
}

main().finally(() => prisma.$disconnect());
