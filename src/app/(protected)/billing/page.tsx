"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { createCheckoutSession } from '@/app/actions/stripe';
import { CreditBalance } from '@/components/credit-balance';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function BillingPage() {
  const { user } = useUser();
  const [creditsToBuy, setCreditsToBuy] = useState<number[]>([190]);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Prevent hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle success/failure query parameters
  useEffect(() => {
    const updateCredits = async () => {
      if (!isMounted || !user?.id) return;
      
      const searchParams = new URLSearchParams(window.location.search);
      const success = searchParams.get('success');
      const purchasedCredits = searchParams.get('credits');
      
      if (success === 'true' && purchasedCredits) {
        try {
          const creditAmount = parseInt(purchasedCredits, 10);
          const currentCredits = (user.publicMetadata?.credits as number) || 150;
          const newCredits = currentCredits + creditAmount;
          
          // Update credits in the database
          const response = await fetch('/api/update-credits', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              credits: newCredits,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update credits');
          }

          toast.success(`Successfully purchased ${creditAmount} credits!`);
          
          // Reload the page after a short delay to show updated credits
          setTimeout(() => {
            window.location.href = '/billing';
          }, 1500);
        } catch (error) {
          console.error('Error updating credits:', error);
          toast.error('Failed to update credits. Please try again.');
        }
        
        // Remove query params from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      if (searchParams.get('canceled') === 'true') {
        toast.error('Payment was canceled.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    updateCredits();
  }, [isMounted, user]);
  
  // Only calculate values client-side to avoid hydration mismatch
  const creditAmount = isMounted ? (creditsToBuy[0] || 190) : 190;
  // Convert to Indian Rupees (₹) - 1 USD = ~83 INR
  const price = isMounted ? ((creditAmount / 50) * 83).toFixed(2) : "0.00"; // ₹83 for 50 credits
  
  // Show a simple loading state during server-side rendering
  if (!isMounted) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Purchase Credits</h1>
        <div className="h-96 flex items-center justify-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const handleBuyCredits = async () => {
    try {
      if (!user?.id) return;
      setIsLoading(true);
      
      const { url } = await createCheckoutSession(creditAmount, user.id);
      
      if (!url) {
        throw new Error('No checkout URL returned');
      }
      
      window.location.href = url;
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      toast.error(error.message || 'Failed to create checkout session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Purchase Credits</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          {/* Credit Balance Component */}
          <div className="mb-6">
            <CreditBalance initialCredits={user?.publicMetadata?.credits as number || 150} />
          </div>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Credit Purchase</CardTitle>
              <CardDescription>Select the number of credits you want to purchase</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">50 credits</span>
                  <span className="text-sm font-medium">1000 credits</span>
                </div>
                
                {/* Slider for selecting credit amount */}
                <Slider
                  defaultValue={[190]}
                  max={1000}
                  min={50}
                  step={10}
                  onValueChange={setCreditsToBuy}
                  value={creditsToBuy}
                  className="py-4"
                />
                
                <div className="flex justify-between items-center mt-4">
                  <div>
                    <p className="text-2xl font-bold">{creditAmount} Credits</p>
                    <p className="text-sm text-gray-500">50 credits = ₹83.00</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-right">₹{price}</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleBuyCredits}
                className="w-full h-12 text-lg font-medium"
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : `Purchase Credits`}
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div>
          <Card>
            <CardHeader>
              <CardTitle>How Credits Work</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="mr-3 mt-1 text-blue-500 flex-shrink-0">
                    <span className="text-xl">ℹ️</span>
                  </div>
                  <div>
                    <p className="font-medium">Each credit allows you to index 1 file in a repository.</p>
                    <p className="text-sm text-gray-600 mt-1">If your project has 100 files, you will need 100 credits to index it.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="mr-3 mt-1 text-green-500 flex-shrink-0">
                    <span className="text-xl">💰</span>
                  </div>
                  <div>
                    <p className="font-medium">Credits are used only once per project.</p>
                    <p className="text-sm text-gray-600 mt-1">After indexing, you can ask unlimited questions about your code.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="mr-3 mt-1 text-purple-500 flex-shrink-0">
                    <span className="text-xl">🔄</span>
                  </div>
                  <div>
                    <p className="font-medium">Credits never expire.</p>
                    <p className="text-sm text-gray-600 mt-1">Use them whenever you need to analyze a new project.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
