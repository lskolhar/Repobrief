import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/server/db';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any, // Use the latest API version
});

// This is your Stripe webhook secret for testing your endpoint locally.
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
console.log('Webhook secret:', webhookSecret ? 'Secret is set' : 'Secret is missing');

export async function POST(req: NextRequest) {
  console.log('Webhook received');
  try {
    // Get request body as text
    const body = await req.text();
    
    // Get Stripe signature from headers
    const signature = req.headers.get('stripe-signature') as string;
    
    let event;
    
    // Verify the event with Stripe
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret!
      );
      console.log(`Event type: ${event.type}`);
    } catch (err: any) {
      console.error(`⚠️ Webhook signature verification failed: ${err.message}`);
      return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const creditAmount = parseInt(session.metadata?.creditAmount || '0', 10);
        
        console.log(`Processing completed checkout for user ${userId} with ${creditAmount} credits`);
        
        if (userId && creditAmount) {
          try {
            // Get current user credits
            const user = await db.user.findUnique({
              where: { id: userId },
              select: { credits: true }
            });
            if (!user) {
              console.error('User not found during Stripe webhook processing');
              return new NextResponse('User not found', { status: 404 });
            }
            const currentCredits = user.credits ?? 150;
            const newCredits = currentCredits + creditAmount;

            // Update user's credits and create transaction in a single transaction
            await db.$transaction([
              db.user.update({
                where: { id: userId },
                data: { credits: newCredits }
              }),
              db.stripeTransaction.create({
                data: {
                  userId,
                  credits: creditAmount,
                  // Optionally add more details for audit/history
                  // sessionId: session.id,
                  // paymentIntentId: session.payment_intent as string | undefined,
                  // Add more fields if present in your schema
                }
              })
            ]);

            console.log(`Successfully added ${creditAmount} credits to user ${userId} and recorded StripeTransaction.`);
          } catch (error) {
            console.error('Error updating user credits:', error);
            return new NextResponse('Error updating user credits', { status: 500 });
          }
        } else {
          console.error('Missing userId or creditAmount in session metadata');
          return new NextResponse('Missing metadata', { status: 400 });
        }
        break;
      }
      
      case 'payment_intent.requires_action':
        console.log('Payment requires additional action');
        break;
        
      case 'payment_intent.payment_failed':
        console.log('Payment failed - no credits will be added');
        break;
        
      case 'payment_intent.created':
        console.log('Payment intent created');
        break;
        
      case 'customer.created':
        console.log('New customer created');
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    );
  }
}
