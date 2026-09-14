// One-off script: promote a User to ADMIN by email. This is the only way to create the
// first admin — there is deliberately no self-serve way to become one.
//
// Usage:
//   node scratch/make-admin.js someone@example.com
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scratch/make-admin.js <email>');
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email: email.toLowerCase().trim() },
    data: { role: 'ADMIN' },
  });

  console.log(`Promoted ${user.email} (${user.id}) to ADMIN.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
