import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Get API key directly from environment variables
const API_KEY = process.env.ASSEMBLYAI_API_KEY;
const API_BASE_URL = 'https://api.assemblyai.com/v2';

export async function POST(request: Request) {
  try {
    const { audioUrl } = await request.json();
    
    if (!audioUrl) {
      return NextResponse.json(
        { error: 'Audio URL is required' },
        { status: 400 }
      );
    }
    
    if (!API_KEY) {
      console.error('AssemblyAI API key is missing');
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }
    
    // Log that we're making a request (without exposing the full API key)
    console.log(`Making AssemblyAI request for: ${audioUrl}`);
    console.log(`API Key available: ${!!API_KEY}`);
    
    // Submit transcription job to AssemblyAI
    const response = await fetch(`${API_BASE_URL}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: 'en_us',
        speaker_labels: true,
        // Enable summarization with explicit parameters
        summarization: true,
        summary_model: 'informative',
        summary_type: 'paragraph',
        entity_detection: true,
      }),
    });
    
    console.log('Submitted transcription job with summarization enabled');
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('AssemblyAI API error:', errorData);
      return NextResponse.json(
        { error: `AssemblyAI API error: ${errorData.error || response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in transcribe API route:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// DELETE method to permanently delete a transcription
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const transcriptId = url.searchParams.get('id');
    
    if (!transcriptId) {
      return NextResponse.json(
        { error: 'Transcript ID is required for deletion' },
        { status: 400 }
      );
    }
    
    console.log(`Deleting transcription with ID: ${transcriptId}`);
    
    // Delete from Supabase
    const { error: supabaseError } = await supabase
      .from('meeting_transcriptions')
      .delete()
      .eq('transcription_id', transcriptId);
    
    if (supabaseError) {
      console.error('Error deleting from Supabase:', supabaseError);
      return NextResponse.json(
        { error: 'Failed to delete transcription from database' },
        { status: 500 }
      );
    }
    
    console.log('Successfully deleted transcription from Supabase');
    
    // Note: AssemblyAI doesn't provide a way to delete transcriptions via API
    // So we're just deleting from our database
    
    return NextResponse.json({
      message: 'Transcription deleted successfully'
    });
  } catch (error: any) {
    console.error('Error in transcription deletion API route:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred during deletion' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const transcriptId = url.searchParams.get('id');
    const audioUrl = url.searchParams.get('audioUrl');
    
    // If audioUrl is provided, try to find the transcription ID from Supabase
    if (audioUrl && !transcriptId) {
      // Look up the transcription in Supabase by audio URL
      const { data, error } = await supabase
        .from('meeting_transcriptions')
        .select('transcription_id')
        .eq('audio_url', audioUrl)
        .single();
      
      if (error) {
        console.log('No existing transcription found for URL:', audioUrl);
        return NextResponse.json({ message: 'No transcription found' }, { status: 404 });
      }
      
      if (data && data.transcription_id) {
        return NextResponse.json({ 
          transcriptionId: data.transcription_id,
          message: 'Existing transcription found'
        });
      }
      
      return NextResponse.json({ message: 'No transcription found' }, { status: 404 });
    }
    
    if (!transcriptId) {
      return NextResponse.json(
        { error: 'Transcript ID is required' },
        { status: 400 }
      );
    }
    
    if (!API_KEY) {
      console.error('AssemblyAI API key is missing');
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }
    
    console.log(`Fetching transcription status for ID: ${transcriptId} with summarization enabled`);
    
    // Get transcription status from AssemblyAI with only compatible features enabled
    const response = await fetch(`${API_BASE_URL}/transcript/${transcriptId}?summarization=true&entity_detection=true&speaker_labels=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });
    
    console.log(`Fetching transcription status for ID: ${transcriptId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('AssemblyAI API error:', errorData);
      return NextResponse.json(
        { error: `AssemblyAI API error: ${errorData.error || response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in transcribe status API route:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
