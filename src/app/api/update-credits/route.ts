import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';

export async function POST(req: NextRequest) {
  try {
    const { userId, credits } = await req.json();

    if (!userId || credits === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get current user credits
    const currentUser = await db.user.findUnique({
      where: { id: userId },
    });

    const currentCredits = currentUser?.credits || 150;
    
    // Validate the new credit amount
    if (credits < currentCredits) {
      return NextResponse.json(
        { error: 'New credit amount cannot be less than current credits' },
        { status: 400 }
      );
    }
    
    // Calculate purchased credits for transaction record
    const purchasedCredits = credits - currentCredits;

    // Update user credits in database
    await db.user.update({
      where: { id: userId },
      data: { credits },
    });

    // Create transaction record
    await db.stripeTransaction.create({
      data: {
        userId,
        credits: purchasedCredits,
        user: {
          connect: { id: userId }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating credits:', error);
    return NextResponse.json(
      { error: 'Failed to update credits' },
      { status: 500 }
    );
  }
}
