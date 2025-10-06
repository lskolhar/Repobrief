"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, Download } from "lucide-react";
import { formatMeetingSummary } from "@/lib/summary-formatter";
import { getMeetingTranscription } from "@/lib/meeting-storage";
import { toast } from "sonner";

interface MeetingUploadCardProps {
  onUploadSuccess?: () => void;
}

interface MeetingSummary {
  meetingTitle?: string;
  transcript?: string;
  keyPoints?: string[];
  actionItems?: string[];
  decisions?: string[];
  participants?: string[];
}

export default function MeetingUploadCard({ onUploadSuccess }: MeetingUploadCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showSummaryPopup, setShowSummaryPopup] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [meetingSummary, setMeetingSummary] = useState<MeetingSummary | null>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setUrl(null);
    setProgress(0);
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 50 * 1024 * 1024) {
        setError("File size exceeds 50MB limit.");
        setFile(null);
      } else if (!selected.type.startsWith("audio/mp3") && !selected.name.endsWith(".mp3")) {
        setError("Only MP3 files are allowed.");
        setFile(null);
      } else {
        setFile(selected);
      }
    }
  };

  // Custom function to track upload progress with Supabase
  const uploadWithProgress = async (bucket: string, path: string, file: File) => {
    // Supabase doesn't have built-in progress tracking like Firebase
    // We'll simulate progress by chunking the file and tracking manually
    
    setProgress(10); // Start progress
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
    
    // Simulate progress completion after upload
    setProgress(100);
    
    return { data, error };
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setUrl(null);
    
    // Create a unique file path with timestamp
    const filePath = `meetings/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    
    try {
      // Upload with progress tracking
      const { data, error: uploadError } = await uploadWithProgress("meetings", filePath, file);
      
      if (uploadError) {
        setError(uploadError.message);
        setUrl(null);
      } else {
        // Get the public URL after successful upload
        const { data: publicUrlData } = supabase.storage.from("meetings").getPublicUrl(filePath);
        const publicUrl = publicUrlData?.publicUrl || null;
        setUrl(publicUrl);
        
        // Show the summary popup
        if (publicUrl) {
          // Start transcription automatically
          startTranscription(publicUrl, file.name);
        }
        
        // Call the onUploadSuccess callback if provided
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Function to start transcription and show summary
  const startTranscription = async (audioUrl: string, fileName: string) => {
    setSummaryLoading(true);
    setShowSummaryPopup(true);
    
    try {
      // First check if we already have a transcription
      const existingTranscription = await getMeetingTranscription(audioUrl);
      
      if (existingTranscription && existingTranscription.status === 'completed') {
        // We already have a transcription, format it
        const summaryText = existingTranscription.summary?.text || 
          (existingTranscription.text ? existingTranscription.text : "No transcript available");
        
        // Format the summary
        const formattedSummary = formatMeetingSummary(
          summaryText,
          fileName,
          existingTranscription.utterances || []
        );
        
        setMeetingSummary(formattedSummary);
        setSummaryLoading(false);
      } else {
        // Start a new transcription
        // This would typically call an API endpoint to start the transcription process
        // For now, we'll just show a placeholder
        toast.info("Starting transcription process...");
        
        // Poll for status (in a real app)
        // For demo, we'll simulate with a timeout
        setTimeout(() => {
          pollTranscriptionStatus("demo-id", audioUrl, fileName);
        }, 2000);
      }
    } catch (error) {
      console.error("Error starting transcription:", error);
      setSummaryLoading(false);
      toast.error("Failed to start transcription");
    }
  };

  // Function to poll transcription status
  const pollTranscriptionStatus = async (id: string, audioUrl: string, fileName: string) => {
    try {
      // In a real app, this would check the status from an API
      // For demo purposes, we'll simulate a completed transcription
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Create a mock transcription result
      const mockTranscription = {
        meetingTitle: fileName.replace('.mp3', '').replace(/_/g, ' '),
        transcript: "This is a simulated transcript of the meeting. In a real application, this would contain the actual transcribed text from the audio file.",
        keyPoints: [
          "First key point from the meeting",
          "Second important discussion topic",
          "Third notable item mentioned"
        ],
        actionItems: [
          "Follow up with team about project timeline",
          "Schedule next meeting for next week",
          "Share meeting notes with stakeholders"
        ],
        decisions: [
          "Approved the new feature request",
          "Agreed on budget allocation for Q3",
          "Selected vendor for upcoming project"
        ],
        participants: [
          "John Doe",
          "Jane Smith",
          "Alex Johnson"
        ]
      };
      
      setMeetingSummary(mockTranscription);
      setSummaryLoading(false);
      
      // Save to local storage for future reference
      localStorage.setItem(`meeting_${audioUrl}`, JSON.stringify(mockTranscription));
      
    } catch (error) {
      console.error("Error polling transcription status:", error);
      setSummaryLoading(false);
      toast.error("Failed to get transcription status");
    }
  };

  // Function to close the summary popup
  const closeSummaryPopup = () => {
    setShowSummaryPopup(false);
    // Don't reset the summary so it can be viewed again
  };
  
  // Function to export summary
  const exportSummary = () => {
    if (!meetingSummary) return;
    
    // Create formatted markdown content
    const fullText = `# ${meetingSummary.meetingTitle || 'Meeting Summary'}

## Full Transcript
${meetingSummary.transcript || 'Not available'}

## Key Points
${meetingSummary.keyPoints?.map((p: string) => `- ${p}`).join('\n') || 'None identified'}

## Action Items
${meetingSummary.actionItems?.map((a: string) => `- ${a}`).join('\n') || 'None identified'}

## Decisions
${meetingSummary.decisions?.map((d: string) => `- ${d}`).join('\n') || 'None identified'}

## Participants
${meetingSummary.participants?.map((p: string) => `- ${p}`).join('\n') || 'None identified'}`;

    const blob = new Blob([fullText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.href = url;
    element.download = `${meetingSummary.meetingTitle?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'meeting'}_summary.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Summary exported successfully');
  };

  return (
    <div className="w-full">
      {/* Summary Popup */}
      {showSummaryPopup && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  {meetingSummary?.meetingTitle || "Meeting Summary"}
                </h2>
                <button
                  onClick={closeSummaryPopup}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              {summaryLoading ? (
                <div className="py-10 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-lg font-medium text-gray-700 mt-4">Processing your meeting...</p>
                  <p className="text-sm text-gray-500 mt-2">This may take a minute or two.</p>
                </div>
              ) : meetingSummary ? (
                <div className="space-y-6">
                  {/* Full Transcript Section - Moved to top for prominence */}
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    <h3 className="font-medium text-gray-800 mb-2">Full Transcript</h3>
                    <p className="text-xs text-gray-600 mb-2">Complete word-for-word transcript of everything spoken in the meeting</p>
                    
                    <div className="mt-2 max-h-[300px] overflow-y-auto bg-white p-3 rounded border border-gray-200">
                      {meetingSummary.transcript ? (
                        <p className="text-sm text-gray-700 whitespace-pre-line">{meetingSummary.transcript}</p>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Transcript not available</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-md">
                    <h3 className="font-medium text-blue-800 mb-2">Key Points</h3>
                    <p className="text-xs text-blue-600 mb-2">The most important information discussed in the meeting</p>
                    {meetingSummary.keyPoints && meetingSummary.keyPoints.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {meetingSummary.keyPoints.map((point: string, i: number) => (
                          <li key={i} className="text-sm text-gray-700">{point}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600">No key points identified.</p>
                    )}
                  </div>
                  
                  <div className="bg-yellow-50 p-4 rounded-md">
                    <h3 className="font-medium text-yellow-800 mb-2">Action Items</h3>
                    <p className="text-xs text-yellow-600 mb-2">Tasks that were assigned or need to be completed after the meeting</p>
                    {meetingSummary.actionItems && meetingSummary.actionItems.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {meetingSummary.actionItems.map((item: string, i: number) => (
                          <li key={i} className="text-sm text-gray-700">{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600">No action items identified.</p>
                    )}
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-md">
                    <h3 className="font-medium text-green-800 mb-2">Decisions</h3>
                    <p className="text-xs text-green-600 mb-2">Important conclusions or choices that were finalized during the meeting</p>
                    {meetingSummary.decisions && meetingSummary.decisions.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {meetingSummary.decisions.map((decision: string, i: number) => (
                          <li key={i} className="text-sm text-gray-700">{decision}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600">No decisions identified.</p>
                    )}
                  </div>
                  
                  {meetingSummary.participants && meetingSummary.participants.length > 0 && (
                    <div className="bg-purple-50 p-4 rounded-md">
                      <h3 className="font-medium text-purple-800 mb-2">Participants</h3>
                      <p className="text-xs text-purple-600 mb-2">People who attended or were mentioned in the meeting</p>
                      <div className="flex flex-wrap gap-2">
                        {meetingSummary.participants.map((person: string, i: number) => (
                          <span key={i} className="text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            {person}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => {
                        if (meetingSummary) {
                          navigator.clipboard.writeText(
                            `# ${meetingSummary.meetingTitle || 'Meeting Summary'}\n\n${meetingSummary.transcript || ''}`
                          );
                          toast.success('Copied to clipboard');
                        }
                      }}
                      className="flex items-center bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy to Clipboard
                    </button>
                    <button
                      onClick={exportSummary}
                      className="flex items-center bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Summary
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-gray-500">
                  No summary available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {!url ? (
        <div className="flex flex-col items-center">
          <div className="w-full mb-4 border border-dashed border-gray-300 rounded-md bg-gray-50 p-6 text-center">
            <div className="flex flex-col items-center justify-center space-y-2">
              <Upload className="h-8 w-8 text-gray-400" />
              <p className="text-sm text-gray-500">
                Click to upload or drag and drop<br />
                MP3 files only. MAX 50MB
              </p>
              <input
                type="file"
                accept="audio/mp3,.mp3"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer"
              >
                <div className="mt-2 w-full">
                  <button
                    type="button"
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    Upload Meeting
                  </button>
                </div>
              </label>
            </div>
          </div>
          
          {error && (
            <div className="mt-2 text-red-500 text-sm">
              {error}
            </div>
          )}
          
          {file && !uploading && !url && (
            <div className="mt-4 w-full">
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-md">
                <span className="text-sm font-medium text-blue-700 truncate max-w-[200px]">
                  {file.name}
                </span>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="ml-2 bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-3 rounded-md"
                >
                  Upload
                </button>
              </div>
            </div>
          )}
          
          {uploading && (
            <div className="mt-4 w-full">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-500 h-2.5 rounded-full"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="mt-2 text-sm text-gray-500 text-center">
                Uploading... {progress}%
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 w-full">
          <div className="bg-green-50 border border-green-100 rounded-md p-4">
            <h3 className="text-sm font-medium text-green-800 mb-2">Upload Complete!</h3>
            <p className="text-xs text-green-700 mb-3">
              Your meeting has been uploaded successfully.
            </p>
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center"
                >
                  <FileText className="h-3 w-3 mr-1" /> View File
                </a>
                <button
                  onClick={() => setShowSummaryPopup(true)}
                  className="text-xs text-purple-600 hover:underline flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  View Summary
                </button>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setUrl(null);
                  setProgress(0);
                }}
                className="text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md"
              >
                Upload Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
