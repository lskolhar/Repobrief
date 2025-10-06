// AssemblyAI API client
import { createClient } from '@supabase/supabase-js';

// Get API key from environment variables
const API_KEY = process.env.ASSEMBLYAI_API_KEY;
console.log('AssemblyAI API Key available:', !!API_KEY); // Log if API key exists (not the actual key)
const API_BASE_URL = 'https://api.assemblyai.com/v2';

// Types for AssemblyAI responses
export interface TranscriptionJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  audio_url: string;
  error?: string;
  utterances?: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
  chapters?: Array<{
    headline: string;
    gist: string;
    summary: string;
    start: number;
    end: number;
  }>;
  summary?: {
    text: string;
  };
  entities?: Array<{
    entity_type: string;
    text: string;
    start: number;
    end: number;
  }>;
}

/**
 * Submit an audio file for transcription
 * @param audioUrl URL of the audio file to transcribe
 * @returns Transcription job information
 */
export async function submitTranscriptionJob(audioUrl: string): Promise<TranscriptionJob> {
  try {
    const response = await fetch(`${API_BASE_URL}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: 'en_us',
        speaker_labels: true,
        auto_chapters: true,
        entity_detection: true,
        summarization: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`AssemblyAI API error: ${errorData.error || response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error submitting transcription job:', error);
    throw error;
  }
}

/**
 * Check the status of a transcription job
 * @param transcriptId ID of the transcription job
 * @returns Current status of the transcription
 */
export async function getTranscriptionStatus(transcriptId: string): Promise<TranscriptionJob> {
  try {
    const response = await fetch(`${API_BASE_URL}/transcript/${transcriptId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY || ''}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`AssemblyAI API error: ${errorData.error || response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error checking transcription status:', error);
    throw error;
  }
}

/**
 * Get the result of a completed transcription
 * @param transcriptId ID of the transcription job
 * @returns Transcription result or status
 */
export async function getTranscriptionResult(transcriptId: string): Promise<TranscriptionJob> {
  try {
    const response = await fetch(`${API_BASE_URL}/transcript/${transcriptId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY || ''}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`AssemblyAI API error: ${errorData.error || response.status}`);
    }

    const data = await response.json();
    
    if (data.status === 'completed') {
      return data;
    } else if (data.status === 'error') {
      throw new Error(`Transcription error: ${data.error}`);
    } else {
      return { status: data.status, id: data.id, audio_url: data.audio_url };
    }
  } catch (error: any) {
    console.error('Error getting transcription result:', error);
    throw error;
  }
}
