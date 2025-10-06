
"use server";

import { createCheckoutSession as createStripeCheckout, checkUserCredits as checkCredits, deductCredits as deduct } from '@/lib/stripe';

// Wrapper functions with better error handling
export async function createCheckoutSession(creditAmount: number, userId: string) {
  try {
    console.log(`Creating checkout session for user ${userId} for ${creditAmount} credits`);
    const result = await createStripeCheckout(creditAmount, userId);
    return result;
  } catch (error) {
    console.error('Server action error creating checkout session:', error);
    throw new Error('Failed to create checkout session');
  }
}

export async function checkUserCredits(requiredCredits: number, userId: string) {
  try {
    return await checkCredits(requiredCredits, userId);
  } catch (error) {
    console.error('Server action error checking user credits:', error);
    throw new Error('Failed to check user credits');
  }
}

export async function deductCredits(creditAmount: number, userId: string) {
  try {
    return await deduct(creditAmount, userId);
  } catch (error) {
    console.error('Server action error deducting credits:', error);
    throw new Error('Failed to deduct credits');
  }
}
