import React from "react";
import MeetingDetailClient from "./meeting-detail-client";
// Make sure the file exists in the same directory

interface MeetingDetailProps {
  params: {
    id: string;
  };
}

export default async function MeetingDetailPage({ params }: MeetingDetailProps) {
  // This is now a server component that just passes the ID to the client component
  return <MeetingDetailClient meetingId={params.id} />;
}