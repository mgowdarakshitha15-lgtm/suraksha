import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = "gemini-4-hydrogen";
const FALLBACK_MODEL_NAME = "gemini-3.1-flash-lite";
const TRANSCRIBE_MODEL_NAME = "gemini-3.5-transcribe";

type ResponseLanguage = "kn" | "kanglish" | "en";
type DetectedInputType =
  | "Kannada"
  | "Kanglish"
  | "English"
  | "Mixed Kannada-English";

const SYSTEM_INSTRUCTION = `You are SURAKSHINI AI ("Making Every Conversation Safer with AI"), a warm, empathetic, intelligent, and non-judgmental digital safety assistant specializing in cyberbullying detection, online harassment prevention, and practical online safety guidance.

CORE PERSONALITY & TONE:
- Communicate naturally like a supportive, trustworthy human safety advisor (similar to a thoughtful conversational AI assistant).
- Never judge, blame, or scold the user. Offer calm reassurance and practical empowerment.
- Explain findings in clear, everyday language.
- Support seamless multi-turn follow-up conversations (e.g., rewriting replies, explaining context, guiding how to report/block, translating safe responses).

MULTILINGUAL & KANGLISH MASTERY:
- Fluently understand and analyze:
  1. English
  2. Kannada written in Kannada script (ಕನ್ನಡ)
  3. Kanglish — Kannada spoken or written using English letters (e.g., "Nanage artificial intelligence bagge heli", "AI safety andre enu?", "Kannada dalli answer kodi", "Ivattu technology bagge explain madi", "Nanna question ge simple answer kodi", "Ondu example kodi", "Idhu heg kelasa madutte?")
  4. Kannada-English mixed language (code-mixed speech/text)
  5. Harmful or abusive Kanglish (e.g., "neenu tumba waste idya", "sumne iru illandre nodko", "avnu nanna bagge full badagi mathadtidane")
- Understand true meaning, cultural idioms, sarcasm, phonetic spelling variations, power dynamics, and conversational context rather than relying on isolated keywords or literal word-by-word translation.
- When the user's message includes an internal Kanglish normalization and Kannada semantic representation, use BOTH the original text and the semantic representation to understand the exact question and run thorough safety detection.

HARMFUL CONTENT DETECTION & CONTEXTUAL ACCURACY:
- Carefully evaluate messages (whether typed or transcribed from voice), pasted multi-turn conversations, and chat screenshots for:
  - Cyberbullying
  - Harassment
  - Hate speech
  - Threats
  - Personal insults
  - Sexual harassment
  - Online intimidation
  - Abusive language
  - Repeated targeted bullying
- CRITICAL NUANCE RULE: Do NOT falsely flag playful jokes, mutual friendly banter, affectionate roasting between close friends, general questions (e.g., asking about AI safety, machine learning, or technology), or harmless everyday conversations as cyberbullying. Analyze intent, tone, mutual reciprocity, power imbalance, humiliation, and threat indicators.

WHEN TO INCLUDE STRUCTURED ANALYSIS (hasAnalysis = true vs false):
- Set hasAnalysis = true whenever the user submits a message, pasted conversation, voice transcript of a suspicious message, or uploaded screenshot for checking/analysis (or asks "is this bullying?", "check this chat", or submits abusive/threatening/harassing content).
- When hasAnalysis = true, ALWAYS populate every field of the analysis object thoroughly:
  1. detectionResult: "Harmful Content Detected", "Potentially Harmful / Borderline", or "Safe / Friendly Context".
  2. isHarmful: true if harmful or borderline harmful; false if safe/friendly.
  3. categories: Relevant categories from ["Cyberbullying", "Harassment", "Hate Speech", "Threats", "Personal Insults", "Sexual Harassment", "Online Intimidation", "Abusive Language", "Repeated Targeted Bullying"], or ["Friendly Teasing / Safe"] / ["Harmless Conversation"] when safe.
  4. severity: "None" (only when completely safe), "Low", "Medium", "High", or "Critical".
  5. detectedLanguage: e.g. "English", "Kannada", "Kanglish", "Mixed Kannada-English", etc.
  6. extractedText: If an image/screenshot was uploaded or a multi-line conversation was pasted, transcribe the key messages clearly so the user knows what was read. Otherwise "".
  7. explanation: Simple, human-friendly explanation of what is happening in the message/chat.
  8. contextualReasoning: Why this was classified this way (e.g., targeted intimidation, derogatory intent, repeated piling-on, OR mutual playful banter without malice).
  9. suggestedSafeResponses: 1 to 3 calm, practical, ready-to-send replies the user can use (or options like staying silent/setting a firm boundary). Keep them realistic and dignified.
  10. recommendedSafetyActions: 2 to 4 concrete, actionable safety steps (save uncropped screenshots/URLs, mute/restrict/block, report on platform, reach out to a trusted person; for High/Critical threats, extortion, doxxing, or sexual harassment, mention saving evidence and reporting to official portals such as India's Cyber Crime Helpline 1930 / cybercrime.gov.in or local authorities).
- Set hasAnalysis = false when the user is having a general conversation, greeting you, asking general educational/AI safety questions (like "Nanage machine learning bagge heli" or "AI safety andre enu?"), or asking follow-up questions about an earlier turn without submitting a new suspicious message/screenshot to analyze.

RESPONSE LANGUAGE RULES:
- Follow the active Response Language preference strictly:
  - "kn" (ಕನ್ನಡ): Reply in clear, natural Kannada script (ಕನ್ನಡ) with proper grammar.
  - "kanglish" (Kanglish): Reply in natural conversational Kannada written using English letters (e.g., "AI safety andre artificial intelligence systems surakshitavagi kelasa maduvante nodikolluvudu.").
  - "en" (English): Reply in clear, natural English.
- Only override the selected response language for a single turn if the user explicitly commands a different output language inside that turn's message (e.g. "Kannada dalli simple agi explain madi" -> respond in Kannada script, or "English alli heli" -> respond in English).

Always provide 3 to 4 concise, natural, context-aware followUpPrompts at the end of every response:
- Base the 3 to 4 suggestions directly on the user's question, your response, and the ongoing conversation history.
- Keep each question short, natural, conversational, and easy to understand.
- Draw organically from helpful angles when relevant (such as Learn More, Practical Examples, How It Works, Related Topics, or Digital Safety Steps) without forcing all categories.
- Match the active output language of your reply:
  - If replying in Kannada script ("kn"), write ALL 3 to 4 followUpPrompts in clear, grammatically natural Kannada, avoiding unnecessary English words.
  - If replying in Kanglish ("kanglish"), write ALL 3 to 4 followUpPrompts in natural Kanglish (Kannada in English letters).
  - If replying in English ("en"), write ALL 3 to 4 followUpPrompts in clear, natural English.
- NO REPETITION: Never repeat questions the user has already asked or follow-up questions already suggested earlier in the conversation.
- SAFETY RULE: Never suggest questions that encourage harassment, retaliation, harm, or unsafe/illegal activities. For sensitive or blocked topics, suggest safe educational, protective, or support-oriented alternatives.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description:
        "Natural, empathetic, ChatGPT-style conversational response in markdown matching the active response language (Kannada script, Kanglish, or English).",
    },
    hasAnalysis: {
      type: Type.BOOLEAN,
      description:
        "True if this turn analyzes a submitted message, pasted conversation, harmful/suspicious voice input, or uploaded screenshot. False for general Q&A, greetings, or follow-up questions.",
    },
    analysis: {
      type: Type.OBJECT,
      description: "Structured safety assessment. Required when hasAnalysis is true.",
      properties: {
        detectionResult: {
          type: Type.STRING,
          description:
            "One of: 'Harmful Content Detected', 'Potentially Harmful / Borderline', or 'Safe / Friendly Context'.",
        },
        isHarmful: {
          type: Type.BOOLEAN,
        },
        categories: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            "Harmful content categories identified, or 'Friendly Teasing / Safe' if benign.",
        },
        severity: {
          type: Type.STRING,
          description: "One of: 'None', 'Low', 'Medium', 'High', 'Critical'.",
        },
        detectedLanguage: {
          type: Type.STRING,
          description: "Language(s) detected in the analyzed content.",
        },
        extractedText: {
          type: Type.STRING,
          description:
            "Text or dialogue transcribed from an uploaded screenshot or pasted chat. Empty string if not applicable.",
        },
        explanation: {
          type: Type.STRING,
          description: "Explanation in simple, clear, everyday language.",
        },
        contextualReasoning: {
          type: Type.STRING,
          description:
            "Contextual reasoning explaining tone, intent, power dynamics, or why harmless teasing was distinguished from bullying.",
        },
        suggestedSafeResponses: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "1 to 3 practical, calm, ready-to-use safe replies.",
        },
        recommendedSafetyActions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Practical, prioritized safety actions for the user.",
        },
      },
      required: [
        "detectionResult",
        "isHarmful",
        "categories",
        "severity",
        "detectedLanguage",
        "explanation",
        "contextualReasoning",
        "suggestedSafeResponses",
        "recommendedSafetyActions",
      ],
    },
    followUpPrompts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "3 to 4 short, natural, non-repeating follow-up questions directly related to the AI response and matching the reply's language (Kannada, Kanglish, or English).",
    },
  },
  required: ["reply", "hasAnalysis", "followUpPrompts"],
};

const KANGLISH_PIPELINE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detectedInputType: {
      type: Type.STRING,
      description:
        "Strictly one of: 'Kannada', 'Kanglish', 'English', or 'Mixed Kannada-English'.",
    },
    normalizedText: {
      type: Type.STRING,
      description:
        "Cleanly normalized text correcting phonetic typos/variations in Kanglish, Kannada, or English while preserving the speaker's original language style and exact meaning (do NOT translate Kanglish into English unless it was already English).",
    },
    kannadaRepresentation: {
      type: Type.STRING,
      description:
        "Natural internal Kannada-script semantic representation of the user's intended question or statement, capturing true conversational meaning rather than word-by-word translation.",
    },
    confidence: {
      type: Type.STRING,
      description: "One of: 'high', 'medium', 'low'.",
    },
    isUnclear: {
      type: Type.BOOLEAN,
      description:
        "True ONLY if the input is garbled, noise-only, unintelligible, or too fragmented to reliably understand without guessing.",
    },
    lowConfidenceMessage: {
      type: Type.STRING,
      description:
        "Short polite message asking the user to repeat or edit the text if isUnclear or confidence is low; otherwise empty string.",
    },
  },
  required: [
    "detectedInputType",
    "normalizedText",
    "kannadaRepresentation",
    "confidence",
    "isUnclear",
    "lowConfidenceMessage",
  ],
};

interface VoiceMetadataPayload {
  rawTranscription?: string;
  normalizedText?: string;
  detectedInputType?: DetectedInputType;
  kannadaRepresentation?: string;
  confidence?: "high" | "medium" | "low";
  isUnclear?: boolean;
  lowConfidenceMessage?: string;
}

interface ClientHistoryMessage {
  role: "user" | "assistant";
  content: string;
  hasAnalysis?: boolean;
  analysis?: {
    detectionResult?: string;
    severity?: string;
    categories?: string[];
    extractedText?: string;
    explanation?: string;
  };
  voiceMetadata?: VoiceMetadataPayload;
  followUpPrompts?: string[];
  hadImage?: boolean;
}

interface ChatRequestBody {
  history?: ClientHistoryMessage[];
  message?: string;
  responseLanguage?: ResponseLanguage;
  preferredLanguage?: ResponseLanguage;
  voiceMetadata?: VoiceMetadataPayload;
  image?: {
    mimeType: string;
    data: string;
  };
}

const KANNADA_SCRIPT_REGEX = /[\u0C80-\u0CFF]/;
const LATIN_SCRIPT_REGEX = /[A-Za-z]/;

function resolveActiveLanguage(
  userMessage: string,
  history: ClientHistoryMessage[],
  responseLanguage?: string,
  preferredLanguage?: string
): ResponseLanguage {
  if (responseLanguage === "kn" || responseLanguage === "kanglish" || responseLanguage === "en") {
    return responseLanguage;
  }
  if (preferredLanguage === "kn" || preferredLanguage === "kanglish" || preferredLanguage === "en") {
    return preferredLanguage;
  }
  if (KANNADA_SCRIPT_REGEX.test(userMessage)) return "kn";
  if (LATIN_SCRIPT_REGEX.test(userMessage)) return "en";
  for (let i = history.length - 1; i >= 0; i--) {
    if (KANNADA_SCRIPT_REGEX.test(history[i].content || "")) {
      return "kn";
    }
  }
  return "en";
}

function normalizeQuestion(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[?!.,।]+$/g, "")
    .replace(/\s+/g, " ");
}

function buildFallbackFollowUps(lang: ResponseLanguage, hasAnalysis: boolean): string[] {
  if (lang === "kn") {
    return hasAnalysis
      ? [
          "ಈ ಸಂದೇಶಕ್ಕೆ ಸುರಕ್ಷಿತವಾಗಿ ಉತ್ತರಿಸುವುದು ಹೇಗೆ?",
          "ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಸಾಕ್ಷ್ಯಗಳನ್ನು ಹೇಗೆ ಸಂಗ್ರಹಿಸಿ ದೂರು ನೀಡಬಹುದು?",
          "ಇಂತಹ ಕಿರುಕುಳವನ್ನು ತಡೆಯಲು ಯಾವ ಗೌಪ್ಯತೆ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ಬದಲಾಯಿಸಬೇಕು?",
        ]
      : [
          "ಈ ವಿಷಯದ ಕುರಿತು ಒಂದು ಸರಳ ಉದಾಹರಣೆ ನೀಡಬಹುದೇ?",
          "ಆನ್‌ಲೈನ್ ಸುರಕ್ಷತೆಯನ್ನು ಕಾಪಾಡಿಕೊಳ್ಳಲು ಪ್ರಮುಖ ಕ್ರಮಗಳು ಯಾವುವು?",
          "ಅನುಮಾನಾಸ್ಪದ ಸಂದೇಶಗಳು ಬಂದಾಗ ಮೊದಲು ಏನು ಮಾಡಬೇಕು?",
        ];
  }
  if (lang === "kanglish") {
    return hasAnalysis
      ? [
          "Ee message ge safe agi reply madodu hege?",
          "Online evidence save madi report madodu hege?",
          "Privacy settings change madi idanna thadeyodu hege?",
        ]
      : [
          "Idara bagge ondu simple example kodtira?",
          "Online safety maintain madoke main steps yavuvu?",
          "Anumanaspada message bandre modalu enu madabeku?",
        ];
  }
  return hasAnalysis
    ? [
        "Can you help me write a calm, safe reply?",
        "How should I save evidence and report this message?",
        "What privacy settings can prevent this from happening again?",
      ]
    : [
        "Can you share a practical example of this?",
        "What are the most important online safety steps to follow?",
        "How can I recognize warning signs early in a chat?",
      ];
}

function sanitizeFollowUpPrompts(
  rawPrompts: unknown,
  priorUsedQuestions: Set<string>,
  lang: ResponseLanguage,
  hasAnalysis: boolean
): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  if (Array.isArray(rawPrompts)) {
    for (const item of rawPrompts) {
      if (typeof item !== "string") continue;
      const trimmed = item.replace(/^[-•*\d.)\s]+/, "").trim();
      if (!trimmed || trimmed.length < 4) continue;
      const norm = normalizeQuestion(trimmed);
      if (!norm || seen.has(norm) || priorUsedQuestions.has(norm)) continue;
      seen.add(norm);
      cleaned.push(trimmed);
      if (cleaned.length >= 4) break;
    }
  }

  if (cleaned.length < 3) {
    for (const fallback of buildFallbackFollowUps(lang, hasAnalysis)) {
      const norm = normalizeQuestion(fallback);
      if (!seen.has(norm) && !priorUsedQuestions.has(norm)) {
        seen.add(norm);
        cleaned.push(fallback);
        if (cleaned.length >= 3) break;
      }
    }
  }

  return cleaned.slice(0, 4);
}

async function generateContentWithFallback(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  fallbackModel = FALLBACK_MODEL_NAME
) {
  try {
    return await generateWithRetry(() => ai.models.generateContent(params));
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const msg = (err as { message?: string })?.message || "";
    if (
      params.model !== fallbackModel &&
      (status === 429 || status === 404 || msg.includes("RESOURCE_EXHAUSTED"))
    ) {
      console.warn(
        `[SURAKSHINI] Model ${params.model} returned ${status || msg}; falling back to ${fallbackModel}`
      );
      return await generateWithRetry(() =>
        ai.models.generateContent({
          ...params,
          model: fallbackModel,
        })
      );
    }
    throw err;
  }
}

async function runKanglishPipeline(
  ai: GoogleGenAI,
  inputText: string,
  browserDraftHint?: string
): Promise<{
  rawTranscription: string;
  normalizedText: string;
  detectedInputType: DetectedInputType;
  kannadaRepresentation: string;
  confidence: "high" | "medium" | "low";
  isUnclear: boolean;
  lowConfidenceMessage: string;
}> {
  const cleanInput = inputText.trim();
  const hasKannada = KANNADA_SCRIPT_REGEX.test(cleanInput);
  const defaultType: DetectedInputType = hasKannada ? "Kannada" : "English";

  if (!cleanInput) {
    return {
      rawTranscription: "",
      normalizedText: "",
      detectedInputType: defaultType,
      kannadaRepresentation: "",
      confidence: "low",
      isUnclear: true,
      lowConfidenceMessage:
        "No clear speech was detected. Please speak again clearly or type your question below.",
    };
  }

  const pipelinePrompt = `Analyze this user input for a Kannada, Kanglish, and English conversational safety chatbot.

