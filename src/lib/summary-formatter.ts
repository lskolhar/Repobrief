/**
 * Utility functions to format meeting summaries for better readability
 */

/**
 * Formats a meeting summary into a more structured and readable format
 * @param summaryText The original summary text from AssemblyAI
 * @param fileName Optional filename to help with title generation
 * @param utterances Optional utterances from the transcription for speaker analysis
 * @returns Formatted summary with key points extracted
 */
export function formatMeetingSummary(summaryText: string, fileName?: string, utterances?: { speaker: string; text: string; start: number; end: number }[]): {
  keyPoints: string[];
  mainSummary: string;
  meetingTitle: string;
  duration: string;
  transcript?: string;
  speakerSummaries?: { speaker: string; summary: string }[];
  actionItems?: string[];
  decisions?: string[];
  participants?: string[];
} {
  let speakerSummaries: { speaker: string; summary: string }[] = [];

  if (utterances && Array.isArray(utterances) && utterances.length > 0) {
    const speakerMap: { [speaker: string]: string[] } = {};
    for (const u of utterances) {
      if (u && typeof u.speaker === 'string' && typeof u.text === 'string') {
        // Create the array if it doesn't exist
        if (!speakerMap[u.speaker]) {
          speakerMap[u.speaker] = [];
        }
        
        // Get a reference to the array
        const speakerTexts = speakerMap[u.speaker];
        
        // Only push if it's a valid array
        if (speakerTexts && Array.isArray(speakerTexts)) {
          speakerTexts.push(u.text);
        }
      }
    }
    
    // Create speaker summaries with a safer approach
    speakerSummaries = [];
    for (const speaker of Object.keys(speakerMap)) {
      const texts = speakerMap[speaker];
      if (texts && Array.isArray(texts)) {
        speakerSummaries.push({
          speaker,
          summary: texts.join(' ')
        });
      } else {
        speakerSummaries.push({
          speaker,
          summary: ''
        });
      }
    }
  }

  if (!summaryText) {
    return {
      keyPoints: [],
      mainSummary: "No summary available",
      meetingTitle: "Untitled Meeting",
      duration: "Unknown duration",
      transcript: "",
      speakerSummaries
    };
  }

  // Clean the summary text - sometimes AI transcriptions include artifacts
  summaryText = summaryText
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/\n+/g, '. ')          // Convert newlines to periods
    .replace(/\.\s*\./g, '.')       // Remove duplicate periods
    .replace(/\s+\./g, '.')         // Clean up spaces before periods
    .replace(/\.([a-zA-Z])/g, '. $1'); // Ensure space after periods

  // Break the summary into sentences
  const sentences = summaryText.match(/[^.!?]+[.!?]+/g) || [];
  const cleanedSentences = sentences.map(s => s.trim()).filter(s => s.length > 10);
  
  // Extract key points using more sophisticated approach
  // Prioritize sentences with important-sounding beginnings or keywords
  const keyPointIndicators = [
    /^(key point|importantly|significantly|notably|primarily|essentially|fundamentally)/i,
    /\b(main|primary|critical|essential|key|crucial|important|significant)\s+(point|topic|issue|concern|focus|aspect)\b/i,
    /\b(highlight|emphasized|stressed|pointed out|noted|mentioned)\b/i
  ];

  // Score sentences for key point potential
  const scoredSentences = cleanedSentences.map(sentence => {
    let score = 0;
    
    // Ideal length for key points (not too short, not too long)
    if (sentence.length > 30 && sentence.length < 150) score += 2;
    
    // Presence of key indicators
    keyPointIndicators.forEach(regex => {
      if (regex.test(sentence)) score += 3;
    });
    
    // Good length of words (more substantial)
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount >= 5 && wordCount <= 20) score += 2;
    
    // Avoid filler sentences
    if (!/^(however|moreover|furthermore|in addition|additionally|also|too|as well)/i.test(sentence)) {
      score += 1;
    }
    
    return { sentence, score };
  });
  
  // Sort by score and take the top ones
  const keyPoints = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(item => item.sentence);
  
  // If we don't have enough key points, add some from the beginning of the text
  if (keyPoints.length < 3 && cleanedSentences.length > 3) {
    const additionalPoints = cleanedSentences
      .filter(sentence => !keyPoints.includes(sentence))
      .slice(0, 5 - keyPoints.length);
    
    keyPoints.push(...additionalPoints);
  }

  // Improved meeting title extraction
  let meetingTitle = "Meeting Summary";
  
  // First try to generate a title from the filename if provided
  if (fileName && typeof fileName === 'string') {
    try {
      // Remove file extension and replace underscores/hyphens with spaces
      const cleanFileName = fileName.replace(/\.(mp3|wav|m4a|ogg)$/i, '')
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
        
      // If the filename looks meaningful (not just a timestamp), use it as a base for the title
      if (cleanFileName && !/^\d+$/.test(cleanFileName) && cleanFileName.length > 3) {
        meetingTitle = `Meeting: ${cleanFileName}`;
      }
    } catch (error) {
      console.error('Error processing filename for meeting title:', error);
      // Continue with default title if there's an error processing the filename
    }
  }
  
  // If we couldn't get a good title from the filename, try to extract it from the summary
  if (meetingTitle === "Meeting Summary") {
    // Look for explicit title patterns
    const titlePatterns = [
      /\b(meeting|discussion|call|session|conference)\s+(about|on|regarding|concerning|for|to discuss)\s+([^.!?]+)/i,
      /\b(the|this)\s+(meeting|discussion|call|session|conference)\s+(was|is)\s+(about|on|regarding|concerning)\s+([^.!?]+)/i,
      /\b(topic|subject|focus|agenda|purpose)\s+(of|for)\s+(the|this)\s+(meeting|discussion|call|session|conference)\s+(was|is)\s+([^.!?]+)/i
    ];
    
    // Try to find an explicit title using patterns
    for (const pattern of titlePatterns) {
      const match = summaryText.match(pattern);
      if (match && match.length > 0) {
        // Extract the relevant capture group based on the pattern
        const titlePart = match[match.length - 1];
        if (titlePart && titlePart.trim().length > 3 && titlePart.trim().length < 100) {
          meetingTitle = titlePart.trim().replace(/\.$/,''); // Remove trailing period if present
          break;
        }
      }
    }
    
    // If no explicit title found, use the first sentence if it's not too long
    if (meetingTitle === "Meeting Summary" && cleanedSentences.length > 0) {
      const firstSentence = cleanedSentences[0] || '';
      if (firstSentence.length < 100 && firstSentence.length > 10) {
        meetingTitle = firstSentence.replace(/^(this|the) meeting (was|is) about/i, '').trim();
      }
    }
  }
  
  // Ensure the title isn't too long
  if (meetingTitle.length > 60) {
    meetingTitle = meetingTitle.substring(0, 60) + '...';
  }

  // Improved duration detection
  const durationRegexes = [
    /\b(meeting|call|discussion|session)\s+(lasted|took|ran for|continued for)\s+([^.!?]*?(hour|minute|min|hr)s?)\b/gi,
    /\b(duration|length|time)\s+(of|for)\s+(the|this)\s+(meeting|call|discussion|session)\s+(was|is)\s+([^.!?]*?(hour|minute|min|hr)s?)\b/gi,
    /\b(lasted|duration|for|took)\s+([\w\s]+)\s+(hour|minute|min|hr)s?\b/gi
  ];
  
  let duration = "Duration not specified";
  
  for (const regex of durationRegexes) {
    const match = summaryText.match(regex);
    if (match && match.length > 0) {
      duration = match[0].trim();
      break;
    }
  }

  // Select the best items for key points
  const bestKeyPoints = keyPoints.slice(0, 5); // Up to 5 key points

  return {
    keyPoints: bestKeyPoints,
    mainSummary: summaryText,
    meetingTitle,
    duration,
    transcript: summaryText,
    speakerSummaries
  };
}
