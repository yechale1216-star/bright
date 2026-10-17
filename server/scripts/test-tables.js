const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
  console.log('All tables:', tables.map(t => t.table_name).sort());
}

main().catch(console.error).finally(() => prisma.$disconnect());
