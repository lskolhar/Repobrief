"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { checkUserCredits, deductCredits } from "@/app/actions/stripe";
import { BuyCreditsButton } from "./buy-credits-button";
import { useUser } from "@clerk/nextjs";

interface CheckCreditsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  requiredCredits: number;
  projectName: string;
}

export function CheckCreditsDialog({
  isOpen,
  onClose,
  onConfirm,
  requiredCredits,
  projectName,
}: CheckCreditsDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [creditCheck, setCreditCheck] = useState<{
    hasEnoughCredits: boolean;
    currentCredits: number;
    requiredCredits: number;
  } | null>(null);
  const { user } = useUser();

  // Check if user has enough credits when dialog opens
  useState(() => {
    if (isOpen) {
      checkCredits();
    }
  });

  const checkCredits = async () => {
    try {
      setIsLoading(true);
      const result = await checkUserCredits(requiredCredits, user?.id || "");
      setCreditCheck(result);
    } catch (error) {
      console.error("Error checking credits:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      
      // Deduct credits
      await deductCredits(requiredCredits, user?.id || "");
      
      // Call the onConfirm callback
      onConfirm();
    } catch (error) {
      console.error("Error deducting credits:", error);
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Credit Check</DialogTitle>
          <DialogDescription>
            Creating project "{projectName}" will use {requiredCredits} credits.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-6 text-center">Checking your credit balance...</div>
        ) : creditCheck ? (
          <div className="py-4">
            <div className="mb-4">
              <p className="mb-2">Your current balance: {creditCheck.currentCredits} credits</p>
              <p className="mb-2">Required for this project: {creditCheck.requiredCredits} credits</p>
            </div>

            {creditCheck.hasEnoughCredits ? (
              <div className="bg-green-50 p-3 rounded-md text-green-800">
                You have enough credits to create this project.
              </div>
            ) : (
              <div className="bg-amber-50 p-3 rounded-md text-amber-800">
                <p className="mb-2">You need {creditCheck.requiredCredits - creditCheck.currentCredits} more credits.</p>
                <div className="mt-2">
                  <BuyCreditsButton />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-red-500">
            Failed to check credit balance. Please try again.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {creditCheck?.hasEnoughCredits && (
            <Button 
              onClick={handleConfirm} 
              disabled={isLoading || !creditCheck.hasEnoughCredits}
            >
              {isLoading ? "Processing..." : "Confirm & Create Project"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
