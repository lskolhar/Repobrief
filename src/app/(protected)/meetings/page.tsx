"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import MeetingUploadCard from "../dashboard/meeting-upload-card";
import MeetingTranscription from "@/components/meeting-transcription";

interface Meeting {
  name: string;
  url: string;
  created_at?: string;
  size?: number;
  location: string;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [currentlyTranscribing, setCurrentlyTranscribing] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Create a state to track deleted meeting URLs to ensure they don't reappear
  const [deletedMeetingUrls, setDeletedMeetingUrls] = useState<string[]>([]);
  
  // Load deleted meeting URLs from localStorage on component mount
  useEffect(() => {
    try {
      const savedDeletedUrls = localStorage.getItem('deletedMeetingUrls');
      if (savedDeletedUrls) {
        const parsedUrls = JSON.parse(savedDeletedUrls);
        console.log('Loaded deleted meeting URLs from localStorage:', parsedUrls);
        setDeletedMeetingUrls(parsedUrls);
      }
    } catch (err) {
      console.error('Error loading deleted meeting URLs:', err);
    }
    
    // This will run when the component mounts
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'deletedMeetingUrls' && e.newValue) {
        try {
          const updatedUrls = JSON.parse(e.newValue);
          console.log('Storage event: Updated deleted URLs:', updatedUrls);
          setDeletedMeetingUrls(updatedUrls);
        } catch (err) {
          console.error('Error parsing updated deleted URLs:', err);
        }
      }
    };
    
    // Listen for storage events (in case localStorage is updated in another tab)
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Function to delete a meeting (with option for permanent deletion)
  const deleteMeeting = async (meeting: Meeting, index: number, permanent: boolean = false) => {
    try {
      // Disable the button during deletion
      const deleteButton = document.getElementById(`delete-${index}`) as HTMLButtonElement;
      if (deleteButton) {
        deleteButton.disabled = true;
        deleteButton.innerText = 'Deleting...';
      }
      
      // Immediately remove from UI for better user experience (optimistic update)
      setMeetings(prev => prev.filter(m => m.url !== meeting.url));

      // For temporary deletion, add to deleted meetings list to prevent it from reappearing
      if (!permanent) {
        const updatedDeletedUrls = [...deletedMeetingUrls, meeting.url];
        console.log('Adding to deleted list:', meeting.url);
        console.log('New deleted list:', updatedDeletedUrls);
        setDeletedMeetingUrls(updatedDeletedUrls);
        
        // Save to localStorage
        localStorage.setItem('deletedMeetingUrls', JSON.stringify(updatedDeletedUrls));
      }
      
      // Clear any currently playing or transcribing state if it's this meeting
      if (currentlyPlaying === meeting.url) {
        setCurrentlyPlaying(null);
      }
      if (currentlyTranscribing === meeting.url) {
        setCurrentlyTranscribing(null);
      }

      // Delete the file from Supabase storage
      const path = meeting.location === 'meetings subfolder' ? `meetings/${meeting.name}` : meeting.name;
      const { error: storageError } = await supabase.storage
        .from('meetings')
        .remove([path]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        toast.error('Failed to delete meeting from storage.');
      } else {
        // If permanent deletion, also delete from database and transcriptions
        if (permanent) {
          // Delete transcription data from Supabase
          try {
            // First, get the transcription ID if it exists
            const response = await fetch(`/api/transcribe?audioUrl=${encodeURIComponent(meeting.url)}`);
            if (response.ok) {
              const data = await response.json();
              if (data.transcriptionId) {
                // Delete the transcription from the database
                const deleteResponse = await fetch(`/api/transcribe?id=${data.transcriptionId}`, {
                  method: 'DELETE',
                });
                
                if (!deleteResponse.ok) {
                  console.error('Error deleting transcription from database:', await deleteResponse.text());
                } else {
                  console.log('Successfully deleted transcription from database');
                }
              }
            }
          } catch (err) {
            console.error('Error deleting transcription data:', err);
          }

          // If permanent deletion, remove from deleted URLs list if it's there
          if (deletedMeetingUrls.includes(meeting.url)) {
            const filteredUrls = deletedMeetingUrls.filter(url => url !== meeting.url);
            setDeletedMeetingUrls(filteredUrls);
            localStorage.setItem('deletedMeetingUrls', JSON.stringify(filteredUrls));
          }

          // Remove transcription from localStorage as well
          const storageKey = `meeting_transcription_${btoa(meeting.url)}`;
          localStorage.removeItem(storageKey);

          // Refresh the meetings list
          setTimeout(() => {
            setRefreshTrigger(prev => prev + 1);
          }, 500);

          toast.success('Meeting permanently deleted');
        } else {
          // For temporary deletion, just show success message
          toast.success('Meeting moved to trash');
          
          // Still remove from localStorage to prevent stale data
          const storageKey = `meeting_transcription_${btoa(meeting.url)}`;
          localStorage.removeItem(storageKey);
        }
      }

      // Refresh the meetings list
      setTimeout(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 500);

      toast.success(permanent ? 'Meeting permanently deleted' : 'Meeting deleted successfully');
    } catch (err) {
      console.error('Error deleting meeting:', err);
      toast.error('Failed to delete meeting. Please try again.');
    }
  };

