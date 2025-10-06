import { prisma } from "../prisma";

async function main() {
  const projectId = "homigo";
  const count = await prisma.sourceCodeEmbedding.deleteMany({
    where: { projectId },
  });
  console.log(`Deleted ${count.count} embeddings for projectId=${projectId}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