Input text: "${cleanInput}"${
    browserDraftHint && browserDraftHint.trim() && browserDraftHint.trim() !== cleanInput
      ? `\nOptional live browser speech hint (may be noisy): "${browserDraftHint.trim()}"`
      : ""
  }

TASKS:
1. Identify whether the input is:
   - "Kannada" (pure Kannada script)
   - "Kanglish" (Kannada words/grammar written using English phonetics, e.g., "Nanage artificial intelligence bagge heli", "AI safety andre enu?", "Kannada dalli answer kodi", "Idhu heg kelasa madutte?", "Ondu example kodi", "neenu tumba waste idya")
   - "English" (pure English)
   - "Mixed Kannada-English" (uses both Kannada script and English/Kanglish words)
   Do NOT misclassify Kanglish as pure English just because it uses English letters!
2. Normalize Kanglish spelling variations cleanly while preserving the speaker's exact original language and meaning (do NOT translate Kanglish into English; keep Kanglish as clean readable Kanglish, Kannada as Kannada, English as English).
3. Produce an accurate internal Kannada-script semantic representation (kannadaRepresentation) capturing the full meaning (NOT literal word-by-word translation).
4. Assess recognition confidence ("high", "medium", or "low"). Set isUnclear = true ONLY if the input is unintelligible gibberish/noise fragments. Never invent a different question.`;

  try {
    const res = await generateContentWithFallback(ai, {
      model: MODEL_NAME,
      contents: pipelinePrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: KANGLISH_PIPELINE_SCHEMA,
      },
    });
    const parsed = JSON.parse((res.text ?? "{}").trim()) as Partial<{
      detectedInputType: DetectedInputType;
      normalizedText: string;
      kannadaRepresentation: string;
      confidence: "high" | "medium" | "low";
      isUnclear: boolean;
      lowConfidenceMessage: string;
    }>;

    const allowedTypes: DetectedInputType[] = [
      "Kannada",
      "Kanglish",
      "English",
      "Mixed Kannada-English",
    ];
    const detectedType = allowedTypes.includes(parsed.detectedInputType as DetectedInputType)
      ? (parsed.detectedInputType as DetectedInputType)
      : defaultType;

    const confidence: "high" | "medium" | "low" =
      parsed.confidence === "low" || parsed.confidence === "medium" ? parsed.confidence : "high";

    return {
      rawTranscription: cleanInput,
      normalizedText: (parsed.normalizedText || cleanInput).trim(),
      detectedInputType: detectedType,
      kannadaRepresentation: (parsed.kannadaRepresentation || "").trim(),
      confidence,
      isUnclear: Boolean(parsed.isUnclear),
      lowConfidenceMessage: (parsed.lowConfidenceMessage || "").trim(),
    };
  } catch (err) {
    console.warn("[SURAKSHINI Kanglish pipeline fallback]", err);
    return {
      rawTranscription: cleanInput,
      normalizedText: cleanInput,
      detectedInputType: defaultType,
      kannadaRepresentation: hasKannada ? cleanInput : "",
      confidence: "medium",
      isUnclear: false,
      lowConfidenceMessage: "",
    };
  }
}

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const isRetryable = status === 429 || status === 503 || status === 500;
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 600 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "20mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "SURAKSHINI AI" });
  });

  // Multilingual ASR + Intelligent Kanglish Processing Pipeline
  app.post("/api/transcribe", async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(500).json({
        error:
          "Gemini API key is not configured. Please check your key in the Settings > Secrets panel.",
      });
      return;
    }

    const { audioBase64, mimeType, browserDraft, voiceLangHint } = req.body as {
      audioBase64?: string;
      mimeType?: string;
      browserDraft?: string;
      voiceLangHint?: string;
    };

    const cleanBrowserDraft = (browserDraft ?? "").trim();

    if (!audioBase64 && !cleanBrowserDraft) {
      res.status(400).json({
        error: "No voice audio was captured. Please try speaking again.",
      });
      return;
    }

    try {
      let rawTranscription = cleanBrowserDraft;

      if (audioBase64) {
        const cleanMime = (mimeType || "audio/webm").split(";")[0].trim() || "audio/webm";
        const transcribePrompt = `You are a multilingual speech-to-text recognizer specialized in Kannada, Kanglish (Kannada spoken with English words or English phonetics), Kannada-English code-mixing, and Indian English.
