'use client';

export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  public onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  public onstart: (() => void) | null = null;
  public onend: (() => void) | null = null;
  public onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;

  constructor() {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (this.onresult) {
          this.onresult(event);
        }
      };

      this.recognition.onstart = () => {
        if (this.onstart) {
          this.onstart();
        }
      };

      this.recognition.onend = () => {
        if (this.onend) {
          this.onend();
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (this.onerror) {
          this.onerror(event);
        }
      };
    } else {
      console.warn('SpeechRecognition API is not supported in this browser.');
    }
  }

  public start(): void {
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
      }
    }
  }

  public stop(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  public abort(): void {
    if (this.recognition) {
      this.recognition.abort();
    }
  }
}

// Define the SpeechRecognition and webkitSpeechRecognition interfaces
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList extends Array<SpeechRecognitionResult> {
  item(index: number): SpeechRecognitionResult;
}

interface SpeechRecognitionResult extends Array<SpeechRecognitionAlternative> {
  isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  confidence: number;
  transcript: string;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: SpeechRecognitionErrorCode;
  readonly message?: string;
}

type SpeechRecognitionErrorCode =
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported';

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}
