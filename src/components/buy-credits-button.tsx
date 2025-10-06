"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCheckoutSession } from "@/app/actions/stripe";
import { useUser } from "@clerk/nextjs";

export function BuyCreditsButton() {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [creditAmount, setCreditAmount] = useState(100);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Prevent hydration errors by only rendering after component is mounted
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Don't render anything until client-side hydration is complete
  if (!isMounted) {
    return null;
  }

  const handlePurchase = async () => {
    try {
      if (!user?.id) {
        alert("You need to be logged in to purchase credits.");
        return;
      }
      
      setIsLoading(true);
      
      // Create a checkout session
      const { url } = await createCheckoutSession(creditAmount, user.id);
      
      // Redirect to the checkout page
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      alert("Failed to create checkout session. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Buy Credits</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Purchase Credits</DialogTitle>
          <DialogDescription>
            Each credit allows you to analyze one file in a repository.
            Every 50 credits costs ₹75.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="credits" className="text-right">
              Credits
            </Label>
            <Input
              id="credits"
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(Number(e.target.value))}
              min={50}
              step={50}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Cost</Label>
            <div className="col-span-3">
              ₹{((creditAmount / 50) * 75).toFixed(2)} INR
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button 
            onClick={handlePurchase} 
            disabled={isLoading || creditAmount < 50}
          >
            {isLoading ? "Processing..." : "Purchase Credits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
