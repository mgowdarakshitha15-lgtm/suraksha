export type SeverityLevel = 'None' | 'Low' | 'Moderate' | 'Medium' | 'High' | 'Critical';

export type DetectionResult =
  | 'Harmful Content Detected'
  | 'Potentially Harmful / Borderline'
  | 'Safe / Friendly Context';

export type AssistantMode = 'standard' | 'victim' | 'bystander';

export type ThemeVariant = 'dark' | 'white';

export type ResponseLanguage = 'kn' | 'kanglish' | 'en';

export type DetectedInputType =
  | 'Kannada'
  | 'Kanglish'
  | 'English'
  | 'Mixed Kannada-English';

export interface VoiceTranscriptionMeta {
  rawTranscription: string;
  normalizedText: string;
  detectedInputType: DetectedInputType;
  kannadaRepresentation?: string;
  confidence: 'high' | 'medium' | 'low';
  isUnclear?: boolean;
  lowConfidenceMessage?: string;
}

export type OrbState = 'idle' | 'listening' | 'thinking' | 'responding' | 'speaking';

export interface SafeResponseStyles {
  calm: string;
  assertive: string;
  disengage: string;
}

export interface PatternTimelineEvent {
  stage: string;
  detail: string;
}

export interface SafetyAnalysis {
  detectionResult: DetectionResult | string;
  isHarmful: boolean;
  categories: string[];
  severity: SeverityLevel;
  detectedLanguage: string;
  safetyScore?: number;
  riskCategory?: string;
  scoreFactors?: string[];
  highlightedPhrases?: string[];
  patternTimeline?: PatternTimelineEvent[];
  extractedText?: string;
  explanation: string;
  contextualReasoning: string;
  safeResponseStyles?: SafeResponseStyles;
  suggestedSafeResponses: string[];
  recommendedSafetyActions: string[];
}

export interface ChatImageAttachment {
  name: string;
  mimeType: string;
  dataUrl: string;
  base64Data: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  image?: {
    name: string;
    mimeType: string;
    dataUrl: string;
  };
  responseLanguage?: ResponseLanguage;
  voiceMetadata?: VoiceTranscriptionMeta;
  hasAnalysis?: boolean;
  analysis?: SafetyAnalysis;
  followUpPrompts?: string[];
  isError?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface AppSettings {
  assistantMode: AssistantMode;
  themeVariant: ThemeVariant;
  autoSpeakResponses: boolean;
  maskPersonalInfo: boolean;
  saveHistoryLocally: boolean;
}
