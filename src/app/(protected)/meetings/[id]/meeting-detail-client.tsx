"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { TranscriptionJob } from "@/lib/assembly-ai";
import { formatMeetingSummary } from "@/lib/summary-formatter";
import { getMeetingTranscription, saveMeetingTranscription } from "@/lib/meeting-storage";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MeetingDetailClientProps {
  meetingId: string;
}

export default function MeetingDetailClient({ meetingId }: MeetingDetailClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionJob | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  // Fetch meeting details on load
  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        // Decode the meeting ID (which is the encoded file path)
        const decodedId = decodeURIComponent(meetingId);
        
        // Get the file URL
        const { data } = supabase.storage
          .from('meetings')
          .getPublicUrl(decodedId);
        
        if (data && data.publicUrl) {
          setAudioUrl(data.publicUrl);
          
          // Check if we already have a transcription for this audio
          await checkExistingTranscription(data.publicUrl);
        } else {
          setError('Could not retrieve audio file');
        }
      } catch (err) {
        console.error('Error fetching meeting:', err);
        setError('Error loading meeting');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMeeting();
  }, [meetingId]); // Safe to use meetingId here since it's passed as a prop

  // Check if we already have a transcription for this audio
  const checkExistingTranscription = async (url: string) => {
    try {
      console.log('Checking for existing transcription for URL:', url);
      // First check if we have a saved transcription in the database
      const savedTranscription = await getMeetingTranscription(url);
      
      if (savedTranscription && savedTranscription.status === 'completed') {
        console.log('Found saved transcription in database:', savedTranscription);
        console.log('Transcription summary available:', !!savedTranscription.summary);
        console.log('Transcription text available:', !!savedTranscription.text);
        
        setTranscriptionResult(savedTranscription);
        setTranscriptionId(savedTranscription.id);
        return;
      }
      
      // If not in database, check the API
      const response = await fetch(`/api/transcribe?audioUrl=${encodeURIComponent(url)}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.transcriptionId) {
          setTranscriptionId(data.transcriptionId);
          // Use the existing polling function
          await pollTranscriptionStatus(data.transcriptionId);
        }
      }
    } catch (err) {
      console.error("Error checking existing transcription:", err);
      // Don't set error state here, as this is just a check
    }
  };

  // Start a new transcription
  const startTranscription = async () => {
    if (!audioUrl) return;
    
    setTranscribing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audioUrl }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start transcription');
      }
      
      const data = await response.json();
      
      if (data.id) {
        setTranscriptionId(data.id);
        toast.success('Transcription started');
        
        // Poll for transcription status
        await pollTranscriptionStatus(data.id);
      } else {
        throw new Error('No transcription ID returned');
      }
    } catch (err: any) {
      console.error('Error starting transcription:', err);
      setError(err.message || 'Error starting transcription');
      toast.error(err.message || 'Error starting transcription');
    } finally {
      setTranscribing(false);
    }
  };
  
  // Poll for transcription status
  const pollTranscriptionStatus = async (id: string) => {
    try {
      const checkStatus = async () => {
        const response = await fetch(`/api/transcribe?id=${id}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to check transcription status');
        }
        
        const data = await response.json();
        
        if (data.status === 'completed') {
          setTranscriptionResult(data);
          
          // Save the completed transcription to the database
          // Extract the fileName from the audioUrl
          const fileName = decodeURIComponent(meetingId).split('/').pop() || 'unknown-file';
          await saveMeetingTranscription(audioUrl!, fileName, data);
          
          toast.success('Transcription completed');
          return true;
        } else if (data.status === 'error') {
          throw new Error(data.error || 'Transcription failed');
        }
        
        return false;
      };
      
      // Initial check
      const isComplete = await checkStatus();
      if (isComplete) return;
      
      // Set up polling
      const interval = setInterval(async () => {
        try {
          const isComplete = await checkStatus();
          if (isComplete) {
            clearInterval(interval);
          }
        } catch (err: any) {
          console.error('Error polling transcription status:', err);
          setError(err.message || 'Error checking transcription status');
          clearInterval(interval);
        }
      }, 5000); // Check every 5 seconds
      
      // Clean up interval on component unmount
      return () => clearInterval(interval);
    } catch (err: any) {
      console.error('Error polling transcription status:', err);
      setError(err.message || 'Error checking transcription status');
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meeting Recording</h1>
        <Button 
          variant="outline" 
          onClick={() => router.push('/meetings')}
        >
          Back to Meetings
        </Button>
      </div>
      
      {loading && <p>Loading meeting details...</p>}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {audioUrl && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Audio Recording</h2>
          <audio controls className="w-full">
            <source src={audioUrl} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
      
      {audioUrl && !transcriptionResult && !transcribing && (
        <div className="mb-6">
          <Button 
            onClick={startTranscription}
            disabled={transcribing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Transcribe with AI
          </Button>
          <p className="text-sm text-gray-500 mt-2">
            This will transcribe the audio and generate a summary of the meeting.
          </p>
        </div>
      )}
      
      {transcribing && (
        <div className="mb-6">
          <p className="text-blue-600 font-semibold">
            Transcribing audio... This may take a few minutes.
          </p>
        </div>
      )}
      
      {/* Meeting Transcription Component */}
      {transcriptionResult && (
        <div className="mt-2">
                {/* Enhanced Summary Section with better formatting */}
                {(transcriptionResult.summary || transcriptionResult.text) && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md overflow-hidden mb-4">
                    {/* Summary Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
                      <h2 className="text-xl font-bold text-white">Meeting Summary</h2>
                    </div>
                    
                    {(() => {
                      // Create a summary from the transcript text if no summary is available
                      const summaryText = transcriptionResult.summary?.text ||
                        transcriptionResult.text ||
                        'No summary available';
                      
                      const formattedSummary = formatMeetingSummary(summaryText, undefined, transcriptionResult.utterances as any);
                      console.log('Formatted summary:', formattedSummary);
                      
                      return (
                        <div className="p-4">
                          <div className="mb-4">
                            <h3 className="text-lg font-semibold">{formattedSummary.meetingTitle}</h3>
                            <p className="text-gray-500">{formattedSummary.duration}</p>
                          </div>
                          
                          <div className="mb-4">
                            <div className="mb-4">
                              {/* Key Points */}
                              <div className="bg-white rounded-lg p-4 shadow-sm">
                                <div className="flex items-center mb-2">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                                    <span className="text-blue-600">📌</span>
                                  </div>
                                  <h4 className="text-md font-semibold">Key Points</h4>
                                </div>
                                {formattedSummary.keyPoints.length > 0 ? (
                                  <ul className="list-disc pl-5 space-y-1">
                                    {formattedSummary.keyPoints.map((point, index) => (
                                      <li key={index} className="text-gray-700">{point}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-gray-500 italic">No key points identified</p>
                                )}
                              </div>

                              {/* Participants section removed */}

                              {/* Speaker Summaries */}
                              {formattedSummary.speakerSummaries && formattedSummary.speakerSummaries.length > 0 && (
                                <div className="bg-white rounded-lg p-4 shadow-sm mt-4">
                                  <h4 className="text-md font-semibold mb-2">Speaker Summaries</h4>
                                  {formattedSummary.speakerSummaries.map((speakerSummary, idx) => (
                                    <div key={idx} className="mb-3">
                                      <span className="font-semibold text-blue-700">{speakerSummary.speaker}:</span>
                                      <span className="ml-2 text-gray-700">{speakerSummary.summary}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <details className="mt-4">
                              <summary className="text-blue-600 cursor-pointer font-semibold">
                                ▼ View Full Summary
                              </summary>
                              <div className="mt-2 p-4 bg-white rounded-lg">
                                {formattedSummary.mainSummary || 'No summary available'}
                              </div>
                            </details>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
        </div>
      )}
    </div>
  );
}
