import { useState, useEffect, useCallback } from 'react';
import {
  Language,
  Voice,
  TranslationRequest,
  TranslationResult,
  BatchTranslationRequest,
  BatchTranslationResult,
  TranscriptionResult,
  SynthesisRequest,
  ServiceHealth,
  APIError
} from '../types/api';

// API Configuration
const API_CONFIG = {
  translation: import.meta.env.VITE_TRANSLATION_API_URL || 'http://localhost:8001',
  stt: import.meta.env.VITE_STT_API_URL || 'http://localhost:8002',
  tts: import.meta.env.VITE_TTS_API_URL || 'http://localhost:8003',
};

export const useCreoleAPI = () => {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generic API call function
  const apiCall = useCallback(async <T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> => {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData: APIError = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
          status_code: response.status,
          timestamp: new Date().toISOString()
        }));
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('API call failed:', err);
      throw err;
    }
  }, []);

  // Check service health
  const checkServiceHealth = useCallback(async () => {
    try {
      const [translationHealth, sttHealth, ttsHealth] = await Promise.allSettled([
        apiCall<ServiceHealth>(`${API_CONFIG.translation}/health`),
        apiCall<ServiceHealth>(`${API_CONFIG.stt}/health`),
        apiCall<ServiceHealth>(`${API_CONFIG.tts}/health`)
      ]);

      const allHealthy = [translationHealth, sttHealth, ttsHealth].every(
        result => result.status === 'fulfilled' && result.value.status === 'healthy'
      );

      setIsConnected(allHealthy);
      setError(allHealthy ? null : 'Some services are unavailable');
    } catch (err) {
      setIsConnected(false);
      setError('Unable to connect to services');
    }
  }, [apiCall]);

  // Load languages and voices
  const loadLanguagesAndVoices = useCallback(async () => {
    try {
      const [languagesRes, voicesRes] = await Promise.all([
        apiCall<{ supported_languages: Language[] }>(`${API_CONFIG.translation}/api/v1/languages`),
        apiCall<{ voices: Voice[] }>(`${API_CONFIG.tts}/api/v1/voices`)
      ]);

      setLanguages(languagesRes.supported_languages);
      setVoices(voicesRes.voices);
    } catch (err) {
      console.error('Failed to load languages and voices:', err);
      setError('Failed to load languages and voices');
    }
  }, [apiCall]);

  // Translation functions
  const translateText = useCallback(async (
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationResult> => {
    const request: TranslationRequest = {
      text,
      source_language: sourceLanguage,
      target_language: targetLanguage
    };

    return apiCall<TranslationResult>(`${API_CONFIG.translation}/api/v1/translate`, {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }, [apiCall]);

  const translateTextBatch = useCallback(async (
    text: string,
    sourceLanguage: string,
    targetLanguages: string[]
  ): Promise<BatchTranslationResult> => {
    const request: BatchTranslationRequest = {
      text,
      source_language: sourceLanguage,
      target_languages: targetLanguages
    };

    return apiCall<BatchTranslationResult>(`${API_CONFIG.translation}/api/v1/translate/batch`, {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }, [apiCall]);

  // Speech-to-Text functions
  const transcribeAudio = useCallback(async (
    audioFile: File,
    language: string = 'auto'
  ): Promise<TranscriptionResult> => {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('language', language);

    const response = await fetch(`${API_CONFIG.stt}/api/v1/transcribe`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData: APIError = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
        status_code: response.status,
        timestamp: new Date().toISOString()
      }));
      throw new Error(errorData.error || `Transcription failed: ${response.status}`);
    }

    return await response.json();
  }, []);

  const detectLanguage = useCallback(async (audioFile: File): Promise<{ detected_language: string; confidence: number }> => {
    const formData = new FormData();
    formData.append('file', audioFile);

    const response = await fetch(`${API_CONFIG.stt}/api/v1/detect-language`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Language detection failed: ${response.status}`);
    }

    return await response.json();
  }, []);

  // Text-to-Speech functions
  const synthesizeText = useCallback(async (
    text: string,
    language: string = 'ht',
    voice: string = 'default',
    options: Partial<SynthesisRequest> = {}
  ): Promise<Blob> => {
    const request: SynthesisRequest = {
      text,
      language,
      voice,
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0,
      ...options
    };

    const response = await fetch(`${API_CONFIG.tts}/api/v1/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData: APIError = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
        status_code: response.status,
        timestamp: new Date().toISOString()
      }));
      throw new Error(errorData.error || `Speech synthesis failed: ${response.status}`);
    }

    return await response.blob();
  }, []);

  const previewVoice = useCallback(async (
    voiceId: string,
    language: string = 'ht',
    sampleText: string = 'Bonjou, koman ou ye?'
  ): Promise<Blob> => {
    const response = await fetch(`${API_CONFIG.tts}/api/v1/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voice_id: voiceId,
        language,
        text: sampleText
      })
    });

    if (!response.ok) {
      throw new Error(`Voice preview failed: ${response.status}`);
    }

    return await response.blob();
  }, []);

  // Initialize on mount
  useEffect(() => {
    checkServiceHealth();
    loadLanguagesAndVoices();

    // Set up periodic health checks
    const healthCheckInterval = setInterval(checkServiceHealth, 30000);

    return () => {
      clearInterval(healthCheckInterval);
    };
  }, [checkServiceHealth, loadLanguagesAndVoices]);

  return {
    // Data
    languages,
    voices,
    isConnected,
    error,
    
    // Translation functions
    translateText,
    translateTextBatch,
    
    // Speech-to-Text functions
    transcribeAudio,
    detectLanguage,
    
    // Text-to-Speech functions
    synthesizeText,
    previewVoice,
    
    // Utility functions
    checkServiceHealth,
    loadLanguagesAndVoices
  };
};