  // Function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Function to get file name without timestamp prefix
  const getDisplayName = (filename: string): string => {
    // Remove timestamp prefix if it exists (e.g., 1746086661404_)
    const parts = filename.split('_');
    if (parts.length > 1 && !isNaN(Number(parts[0]))) {
      return parts.slice(1).join('_').replace(/_/g, ' ');
    }
    return filename.replace(/_/g, ' ');
  };

  // Format date without date-fns
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);
      
      if (diffDay > 30) {
        return date.toLocaleDateString();
      } else if (diffDay > 0) {
        return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
      } else if (diffHour > 0) {
        return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
      } else if (diffMin > 0) {
        return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
      } else {
        return 'Just now';
      }
    } catch (e) {
      return 'Unknown date';
    }
  };

  // Function to refresh the meetings list
  const refreshMeetings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log("Refreshing meetings list...");
      
      // Clear any currently playing or transcribing state
      setCurrentlyPlaying(null);
      setCurrentlyTranscribing(null);
      
      // Fetch all files from the meetings bucket
      const { data: allFiles, error: allFilesError } = await supabase.storage
        .from('meetings')
        .list('', {
          sortBy: { column: 'created_at', order: 'desc' }
        });
      
      // Fetch files from the meetings subfolder if it exists
      const { data: meetingsSubfolderFiles, error: meetingsSubfolderError } = await supabase.storage
        .from('meetings')
        .list('meetings', {
          sortBy: { column: 'created_at', order: 'desc' }
        });
      
      // Combine all MP3 files from both locations
      const mp3Files: Meeting[] = [];
      
      if (allFiles && !allFilesError) {
        const rootMp3s = allFiles.filter(file => 
          file.name && file.name.toLowerCase().endsWith('.mp3')
        );
        
        mp3Files.push(...rootMp3s.map(file => ({
          name: file.name,
          url: supabase.storage.from("meetings").getPublicUrl(file.name).data.publicUrl,
          created_at: file.created_at,
          size: file.metadata?.size,
          location: "root"
        })));
      }
      
      if (meetingsSubfolderFiles && !meetingsSubfolderError) {
        const subfolderMp3s = meetingsSubfolderFiles.filter(file => 
          file.name && file.name.toLowerCase().endsWith('.mp3')
        );
        
        mp3Files.push(...subfolderMp3s.map(file => ({
          name: file.name,
          url: supabase.storage.from("meetings").getPublicUrl(`meetings/${file.name}`).data.publicUrl,
          created_at: file.created_at,
          size: file.metadata?.size,
          location: "meetings subfolder"
        })));
      }
      
      // Filter out any deleted meetings
      const filteredMeetings = mp3Files.filter(meeting => 
        !deletedMeetingUrls.includes(meeting.url) && 
        !deletedMeetingUrls.includes(decodeURIComponent(meeting.url))
      );
      
      // Sort by creation date (newest first)
      filteredMeetings.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
      
      setMeetings(filteredMeetings);
      setLoading(false);
      
      // Debug info
      setDebug({
        totalFiles: mp3Files.length,
        filteredFiles: filteredMeetings.length,
        deletedUrls: deletedMeetingUrls,
        allFilesError,
        meetingsSubfolderError
      });
      
    } catch (err) {
      console.error("Error fetching meetings:", err);
      setError("Failed to load meetings. Please try again later.");
      setLoading(false);
    }
  };
  
  // Trigger refresh when component mounts or refreshTrigger changes
  useEffect(() => {
    refreshMeetings();
  }, [refreshTrigger]);

  // Function to handle successful upload
  const handleUploadSuccess = () => {
    toast.success("Meeting uploaded successfully!");
    // Refresh the meetings list
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Your Meetings</h1>
        <MeetingUploadCard onUploadSuccess={handleUploadSuccess} />
      </div>
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700">Recorded Meetings</h2>
          <p className="text-sm text-gray-500">View, transcribe, and manage your meeting recordings</p>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading your meetings...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="bg-red-100 text-red-700 p-4 rounded-lg inline-block">
              <p>{error}</p>
              <button 
                onClick={() => setRefreshTrigger(prev => prev + 1)}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : meetings.length === 0 ? (
          <div className="p-8 text-center">
            <div className="bg-blue-50 text-blue-700 p-6 rounded-lg inline-block">
              <p className="mb-2">You don't have any meetings yet.</p>
              <p className="text-sm text-blue-600">Upload your first meeting recording to get started!</p>
            </div>
            
            {debug && (
              <div className="mt-8">
                <details className="text-left">
                  <summary className="text-sm text-gray-500 cursor-pointer">Debug Info</summary>
                  <pre className="text-xs text-gray-500 mt-2 bg-gray-100 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(debug, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {meetings.map((meeting, index) => (
              <div key={meeting.url} className="p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start mb-1">
                  <div className="bg-blue-100 rounded-full p-1.5 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{getDisplayName(meeting.name)}</h3>
                    <div className="flex flex-wrap text-xs text-gray-500 mt-0.5">
                      {meeting.created_at && (
                        <span className="mr-3">
                          Uploaded {formatDate(meeting.created_at)}
                        </span>
                      )}
                      {meeting.size && (
                        <span className="mr-3">{formatFileSize(meeting.size)}</span>
                      )}
                      {meeting.location && (
                        <span className="text-blue-500">({meeting.location})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => {
                        setCurrentlyTranscribing(currentlyTranscribing === meeting.url ? null : meeting.url);
                        // Close audio player if opening transcription
                        if (currentlyPlaying === meeting.url) {
                          setCurrentlyPlaying(null);
                        }
                      }}
                      className="text-green-600 hover:text-green-800"
                      title="Transcribe with AI"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {currentlyPlaying === meeting.url && (
                  <div className="mt-2 mb-1">
                    <audio 
                      controls 
                      src={meeting.url} 
                      className="w-full" 
                      autoPlay
                      onEnded={() => setCurrentlyPlaying(null)}
                    />
                  </div>
                )}
                
                {currentlyTranscribing === meeting.url && (
                  <div className="mt-1 mb-1">
                    <MeetingTranscription audioUrl={meeting.url} fileName={meeting.name} />
                  </div>
                )}
                
                <div className="flex justify-end mt-1 gap-3">
                  <button
                    onClick={() => {
                      // Navigate to meeting detail page
                      window.location.href = `/meetings/${encodeURIComponent(meeting.location === 'meetings subfolder' ? `meetings/${meeting.name}` : meeting.name)}`;
                    }}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    View Meeting
                  </button>
                  
                  <button
                    id={`delete-${index}`}
                    onClick={() => {
                      const result = confirm(`Delete "${getDisplayName(meeting.name)}"?\n\nChoose OK for temporary deletion (can be recovered by admin)\nChoose Cancel to see permanent deletion option`);
                      
                      if (result) {
                        // User chose temporary deletion
                        deleteMeeting(meeting, index, false);
                      } else {
                        // User canceled, ask about permanent deletion
                        const permanentDelete = confirm(`⚠️ PERMANENTLY delete "${getDisplayName(meeting.name)}"?\n\nThis action CANNOT be undone. The meeting will be completely removed from all storage.`);
                        if (permanentDelete) {
                          deleteMeeting(meeting, index, true);
                        }
                      }
                    }}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
