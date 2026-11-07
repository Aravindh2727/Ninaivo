/**
 * Speech-to-Text Transcription Service
 * Supports:
 * - Tamil (ta-IN)
 * - English (en-IN)
 * - Browser Web Speech API SpeechRecognition
 * - Live transcription during recording
 * - Post-recording on-demand transcription
 * - Graceful fallback to manual transcript editing when recognition is unsupported or offline
 */

export const TRANSCRIPTION_LANGUAGES = [
  { code: 'ta-IN', label: 'தமிழ் (Tamil)', short: 'தமிழ்' },
  { code: 'en-IN', label: 'English (India)', short: 'EN' }
];

/**
 * Check if the browser supports Web Speech API SpeechRecognition
 */
export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Creates and initializes a speech recognition session
 */
export function createSpeechRecognizer({
  language = 'ta-IN',
  onTranscript,
  onError,
  onEnd
}) {
  if (!isSpeechRecognitionSupported()) {
    return {
      isSupported: false,
      start: () => {
        onError && onError({
          type: 'unsupported',
          message: 'Speech recognition is not supported in this browser. You can type your transcript manually.'
        });
      },
      stop: () => {},
      abort: () => {}
    };
  }

  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognizer = new SpeechRecognitionClass();

  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.lang = language;
  recognizer.maxAlternatives = 1;

  let finalTranscript = '';
  let isRunning = false;

  recognizer.onresult = (event) => {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcriptSegment = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += (finalTranscript ? ' ' : '') + transcriptSegment.trim();
      } else {
        interimTranscript += transcriptSegment;
      }
    }

    const fullText = (finalTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
    if (onTranscript) {
      onTranscript(fullText, { final: finalTranscript, interim: interimTranscript });
    }
  };

  recognizer.onerror = (event) => {
    console.warn('SpeechRecognition error:', event.error);
    let userMessage = 'Transcription error occurred.';
    if (event.error === 'not-allowed') {
      userMessage = 'Microphone permission denied for speech recognition.';
    } else if (event.error === 'no-speech') {
      userMessage = 'No speech was detected. Please try speaking closer to the microphone.';
    } else if (event.error === 'network') {
      userMessage = 'Network connection needed for speech recognition. You can type your transcript manually.';
    }
    if (onError) {
      onError({ type: event.error, message: userMessage });
    }
  };

  recognizer.onend = () => {
    isRunning = false;
    if (onEnd) onEnd(finalTranscript);
  };

  return {
    isSupported: true,
    start: () => {
      try {
        if (!isRunning) {
          recognizer.start();
          isRunning = true;
        }
      } catch (err) {
        console.warn('Could not start recognition:', err.message);
      }
    },
    stop: () => {
      try {
        if (isRunning) {
          recognizer.stop();
          isRunning = false;
        }
      } catch (err) {
        // ignore
      }
    },
    abort: () => {
      try {
        recognizer.abort();
        isRunning = false;
      } catch (err) {
        // ignore
      }
    },
    getFinalTranscript: () => finalTranscript,
    setLanguage: (lang) => {
      recognizer.lang = lang;
    }
  };
}

