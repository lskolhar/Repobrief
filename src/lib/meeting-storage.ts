import { supabase } from './supabase';
import type { TranscriptionJob } from './assembly-ai';

// Ensure the meeting_transcriptions table exists
async function ensureTranscriptionsTable() {
  try {
    // Check if the table exists by trying to select from it
    const { error } = await supabase
      .from('meeting_transcriptions')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') { // Table doesn't exist error code
      console.log('Creating meeting_transcriptions table...');
      // We'll use local storage as a fallback since we can't create tables directly
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error checking for meeting_transcriptions table:', err);
    return false;
  }
}

// Initialize table check
const tablePromise = ensureTranscriptionsTable();

/**
 * Saves a meeting transcription result to the database or localStorage
 */
export async function saveMeetingTranscription(
  audioUrl: string,
  fileName: string,
  transcriptionResult: TranscriptionJob
) {
  try {
    // Create a simplified version of the transcription result to store
    const formattedData = {
      audio_url: audioUrl,
      file_name: fileName,
      transcription_id: transcriptionResult.id,
      summary: transcriptionResult.summary?.text || null,
      text: transcriptionResult.text || null,
      status: transcriptionResult.status,
      created_at: new Date().toISOString(),
      raw_data: JSON.stringify(transcriptionResult)
    };

    // Check if the table exists
    const tableExists = await tablePromise;
    
    if (tableExists) {
      // Insert into a custom table in Supabase
      const { data, error } = await supabase
        .from('meeting_transcriptions')
        .upsert(formattedData, { 
          onConflict: 'audio_url',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error saving transcription to Supabase:', error);
        // Fall back to localStorage
        saveToLocalStorage(audioUrl, transcriptionResult);
        return { success: true, source: 'localStorage' };
      }

      return { success: true, source: 'supabase', data };
    } else {
      // Fall back to localStorage
      saveToLocalStorage(audioUrl, transcriptionResult);
      return { success: true, source: 'localStorage' };
    }
  } catch (err) {
    console.error('Error in saveMeetingTranscription:', err);
    // Last resort - try localStorage
    try {
      saveToLocalStorage(audioUrl, transcriptionResult);
      return { success: true, source: 'localStorage' };
    } catch (localErr) {
      console.error('Failed to save to localStorage:', localErr);
      throw err;
    }
  }
}

/**
 * Save transcription to localStorage
 */
function saveToLocalStorage(audioUrl: string, transcriptionResult: TranscriptionJob) {
  try {
    // Create a key based on the audio URL
    const key = `meeting_transcription_${btoa(audioUrl)}`;
    localStorage.setItem(key, JSON.stringify(transcriptionResult));
    console.log('Saved transcription to localStorage with key:', key);
    return true;
  } catch (err) {
    console.error('Error saving to localStorage:', err);
    throw err;
  }
}

/**
 * Retrieves a meeting transcription result from the database or localStorage
 */
export async function getMeetingTranscription(audioUrl: string) {
  try {
    // Check if the table exists
    const tableExists = await tablePromise;
    
    if (tableExists) {
      // Try to get from Supabase first
      const { data, error } = await supabase
        .from('meeting_transcriptions')
        .select('*')
        .eq('audio_url', audioUrl)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - try localStorage
          return getFromLocalStorage(audioUrl);
        }
        console.error('Error fetching transcription from Supabase:', error);
        // Fall back to localStorage
        return getFromLocalStorage(audioUrl);
      }

      if (!data) return getFromLocalStorage(audioUrl);

      // Parse the raw data back to a TranscriptionJob object
      const transcriptionResult: TranscriptionJob = data.raw_data 
        ? JSON.parse(data.raw_data) 
        : {
            id: data.transcription_id,
            status: data.status,
            text: data.text,
            summary: data.summary ? { text: data.summary } : undefined
          };

      return transcriptionResult;
    } else {
      // Fall back to localStorage
      return getFromLocalStorage(audioUrl);
    }
  } catch (err) {
    console.error('Error in getMeetingTranscription:', err);
    // Try localStorage as a last resort
    return getFromLocalStorage(audioUrl);
  }
}

/**
 * Get transcription from localStorage
 */
function getFromLocalStorage(audioUrl: string): TranscriptionJob | null {
  try {
    // Create a key based on the audio URL
    const key = `meeting_transcription_${btoa(audioUrl)}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) return null;
    
    const transcription = JSON.parse(stored) as TranscriptionJob;
    console.log('Retrieved transcription from localStorage with key:', key);
    return transcription;
  } catch (err) {
    console.error('Error retrieving from localStorage:', err);
    return null;
  }
}
