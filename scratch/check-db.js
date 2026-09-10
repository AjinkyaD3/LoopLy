const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const programs = await prisma.loyaltyProgram.findMany({
    include: { scratchCardPrizes: true }
  });
  console.log(JSON.stringify(programs, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
