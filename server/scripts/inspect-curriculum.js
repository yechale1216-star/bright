const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [grades, streams, subjects] = await Promise.all([
    prisma.grade.findMany({ orderBy: { name: 'asc' } }),
    prisma.stream.findMany({ orderBy: { name: 'asc' } }),
    prisma.subject.findMany({ orderBy: { name: 'asc' } }),
  ]);
  console.log('Grades:', grades);
  console.log('Streams:', streams);
  console.log('Subjects:', subjects.map(s => ({ id: s.id, name: s.name, code: s.code })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
