import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/server/db';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const user = await db.user.findUnique({ where: { id: userId }, select: { credits: true } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ credits: user.credits });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
  }
}
