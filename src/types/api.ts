export interface Language {
  code: string;
  name: string;
  native_name: string;
}

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender: string;
  age: string;
  description: string;
}

export interface TranslationRequest {
  text: string;
  source_language: string;
  target_language: string;
}

export interface TranslationResult {
  translated_text: string;
  source_language: string;
  target_language: string;
  confidence: number;
}

export interface BatchTranslationRequest {
  text: string;
  source_language: string;
  target_languages: string[];
}

export interface BatchTranslationResult {
  translations: Record<string, TranslationResult>;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
  duration: number;
}

export interface SynthesisRequest {
  text: string;
  language: string;
  voice: string;
  speed?: number;
  pitch?: number;
  volume?: number;
}

export interface WebSocketMessage {
  type: 'audio_chunk' | 'config' | 'stop';
  data?: string;
}

export interface WebSocketResponse {
  type: 'connected' | 'partial_transcript' | 'final_transcript' | 'error';
  data: any;
}

export interface APIError {
  error: string;
  status_code: number;
  timestamp: string;
}

export interface ServiceHealth {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}