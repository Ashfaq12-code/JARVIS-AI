export type VoiceState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "EXECUTING"
  | "SPEAKING"
  | "CONFIRMATION_REQUIRED"
  | "ERROR";

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

export type SpeechRecognitionErrorEventLike = {
  error: string;
  message: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionResultListLike = ArrayLike<SpeechRecognitionResultLike>;

export type SpeechRecognitionEventData = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export async function requestMicrophoneAccess(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is unavailable in this browser.");
  }

  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export function speakJarvisResponse(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const message = text.trim();

    if (!message) {
      resolve();
      return;
    }

    if (typeof window === "undefined" || !window.speechSynthesis) {
      reject(new Error("Speech synthesis is unavailable in this browser."));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(message);
    const preferredVoice = window.speechSynthesis
      .getVoices()
      .find((voice) =>
        /en[-_]GB|en[-_]US/i.test(voice.lang) &&
        /David|Mark|George|James|Daniel|Ryan|Microsoft.*Male|Google UK English Male/i.test(voice.name)
      );
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.rate = 0.96;
    utterance.pitch = 0.84;
    utterance.volume = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("JARVIS speech output failed."));

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}