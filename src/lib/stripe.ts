import Stripe from 'stripe';
import { db } from '@/server/db';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any, // Use the latest API version
});

// Client-side interface for Stripe
export interface StripeInterface {
  createCheckoutSession: (creditAmount: number, userId: string) => Promise<{ url: string | null }>;
  checkUserCredits: (requiredCredits: number, userId: string) => Promise<{ hasEnoughCredits: boolean; currentCredits: number; requiredCredits: number; }>;
  deductCredits: (creditAmount: number, userId: string) => Promise<{ success: boolean; newBalance: number; }>;
}

/**
 * Creates a checkout session for purchasing credits
 * @param creditAmount The number of credits to purchase
 * @returns The checkout session URL
 */
export async function createCheckoutSession(creditAmount: number, userId: string) {
  try {    
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    // Check if APP_URL is set
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    console.log('Using APP_URL:', appUrl);
    
    // Create a checkout session with required Indian export compliance
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: `${creditAmount} RepoBrief Credits`,
              description: 'Credits for analyzing GitHub repositories',
            },
            unit_amount: Math.round((creditAmount / 50) * 8300), // 50 credits = ₹83, convert to paise
          },
          quantity: 1,
        },
      ],
      customer_creation: 'always',
      mode: 'payment',
      success_url: `${appUrl}/billing?success=true&credits=${creditAmount}`,
      cancel_url: `${appUrl}/billing?canceled=true`,
      metadata: {
        userId,
        creditAmount: creditAmount.toString(),
      },
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true,
      },
    });

    if (!checkoutSession.url) {
      console.error('Checkout session created but URL is missing');
      throw new Error('Checkout session URL is missing');
    }
    
    console.log('Checkout session created successfully:', checkoutSession.id);
    return { url: checkoutSession.url };
  } catch (error: any) {
    console.error('Error creating checkout session:', error?.message || error);
    if (error?.type?.includes('Stripe')) {
      console.error('Stripe error details:', error?.raw || 'No details available');
    }
    throw new Error('Failed to create checkout session');
  }
}

/**
 * Checks if a user has enough credits for a project
 * @param requiredCredits The number of credits required
 * @returns Whether the user has enough credits
 */
export async function checkUserCredits(requiredCredits: number, userId: string) {
  try {    
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    // Get the user's current credit balance
    const userRecord = await db.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    
    if (!userRecord) {
      throw new Error('User not found');
    }
    
    return {
      hasEnoughCredits: userRecord.credits >= requiredCredits,
      currentCredits: userRecord.credits,
      requiredCredits,
    };
  } catch (error) {
    console.error('Error checking user credits:', error);
    throw new Error('Failed to check user credits');
  }
}

/**
 * Deducts credits from a user's account
 * @param creditAmount The number of credits to deduct
 * @returns The updated credit balance
 */
export async function deductCredits(creditAmount: number, userId: string) {
  try {    
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    // Get the user's current credit balance
    const userRecord = await db.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    
    if (!userRecord) {
      throw new Error('User not found');
    }
    
    if (userRecord.credits < creditAmount) {
      throw new Error('Insufficient credits');
    }
    
    // Update the user's credit balance
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { 
        credits: { decrement: creditAmount },
      },
      select: { credits: true },
    });
    
    // Record credit usage in the transaction history
    // Uncomment this once the Prisma client is regenerated
    // await db.stripeTransaction.create({
    //   data: {
    //     userId,
    //     credits: -creditAmount,
    //   }
    // });
    
    return { 
      success: true, 
      newBalance: updatedUser.credits 
    };
  } catch (error) {
    console.error('Error deducting credits:', error);
    throw new Error('Failed to deduct credits');
  }
}

// Export the Stripe instance for server components
export { stripe };
