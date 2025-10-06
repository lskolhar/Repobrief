"use client";
import React, { useState, useEffect } from 'react';
import type { TranscriptionJob } from '@/lib/assembly-ai';
import { formatMeetingSummary } from '@/lib/summary-formatter';
import { saveMeetingTranscription, getMeetingTranscription } from '@/lib/meeting-storage';
import { toast } from 'sonner';

interface MeetingTranscriptionProps {
  audioUrl: string;
  fileName: string;
}

export default function MeetingTranscription({ audioUrl, fileName }: MeetingTranscriptionProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Check for existing transcription on component mount
  useEffect(() => {
    async function checkExistingTranscription() {
      try {
        setIsLoading(true);
        const savedTranscription = await getMeetingTranscription(audioUrl);
        
        if (savedTranscription && savedTranscription.status === 'completed') {
          console.log('Found saved transcription:', savedTranscription);
          setTranscriptionResult(savedTranscription);
          setTranscriptionId(savedTranscription.id);
          setTranscriptionStatus('completed');
        } else {
          // Check if there's an in-progress transcription via API
          const response = await fetch(`/api/transcribe?audioUrl=${encodeURIComponent(audioUrl)}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.transcriptionId) {
              setTranscriptionId(data.transcriptionId);
              pollTranscriptionStatus(data.transcriptionId);
            }
          }
        }
      } catch (err) {
        console.error('Error checking existing transcription:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    checkExistingTranscription();
  }, [audioUrl]);

  const startTranscription = async () => {
    setIsTranscribing(true);
    setError(null);
    
    try {
      // Submit the audio URL to our API route which calls AssemblyAI
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
      
      const result = await response.json();
      setTranscriptionId(result.id);
      setTranscriptionStatus('queued');
      
      // Start polling for status
      pollTranscriptionStatus(result.id);
    } catch (err: any) {
      setError(err.message || 'Failed to start transcription');
      setIsTranscribing(false);
    }
  };

  const pollTranscriptionStatus = async (id: string) => {
    try {
      // Use our API route to check status
      const response = await fetch(`/api/transcribe?id=${id}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check transcription status');
      }
      
      const result = await response.json();
      setTranscriptionStatus(result.status);
      
      if (result.status === 'completed') {
        console.log('Transcription completed with result:', result);
        console.log('Summary available:', !!result.summary);
        setTranscriptionResult(result);
        setIsTranscribing(false);
        
        // Save the completed transcription to the database
        try {
          await saveMeetingTranscription(audioUrl, fileName, result);
          toast.success('Transcription saved successfully');
        } catch (err) {
          console.error('Error saving transcription:', err);
        }
      } else if (result.status === 'error') {
        setError('Transcription failed: ' + (result.error || 'Unknown error'));
        setIsTranscribing(false);
      } else {
        // Still processing, poll again after a delay
        setTimeout(() => pollTranscriptionStatus(id), 5000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check transcription status');
      setIsTranscribing(false);
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mt-2 w-full">
      {!transcriptionId && !isTranscribing && (
        <div className="mt-2">
          <button
            onClick={startTranscription}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md flex items-center text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Transcribe with AI
          </button>
        </div>
      )}
      
      {isTranscribing && (
        <div className="bg-blue-50 p-4 rounded-md">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            <span className="text-blue-700">
              {transcriptionStatus === 'queued' ? 'Queued for transcription...' : 
               transcriptionStatus === 'processing' ? 'Transcribing your audio...' : 
               'Processing...'}
            </span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 p-4 rounded-md mt-2">
          <div className="text-red-700 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        </div>
      )}
      
      {transcriptionResult && transcriptionResult.status === 'completed' && (
        <div className="mt-2">
          {/* Enhanced Summary Section with better formatting */}
          {(transcriptionResult.summary || transcriptionResult.text) && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md overflow-hidden mb-4">
              {/* Summary Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
                <h3 className="font-semibold text-white text-lg">Meeting Insights</h3>
              </div>
              <div className="p-4">
                {(() => {
                  const summaryText = transcriptionResult.summary?.text || 
                    (transcriptionResult.text ? 
                      `This is an automated summary of the meeting transcript: ${transcriptionResult.text.substring(0, 500)}...` : 
                      'No summary available');
                  
                  const formattedSummary = formatMeetingSummary(summaryText);
                  //console.log('Formatted summary:', formattedSummary);
                  
                  return (
                    <>
                      <div className="mb-4 border-b border-blue-100 pb-3">
                        <h4 className="text-xl font-medium text-gray-800 mb-1">{formattedSummary.meetingTitle}</h4>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                          {formattedSummary.duration !== "Duration not specified" && (
                            <div className="flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{formattedSummary.duration}</span>
                            </div>
                          )}
                          <div className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{new Date().toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-5 shadow-sm border border-blue-200 hover:shadow-md transition-shadow duration-200">
                          <div className="flex items-center mb-4">
                            <div className="bg-blue-500 p-2 rounded-full mr-3 shadow-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            </div>
                            <h4 className="font-semibold text-blue-800 text-lg">Key Points</h4>
                          </div>
                          {formattedSummary.keyPoints.length > 0 ? (
                            <ul className="space-y-3">
                              {formattedSummary.keyPoints.map((point, index) => (
                                <li key={index} className="flex items-start bg-white p-3 rounded-md shadow-sm border border-blue-100">
                                  <span className="flex-shrink-0 bg-blue-500 text-white font-medium rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5">{index + 1}</span>
                                  <span className="text-gray-700 font-medium">{point}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="bg-white p-4 rounded-md text-gray-500 italic border border-blue-100">
                              No key points identified
                            </div>
                          )}
                        </div>
                        <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-5 shadow-sm border border-green-200 hover:shadow-md transition-shadow duration-200">
                          <div className="flex items-center mb-4">
                            <div className="bg-green-500 p-2 rounded-full mr-3 shadow-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            </div>
                            <h4 className="font-semibold text-green-800 text-lg">Action Items</h4>
                          </div>
                          {formattedSummary.actionItems && formattedSummary.actionItems.length > 0 ? (
                            <ul className="space-y-3">
                              {formattedSummary.actionItems.map((item: string, index: number) => (
                                <li key={index} className="flex items-start bg-white p-3 rounded-md shadow-sm border border-green-100">
                                  <div className="flex-shrink-0 bg-green-100 text-green-600 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                  </div>
                                  <span className="text-gray-700 font-medium">{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="bg-white p-4 rounded-md text-gray-500 italic border border-green-100">
                              No action items identified
                            </div>
                          )}
                        </div>
                        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-5 shadow-sm border border-purple-200 hover:shadow-md transition-shadow duration-200">
                          <div className="flex items-center mb-4">
                            <div className="bg-purple-500 p-2 rounded-full mr-3 shadow-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <h4 className="font-semibold text-purple-800 text-lg">Decisions Made</h4>
                          </div>
                          {formattedSummary.decisions && formattedSummary.decisions.length > 0 ? (
                            <ul className="space-y-3">
                              {formattedSummary.decisions.map((decision: string, index: number) => (
                                <li key={index} className="flex items-start bg-white p-3 rounded-md shadow-sm border border-purple-100">
                                  <div className="flex-shrink-0 bg-purple-100 text-purple-600 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                  </div>
                                  <span className="text-gray-700 font-medium">{decision}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="bg-white p-4 rounded-md text-gray-500 italic border border-purple-100">
                              No decisions identified
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end mt-4">
                        <button
                          onClick={() => {
                            const element = document.createElement("a");
                            const file = new Blob([
                              `# ${formattedSummary.meetingTitle}\n\n` +
                              `## Key Points\n\n${formattedSummary.keyPoints.map(p => `- ${p}`).join('\n')}\n\n` +
                              `## Action Items\n\n${formattedSummary.actionItems?.map((a: string) => `- ${a}`).join('\n') || ''}\n\n` +
                              `## Decisions\n\n${formattedSummary.decisions?.map((d: string) => `- ${d}`).join('\n') || ''}\n\n` +
                              `## Full Summary\n\n${formattedSummary.mainSummary}`
                            ], {type: 'text/plain'});
                            element.href = URL.createObjectURL(file);
                            element.download = `${fileName.replace('.mp3', '')}_summary.md`;
                            document.body.appendChild(element);
                            document.body.removeChild(element);
                          }}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Export Summary
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          
          {/* Chapters/Topics Section */}
          {transcriptionResult.chapters && transcriptionResult.chapters.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium text-gray-800 mb-2">Topics Discussed</h3>
              <div className="space-y-2">
                {transcriptionResult.chapters.map((chapter, index) => (
                  <div key={index} className="border border-gray-200 rounded-md p-3">
                    <div className="flex justify-between">
                      <h4 className="font-medium">{chapter.headline}</h4>
                      <span className="text-xs text-gray-500">
                        {formatTime(chapter.start)} - {formatTime(chapter.end)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{chapter.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Full Transcript Section */}
          {transcriptionResult.text && (
            <div className="mb-4">
              <h3 className="font-medium text-gray-800 mb-2">Full Transcript</h3>
              <div className="bg-white border border-gray-200 rounded-md p-4 max-h-96 overflow-y-auto">
                {transcriptionResult.utterances ? (
                  // Display with speaker labels if available
                  transcriptionResult.utterances.map((utterance, index) => (
                    <div key={index} className="mb-3">
                      <div className="flex items-center mb-1">
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                          Speaker {utterance.speaker}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {formatTime(utterance.start)}
                        </span>
                      </div>
                      <p className="text-gray-700">{utterance.text}</p>
                    </div>
                  ))
                ) : (
                  // Display plain text if speaker labels not available
                  <p className="text-gray-700 whitespace-pre-line">{transcriptionResult.text}</p>
                )}
              </div>
            </div>
          )}
          
          {/* Entities Section */}
          {transcriptionResult.entities && transcriptionResult.entities.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium text-gray-800 mb-2">Key Entities</h3>
              <div className="flex flex-wrap gap-2">
                {transcriptionResult.entities.map((entity, index) => (
                  <span key={index} className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {entity.text} ({entity.entity_type})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
