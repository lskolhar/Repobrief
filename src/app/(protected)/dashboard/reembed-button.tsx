"use client";
import React, { useState } from "react";

interface ReembedButtonProps {
  projectId: string;
}

export const ReembedButton: React.FC<ReembedButtonProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleReembed = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/reembed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("Re-embedding started. Please wait a few minutes and refresh for updated results.");
      } else {
        setStatus(data.error || "An error occurred.");
      }
    } catch (err: any) {
      setStatus(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-4">
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        onClick={handleReembed}
        disabled={loading}
      >
        {loading ? "Re-embedding..." : "Re-Embed All Files"}
      </button>
      {status && <div className="mt-2 text-sm text-gray-600">{status}</div>}
    </div>
  );
};
