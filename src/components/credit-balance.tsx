"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BuyCreditsButton } from "@/components/buy-credits-button";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

interface CreditBalanceProps {
  initialCredits: number;
}

export function CreditBalance({ initialCredits }: CreditBalanceProps) {
  const [credits, setCredits] = useState(initialCredits);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Fetch the latest credits from the backend
  const fetchCredits = async () => {
    try {
      const response = await fetch('/api/get-credits', {
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (typeof data.credits === 'number') {
          setCredits(data.credits);
        }
      }
    } catch (error) {
      // fallback: don't update credits
    }
  };

  // Prevent hydration errors by only rendering after component is mounted
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Always fetch fresh credits after mount
    if (isMounted) fetchCredits();
  }, [isMounted]);

  useEffect(() => {
    // Check for successful payment
    const success = searchParams.get("success");
    const purchasedCredits = searchParams.get("credits");

    if (success === "true" && purchasedCredits) {
      toast.success(`Successfully purchased ${purchasedCredits} credits!`);
      // Remove query params from URL
      const newUrl = window.location.pathname;
      router.replace(newUrl);
      // Fetch credits again after purchase
      fetchCredits();
    }

    if (searchParams.get("canceled") === "true") {
      toast.error("Credit purchase was canceled.");
      // Remove query params from URL
      const newUrl = window.location.pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router]);

  // Don't render anything until client-side hydration is complete
  if (!isMounted) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Credit Balance</CardTitle>
        <CardDescription>
          Credits are used to analyze repository files. New users start with 150 free credits!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{credits} credits</div>
      </CardContent>
    </Card>
  );
}