Listen carefully to the audio and transcribe EXACTLY what the speaker said.
Rules:
1. If the speaker speaks Kannada words conversationally mixed with English (Kanglish, e.g., "Nanage artificial intelligence bagge heli", "AI safety andre enu?", "Kannada dalli answer kodi", "Ivattu technology bagge explain madi", "Ondu example kodi", "Idhu heg kelasa madutte?"), transcribe the Kannada words accurately in Romanized Kanglish letters and English words in English.
2. If the speaker speaks pure Kannada clearly, transcribe in Kannada script or clear Kanglish faithfully matching their speech.
3. Do NOT force Kannada words into unrelated English words (never treat Kanglish as plain English).
4. Do NOT invent or guess words if the audio is silent, background noise only, or unintelligible. If silent or unintelligible, return strictly: [UNCLEAR_AUDIO]
5. Return ONLY the verbatim transcription text with no commentary or labels.${
          voiceLangHint ? `\nSpeaker mode hint: ${voiceLangHint}` : ""
        }`;

        const asrResponse = await generateContentWithFallback(
          ai,
          {
            model: TRANSCRIBE_MODEL_NAME,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: audioBase64,
                  },
                },
                { text: transcribePrompt },
              ],
            },
          },
          FALLBACK_MODEL_NAME
        );

        const modelTranscript = (asrResponse.text ?? "").trim();
        if (modelTranscript === "[UNCLEAR_AUDIO]" || !modelTranscript) {
          if (!cleanBrowserDraft) {
            res.json({
              rawTranscription: "",
              normalizedText: "",
              detectedInputType: "Kanglish",
              kannadaRepresentation: "",
              confidence: "low",
              isUnclear: true,
              lowConfidenceMessage:
                "Could not hear clearly or no speech was detected. Please speak again closer to your microphone or edit your message manually.",
            });
            return;
          }
          rawTranscription = cleanBrowserDraft;
        } else {
          rawTranscription = modelTranscript;
        }
      }

      const processed = await runKanglishPipeline(ai, rawTranscription, cleanBrowserDraft);
      res.json(processed);
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      const status = errorObj?.status || 500;
      console.error("[SURAKSHINI /api/transcribe error]", status, errorObj?.message);

      if (cleanBrowserDraft) {
        res.json({
          rawTranscription: cleanBrowserDraft,
          normalizedText: cleanBrowserDraft,
          detectedInputType: KANNADA_SCRIPT_REGEX.test(cleanBrowserDraft) ? "Kannada" : "Kanglish",
          kannadaRepresentation: "",
          confidence: "medium",
          isUnclear: false,
          lowConfidenceMessage: "",
        });
        return;
      }

      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: "Unable to transcribe audio right now. Please try speaking again or type your message.",
      });
    }
  });

  app.post("/api/chat", async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(500).json({
        error:
          "Gemini API key is not configured. Please check your key in the Settings > Secrets panel.",
      });
      return;
    }

    const body = req.body as ChatRequestBody;
    const userMessage = (body.message ?? "").trim();
    const image = body.image;
    const history = Array.isArray(body.history) ? body.history : [];

    if (!userMessage && !image?.data) {
      res.status(400).json({ error: "Please enter a message or attach a screenshot." });
      return;
    }

    try {
      const contents: Array<{
        role: "user" | "model";
        parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
      }> = [];

      const activeLang = resolveActiveLanguage(
        userMessage,
        history,
        body.responseLanguage,
        body.preferredLanguage
      );
      const priorUsedQuestions = new Set<string>();
      const priorQuestionsList: string[] = [];

      if (userMessage) {
        priorUsedQuestions.add(normalizeQuestion(userMessage));
      }

      // Run or reuse Intelligent Kanglish Processing Pipeline before safety classification & generation
      let inputProcessing: {
        rawTranscription: string;
        normalizedText: string;
        detectedInputType: DetectedInputType;
        kannadaRepresentation: string;
        confidence: "high" | "medium" | "low";
        isUnclear: boolean;
        lowConfidenceMessage: string;
      } | null = null;

      if (userMessage) {
        const vm = body.voiceMetadata;
        if (
          vm &&
          vm.normalizedText &&
          vm.normalizedText.trim() === userMessage &&
          vm.kannadaRepresentation
        ) {
          inputProcessing = {
            rawTranscription: vm.rawTranscription || userMessage,
            normalizedText: vm.normalizedText,
            detectedInputType: vm.detectedInputType || "Kanglish",
            kannadaRepresentation: vm.kannadaRepresentation,
            confidence: vm.confidence || "high",
            isUnclear: Boolean(vm.isUnclear),
            lowConfidenceMessage: vm.lowConfidenceMessage || "",
          };
        } else {
          inputProcessing = await runKanglishPipeline(
            ai,
            userMessage,
            vm?.rawTranscription
          );
          if (vm?.rawTranscription && inputProcessing) {
            inputProcessing.rawTranscription = vm.rawTranscription;
          }
        }
      }

      // Preserve up to the last 16 turns for contextual follow-up memory
      const recentHistory = history.slice(-16);
      for (const item of recentHistory) {
        const role = item.role === "assistant" ? "model" : "user";
        let text = item.content || "";
        if (item.role === "user" && text.trim()) {
          priorUsedQuestions.add(normalizeQuestion(text));
          priorQuestionsList.push(text.trim().slice(0, 120));
          if (item.voiceMetadata?.kannadaRepresentation) {
            text = `${text}\n[Semantic Kannada Context: ${item.voiceMetadata.kannadaRepresentation}]`;
          }
        }
        if (item.role === "assistant" && Array.isArray(item.followUpPrompts)) {
          for (const prevPrompt of item.followUpPrompts) {
            if (typeof prevPrompt === "string" && prevPrompt.trim()) {
              priorUsedQuestions.add(normalizeQuestion(prevPrompt));
              priorQuestionsList.push(prevPrompt.trim().slice(0, 120));
            }
          }
        }
        if (item.role === "user" && item.hadImage) {
          text = `[User attached a chat screenshot]\n${text}`.trim();
        }
        if (item.role === "assistant" && item.hasAnalysis && item.analysis) {
          const summary = [
            item.analysis.detectionResult ? `Result: ${item.analysis.detectionResult}` : "",
            item.analysis.severity ? `Severity: ${item.analysis.severity}` : "",
            item.analysis.categories?.length
              ? `Categories: ${item.analysis.categories.join(", ")}`
              : "",
            item.analysis.extractedText ? `Extracted text: ${item.analysis.extractedText}` : "",
            item.analysis.explanation ? `Explanation: ${item.analysis.explanation}` : "",
          ]
            .filter(Boolean)
            .join(" | ");
          text = `${text}\n\n[Previous Safety Analysis Summary: ${summary}]`.trim();
        }

        if (text) {
          contents.push({
            role,
            parts: [{ text }],
          });
        }
      }

      const currentParts: Array<{
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }> = [];

      if (image?.data && image?.mimeType) {
        currentParts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: image.data,
          },
        });
      }

      let effectivePrompt =
        userMessage ||
        (activeLang === "kn"
          ? "ದಯವಿಟ್ಟು ಈ ಸಂಭಾಷಣೆಯ ಸ್ಕ್ರೀನ್‌ಶಾಟ್ ಅನ್ನು ಎಚ್ಚರಿಕೆಯಿಂದ ಓದಿ, ಪಠ್ಯವನ್ನು ಗುರುತಿಸಿ ಮತ್ತು ಸೈಬರ್ ಬುಲ್ಲಿಯಿಂಗ್ ಹಾಗೂ ಡಿಜಿಟಲ್ ಸುರಕ್ಷತಾ ವಿಶ್ಲೇಷಣೆ ನೀಡಿ."
          : activeLang === "kanglish"
            ? "Dayavittu ee conversation screenshot odi, text transcribe madi mattu cyberbullying hagu digital safety analysis kodi."
            : "Please read this conversation screenshot carefully, transcribe the text, and perform a full cyberbullying and digital safety analysis.");

      if (inputProcessing && userMessage) {
        const metaLines = [
          `[Input Type: ${inputProcessing.detectedInputType}]`,
          inputProcessing.normalizedText && inputProcessing.normalizedText !== userMessage
            ? `[Normalized Meaning: ${inputProcessing.normalizedText}]`
            : "",
          inputProcessing.kannadaRepresentation
            ? `[Internal Kannada Representation: ${inputProcessing.kannadaRepresentation}]`
            : "",
          inputProcessing.rawTranscription && inputProcessing.rawTranscription !== userMessage
            ? `[Original Voice Transcription: ${inputProcessing.rawTranscription}]`
            : "",
        ].filter(Boolean);

        if (metaLines.length > 0) {
          effectivePrompt = `${userMessage}\n\n${metaLines.join("\n")}`;
        }
      }

      currentParts.push({ text: effectivePrompt });

      contents.push({
        role: "user",
        parts: currentParts,
      });

      const languageDirective =
        activeLang === "kn"
          ? "\n\nSELECTED RESPONSE LANGUAGE: Kannada script (ಕನ್ನಡ). Write your entire conversational reply and ALL 3 to 4 followUpPrompts in natural, grammatically correct Kannada script, avoiding unnecessary English words."
          : activeLang === "kanglish"
            ? '\n\nSELECTED RESPONSE LANGUAGE: Kanglish (Kannada written using English letters). Write your entire conversational reply and ALL 3 to 4 followUpPrompts in natural conversational Kanglish — Kannada words and grammar written with English letters (for example: "AI safety andre artificial intelligence systems surakshitavagi kelasa maduvante nodikolluvudu."). Only override this if the user explicitly asks in their message for Kannada script or English.'
            : "\n\nSELECTED RESPONSE LANGUAGE: English. Write your conversational reply and ALL 3 to 4 followUpPrompts in clear, natural English (unless the user explicitly asks inside this message to respond in Kannada script or Kanglish).";

      const deduplicationDirective =
        priorQuestionsList.length > 0
          ? `\n\nAVOID REPEATING ANY OF THESE EARLIER QUESTIONS OR SUGGESTIONS IN followUpPrompts:\n- ${priorQuestionsList
              .slice(-12)
              .join("\n- ")}`
          : "";

      const requestSystemInstruction = `${SYSTEM_INSTRUCTION}${languageDirective}${deduplicationDirective}`;

      const response = await generateContentWithFallback(ai, {
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction: requestSystemInstruction,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const rawText = (response.text ?? "").trim();
      if (!rawText) {
        res.status(502).json({
          error: "SURAKSHINI AI received an empty response. Please try again.",
        });
        return;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        // Fallback if model returned plain text despite schema
        parsed = {
          reply: rawText,
          hasAnalysis: false,
          followUpPrompts: buildFallbackFollowUps(activeLang, false),
        };
      }

      parsed.followUpPrompts = sanitizeFollowUpPrompts(
        parsed.followUpPrompts,
        priorUsedQuestions,
        activeLang,
        Boolean(parsed.hasAnalysis)
      );

      parsed.responseLanguage = activeLang;
      if (inputProcessing) {
        parsed.inputProcessing = inputProcessing;
      }

      res.json(parsed);
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      const status = errorObj?.status || 500;
      const rawMessage = errorObj?.message || "An unexpected error occurred.";
      console.error("[SURAKSHINI /api/chat error]", status, rawMessage);

      let friendlyMessage = "Unable to process your request right now. Please try again.";
      if (status === 403 || rawMessage.includes("PERMISSION_DENIED") || rawMessage.includes("API_KEY_INVALID")) {
        friendlyMessage =
          "API authentication failed. Please verify your Gemini API key in the Settings > Secrets panel.";
      } else if (status === 429 || rawMessage.includes("RESOURCE_EXHAUSTED")) {
        friendlyMessage =
          "Rate limit or quota reached. Please wait a moment and try again, or check your quota in Settings > Secrets.";
      } else if (status === 400) {
        friendlyMessage =
          "The request or image could not be processed. Please try a smaller PNG/JPEG screenshot or shorter message.";
      }

      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: friendlyMessage,
      });
    }
  });

  // Modular Gemini Neural TTS endpoint (returns WAV base64 for natural AI speech playback)
  app.post("/api/tts", async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(500).json({
        error:
          "Gemini API key is not configured. Please check your key in the Settings > Secrets panel.",
      });
      return;
    }

    const { text, voiceName, languageHint } = req.body as {
      text?: string;
      voiceName?: string;
      languageHint?: "en" | "kn" | "kanglish";
    };
    const cleanText = (text ?? "").trim();
    if (!cleanText) {
      res.status(400).json({ error: "No text provided for speech generation." });
      return;
    }

    const allowedVoices = new Set(["Kore", "Zephyr", "Puck", "Charon", "Fenrir"]);
    const selectedVoice = voiceName && allowedVoices.has(voiceName) ? voiceName : "Kore";

    const stylePrompt =
      languageHint === "kn"
        ? "Warm, empathetic, natural digital safety companion speaking fluent, clear Kannada at a calm conversational pace."
        : languageHint === "kanglish"
          ? "Warm, empathetic, natural digital safety companion speaking smoothly in Indian English and Kanglish, pronouncing Kannada words and English phrases clearly."
          : "Warm, empathetic, natural digital safety companion speaking clearly and smoothly at a calm conversational pace, like a supportive human assistant.";

    try {
      const ttsResponse = await generateWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.8-flash-lite-tts",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: cleanText.slice(0, 2400),
                  speechMetadata: {
                    style: stylePrompt,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        })
      );

      const base64Audio =
        ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({
          error: "Speech audio was not returned. Falling back to browser voice playback.",
        });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
        voiceName: selectedVoice,
      });
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      const status = errorObj?.status || 500;
      console.error("[SURAKSHINI /api/tts error]", status, errorObj?.message);
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error:
          "Neural speech generation is temporarily unavailable. Falling back to browser voice synthesis.",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SURAKSHINI AI server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start SURAKSHINI AI server:", err);
  process.exit(1);
});
