import { GoogleGenAI } from '@google/genai';
import { RecruitmentExtractionSchema, type RecruitmentExtraction } from './extraction.schema.js';

export function getCandidateModels(): string[] {
  const primary = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const fallback = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite';
  return Array.from(new Set([primary, fallback]));
}

export const EXTRACTION_VERSION = 'gemini-v1';

export interface ExtractionResult {
  success: boolean;
  model: string;
  version: string;
  data: RecruitmentExtraction | null;
  rawResponse?: string;
  error?: string;
  durationMs: number;
}

const SYSTEM_PROMPT = `
You are an expert AI data extraction engine for Indian government recruitment notifications (SarkariJob).

YOUR TASK:
Extract structured recruitment information strictly from the provided government notification text.

STRICT EXTRACTION RULES:
1. Extract ONLY information explicitly present in the notification text.
2. DO NOT invent, assume, infer from general government rules, or estimate missing dates, age limits, qualifications, or vacancies.
3. If any field or value is NOT explicitly stated in the notification text, set its value to null.
4. Distinguish clearly between:
   - Explicitly stated information -> Extract value accurately.
   - Unclear or missing information -> Set value to null AND add a clear explanatory note in the ambiguities array.
5. All dates (application_start, application_end, exam_date) must be in YYYY-MM-DD format if explicitly stated; otherwise set to null.
6. Return ONLY a valid JSON object matching the JSON schema provided below. Do not wrap in markdown codeblocks if responseMimeType is json.

JSON SCHEMA REQUIREMENT:
{
  "recruitment_title": string | null,
  "organization": string | null,
  "notification_number": string | null,
  "recruitment_type": string | null,
  "description": string | null,
  "vacancies": number | null,
  "notification_date": "YYYY-MM-DD" | null,
  "application_start": "YYYY-MM-DD" | null,
  "application_end": "YYYY-MM-DD" | null,
  "exam_date": "YYYY-MM-DD" | null,
  "age": {
    "minimum": number | null,
    "maximum": number | null,
    "relaxation": { [category: string]: string } | null
  },
  "education": {
    "minimum_level": string | null,
    "required_degrees": string[] | null,
    "allowed_branches": string[] | null,
    "required_subjects": string[] | null
  },
  "experience": {
    "required": boolean | null,
    "details": string | null
  },
  "nationality_requirement": string | null,
  "domicile_requirement": string | null,
  "category_requirements": { [category: string]: string } | null,
  "gender_requirements": string | null,
  "physical_requirements": { [param: string]: string } | null,
  "post_wise_eligibility": Array<{
    "post_name": string,
    "vacancies": number | null,
    "education": string | null,
    "age_limit": string | null
  }> | null,
  "important_conditions": string[] | null,
  "ambiguities": string[]
}
`;

export async function extractRecruitmentInformation(
  notificationText: string,
  contextMetadata?: { title?: string; organization?: string; notification_number?: string }
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  const candidateModels = getCandidateModels();

  if (!apiKey) {
    return {
      success: false,
      model: candidateModels[0],
      version: EXTRACTION_VERSION,
      data: null,
      error: 'GEMINI_API_KEY is not defined in backend environment variables',
      durationMs: Date.now() - startTime,
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const userPrompt = `
Context Metadata (for context reference only):
${JSON.stringify(contextMetadata || {}, null, 2)}

Recruitment Notification Full Text:
---
${notificationText}
---

Extract the structured recruitment information according to the system rules and schema.
`;

  let lastError = '';

  for (const modelName of candidateModels) {
    try {
      console.log(`[GeminiService] Sending text (${notificationText.length} chars) to model '${modelName}'...`);

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const durationMs = Date.now() - startTime;
      const rawText = (response.text || '').trim();

      console.log(`[GeminiService] Received response from '${modelName}' in ${durationMs}ms`);

      let jsonParsed: unknown;
      try {
        jsonParsed = JSON.parse(rawText);
      } catch (parseErr) {
        console.error(`[GeminiService] Failed to parse JSON response from Gemini model '${modelName}'`);
        return {
          success: false,
          model: modelName,
          version: EXTRACTION_VERSION,
          data: null,
          rawResponse: rawText,
          error: `JSON parse error: ${(parseErr as Error).message}`,
          durationMs,
        };
      }

      const validation = RecruitmentExtractionSchema.safeParse(jsonParsed);
      if (!validation.success) {
        console.error(`[GeminiService] Zod schema validation failed for model '${modelName}':`, validation.error.format());
        return {
          success: false,
          model: modelName,
          version: EXTRACTION_VERSION,
          data: null,
          rawResponse: rawText,
          error: `Zod validation error: ${validation.error.message}`,
          durationMs,
        };
      }

      console.log(`[GeminiService] Successfully extracted and validated recruitment data using '${modelName}' (${validation.data.ambiguities.length} ambiguities noted)`);

      return {
        success: true,
        model: modelName,
        version: EXTRACTION_VERSION,
        data: validation.data,
        rawResponse: rawText,
        durationMs,
      };
    } catch (err: any) {
      lastError = err?.message || 'Unknown Gemini error';
      console.warn(`[GeminiService] Model '${modelName}' request failed: ${lastError}. Trying fallback model...`);
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    success: false,
    model: candidateModels[0],
    version: EXTRACTION_VERSION,
    data: null,
    error: `All candidate models failed. Last error: ${lastError}`,
    durationMs,
  };
}
