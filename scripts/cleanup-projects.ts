import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  const projectNames = ['ComplainHub', 'HomiGO'];

  for (const name of projectNames) {
    // Find all projects with this name, sorted by createdAt descending (most recent first)
    const projects = await prisma.project.findMany({
      where: { name },
      orderBy: { createdAt: 'desc' },
    });

    // Keep the most recent one, delete the rest
    if (projects.length > 1) {
      const toDelete = projects.slice(1).map((p) => p.id);
      await prisma.project.deleteMany({ where: { id: { in: toDelete } } });
      console.log(`Deleted ${toDelete.length} duplicate(s) for project '${name}'.`);
    } else {
      console.log(`No duplicates found for project '${name}'.`);
    }
  }
}

cleanup()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
