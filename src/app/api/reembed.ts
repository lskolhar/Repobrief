import type { NextApiRequest, NextApiResponse } from 'next';
import { indexGitHubRepo } from '@/lib/embeddingPipeline';
import { prisma } from '@/lib/prisma';
// @ts-ignore - Ignoring next-auth module not found error
import { getServerSession } from 'next-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { projectId } = req.body;
  if (!projectId) {
    return res.status(400).json({ error: 'Missing projectId' });
  }

  // Authenticate user
  const session = await getServerSession(req, res);
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get project and repoUrl
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  const repoUrl = project.githuburl;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!repoUrl) {
    return res.status(400).json({ error: 'Project repository URL is missing.' });
  }

  try {
    await indexGitHubRepo(projectId, String(repoUrl), githubToken);
    return res.status(200).json({ status: 'success' });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
