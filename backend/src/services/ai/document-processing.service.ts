import { createClient } from '@supabase/supabase-js';
import { extractTextFromPdfUrl } from './pdf.service.js';
import { extractRecruitmentInformation, getCandidateModels } from './gemini.service.js';
import type { RecruitmentExtraction } from './extraction.schema.js';
import { buildExtractionRecruitmentUpdate } from './extraction-persistence.js';
import { createRecruitmentEvent, detectRecruitmentChanges, reevaluateAffectedUserMatches } from '../recruitment/events.service.js';
import type { RawRecruitmentItem } from '../recruitment/types.js';
import { sha256 } from '../recruitment/normalization.service.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export type DocumentProcessingStatus = 'completed' | 'already_processed' | 'failed' | 'skipped';

export interface DocumentProcessingResult {
  status: DocumentProcessingStatus;
  documentId: string;
  recruitmentId?: string;
  notificationNumber?: string | null;
  officialUrl?: string;
  downloadSuccess?: boolean;
  textExtractionSuccess?: boolean;
  textLength?: number;
  geminiSuccess?: boolean;
  zodValidationSuccess?: boolean;
  dbUpdateSuccess?: boolean;
  model?: string;
  version?: string;
  extractedAt?: string;
  data?: RecruitmentExtraction | null;
  error?: string;
  durationMs?: number;
}

export interface BatchProcessingOptions {
  limit?: number;
  organization?: string;
  status?: string;
  forceRetry?: boolean;
}

export interface BatchProcessingSummary {
  requested: number;
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
  results: DocumentProcessingResult[];
}

/**
 * Process a single recruitment document end-to-end:
 * PDF Download -> Text Extraction -> Gemini Structured Extraction -> Zod Validation -> Supabase Persistence
 */
export async function processRecruitmentDocument(
  documentId: string,
  options?: { forceRetry?: boolean; emitEvents?: boolean; reevaluateMatches?: boolean }
): Promise<DocumentProcessingResult> {
  const startTime = Date.now();
  const forceRetry = options?.forceRetry ?? false;

  console.log(`[DocProcessor] Processing document ID: ${documentId} (forceRetry=${forceRetry})`);

  // 1. Fetch document and parent recruitment record from Supabase
  const { data: doc, error: docErr } = await supabase
    .from('recruitment_documents')
    .select('*, recruitment:recruitments(*)')
    .eq('id', documentId)
    .single();

  if (docErr || !doc) {
    const errMsg = docErr?.message || `Document ID ${documentId} not found in database`;
    console.error(`[DocProcessor] Fetch error: ${errMsg}`);
    return {
      status: 'failed',
      documentId,
      error: errMsg,
      durationMs: Date.now() - startTime,
    };
  }

  const recruitment = doc.recruitment;
  const officialUrl = doc.official_url;
  const notifNum = recruitment?.notification_number || doc.title || null;

  // 2. Verify official URL exists
  if (!officialUrl || !officialUrl.startsWith('http')) {
    console.error(`[DocProcessor] Document ${documentId} has invalid official_url: ${officialUrl}`);
    await supabase
      .from('recruitment_documents')
      .update({ extraction_status: 'failed' })
      .eq('id', documentId);

    return {
      status: 'failed',
      documentId,
      recruitmentId: doc.recruitment_id,
      notificationNumber: notifNum,
      officialUrl: officialUrl || '',
      error: 'Invalid or missing official_url in document record',
      durationMs: Date.now() - startTime,
    };
  }

  // 3. IDEMPOTENCY CHECK: Skip if already completed and not force retrying
  if (doc.extraction_status === 'completed' && !forceRetry) {
    console.log(`[DocProcessor] Document ${documentId} (${notifNum}) already completed. Skipping.`);
    return {
      status: 'already_processed',
      documentId,
      recruitmentId: doc.recruitment_id,
      notificationNumber: notifNum,
      officialUrl,
      downloadSuccess: true,
      textExtractionSuccess: true,
      geminiSuccess: true,
      zodValidationSuccess: true,
      dbUpdateSuccess: true,
      model: doc.extraction_model || getCandidateModels()[0],
      version: doc.extraction_version || 'gemini-v1',
      extractedAt: doc.extracted_at || undefined,
      durationMs: Date.now() - startTime,
    };
  }

  // 4. Mark status as 'processing'
  await supabase
    .from('recruitment_documents')
    .update({ extraction_status: 'processing' })
    .eq('id', documentId);

  // 5. Download PDF & extract text
  const pdfResult = await extractTextFromPdfUrl(officialUrl);

  if (!pdfResult.success || !pdfResult.text || pdfResult.text.length < 50) {
    const pdfErrMsg = pdfResult.error || 'Failed to extract text from PDF (scanned or unreadable)';
    console.error(`[DocProcessor] PDF text extraction failed for document ${documentId}: ${pdfErrMsg}`);

    await supabase
      .from('recruitment_documents')
      .update({ extraction_status: 'failed' })
      .eq('id', documentId);

    return {
      status: 'failed',
      documentId,
      recruitmentId: doc.recruitment_id,
      notificationNumber: notifNum,
      officialUrl,
      downloadSuccess: pdfResult.pageCount > 0 || pdfResult.text.length > 0,
      textExtractionSuccess: false,
      textLength: pdfResult.text?.length || 0,
      geminiSuccess: false,
      zodValidationSuccess: false,
      dbUpdateSuccess: false,
      error: pdfErrMsg,
      durationMs: Date.now() - startTime,
    };
  }

  // 6. Gemini Extraction & Zod Validation
  const contextMetadata = {
    title: recruitment?.title || doc.title,
    organization: recruitment?.organization || 'UNKNOWN',
    notification_number: notifNum,
  };

  const aiResult = await extractRecruitmentInformation(pdfResult.text, contextMetadata);

  if (!aiResult.success || !aiResult.data) {
    const aiErrMsg = aiResult.error || 'Gemini extraction or Zod validation failed';
    console.error(`[DocProcessor] AI extraction failed for document ${documentId}: ${aiErrMsg}`);

    await supabase
      .from('recruitment_documents')
      .update({ extraction_status: 'failed' })
      .eq('id', documentId);

    return {
      status: 'failed',
      documentId,
      recruitmentId: doc.recruitment_id,
      notificationNumber: notifNum,
      officialUrl,
      downloadSuccess: true,
      textExtractionSuccess: true,
      textLength: pdfResult.text.length,
      geminiSuccess: false,
      zodValidationSuccess: false,
      dbUpdateSuccess: false,
      model: aiResult.model,
      version: aiResult.version,
      error: aiErrMsg,
      durationMs: Date.now() - startTime,
    };
  }

  // 7. Update Supabase recruitment & document metadata
  const extractedAt = new Date().toISOString();

  const recruitmentUpdate = buildExtractionRecruitmentUpdate(
    recruitment,
    aiResult.data,
    doc.document_type === 'vacancy_notice_pdf' ? null : doc.published_at
  );

  const { error: recUpdateErr } = await supabase
    .from('recruitments')
    .update({
      ...recruitmentUpdate,
      extraction_status: 'completed',
      extraction_model: aiResult.model,
      extraction_version: aiResult.version,
      extracted_at: extractedAt,
    })
    .eq('id', doc.recruitment_id);

  const { error: docUpdateErr } = await supabase
    .from('recruitment_documents')
    .update({
      extraction_status: 'completed',
      extraction_model: aiResult.model,
      extraction_version: aiResult.version,
      extracted_at: extractedAt,
    })
    .eq('id', documentId);

  const dbSuccess = !recUpdateErr && !docUpdateErr;

  if (!dbSuccess) {
    const dbErrMsg = recUpdateErr?.message || docUpdateErr?.message || 'Database update failed';
    console.error(`[DocProcessor] DB update failed for document ${documentId}: ${dbErrMsg}`);
    return {
      status: 'failed',
      documentId,
      recruitmentId: doc.recruitment_id,
      notificationNumber: notifNum,
      officialUrl,
      downloadSuccess: true,
      textExtractionSuccess: true,
      textLength: pdfResult.text.length,
      geminiSuccess: true,
      zodValidationSuccess: true,
      dbUpdateSuccess: false,
      model: aiResult.model,
      version: aiResult.version,
      error: dbErrMsg,
      durationMs: Date.now() - startTime,
    };
  }

  if (options?.emitEvents !== false) {
    const eventItem: RawRecruitmentItem = {
      organization: recruitment.organization,
      title: recruitmentUpdate.title,
      notification_number: recruitment.notification_number,
      recruitment_type: recruitment.recruitment_type,
      description: recruitmentUpdate.description,
      vacancies: recruitmentUpdate.vacancies,
      notification_date: recruitmentUpdate.notification_date,
      application_start: recruitmentUpdate.application_start,
      application_end: recruitmentUpdate.application_end,
      exam_date: recruitmentUpdate.exam_date,
      official_page_url: recruitment.official_page_url,
      official_pdf_url: officialUrl,
      source_url: recruitment.official_page_url || officialUrl,
      source_document_url: officialUrl,
      discovered_at: extractedAt,
      raw_text: null,
      content_hash: sha256(JSON.stringify(aiResult.data)),
      min_age: aiResult.data.age.minimum,
      max_age: aiResult.data.age.maximum,
      fee: null,
    };

    try {
      const events = detectRecruitmentChanges(doc.recruitment_id, recruitment, eventItem);
      for (const event of events) await createRecruitmentEvent(event);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[DocProcessor] Could not emit document-derived events for ${doc.recruitment_id}: ${message}`);
    }
  }

  if (options?.reevaluateMatches !== false) {
    await reevaluateAffectedUserMatches(doc.recruitment_id);
  }

  console.log(`[DocProcessor] Document ${documentId} successfully processed and saved to DB.`);
  return {
    status: 'completed',
    documentId,
    recruitmentId: doc.recruitment_id,
    notificationNumber: notifNum,
    officialUrl,
    downloadSuccess: true,
    textExtractionSuccess: true,
    textLength: pdfResult.text.length,
    geminiSuccess: true,
    zodValidationSuccess: true,
    dbUpdateSuccess: true,
    model: aiResult.model,
    version: aiResult.version,
    extractedAt,
    data: aiResult.data,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Batch processing service for processing multiple documents sequentially.
 */
export async function processRecruitmentDocuments(
  options: BatchProcessingOptions = {}
): Promise<BatchProcessingSummary> {
  const defaultBatch = process.env.DOCUMENT_PROCESS_BATCH_SIZE
    ? parseInt(process.env.DOCUMENT_PROCESS_BATCH_SIZE, 10)
    : 10;
  const limit = options.limit || defaultBatch;
  const statusFilter = options.status || 'pending';
  const orgFilter = options.organization;
  const forceRetry = options.forceRetry || false;

  console.log(`[BatchProcessor] Starting batch run (limit=${limit}, org=${orgFilter || 'ALL'}, status=${statusFilter})`);

  let query = supabase
    .from('recruitment_documents')
    .select('id, official_url, extraction_status, created_at, recruitment:recruitments!inner(organization, notification_number)');

  if (statusFilter !== 'all') {
    query = query.eq('extraction_status', statusFilter);
  }

  if (orgFilter) {
    query = query.eq('recruitment.organization', orgFilter);
  }

  query = query.order('created_at', { ascending: false }).limit(limit);

  const { data: docs, error: queryErr } = await query;

  if (queryErr) {
    console.error(`[BatchProcessor] Failed to query recruitment documents:`, queryErr.message);
    return {
      requested: limit,
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      results: [],
    };
  }

  const documentList = docs || [];
  console.log(`[BatchProcessor] Found ${documentList.length} candidate documents for processing`);

  const results: DocumentProcessingResult[] = [];
  let completedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const docItem of documentList) {
    try {
      const res = await processRecruitmentDocument(docItem.id, { forceRetry });
      results.push(res);

      if (res.status === 'completed') {
        completedCount++;
      } else if (res.status === 'already_processed' || res.status === 'skipped') {
        skippedCount++;
      } else {
        failedCount++;
      }
    } catch (err: any) {
      console.error(`[BatchProcessor] Error processing document ${docItem.id}:`, err.message);
      results.push({
        status: 'failed',
        documentId: docItem.id,
        error: err.message,
      });
      failedCount++;
    }
  }

  return {
    requested: documentList.length,
    processed: completedCount + failedCount,
    completed: completedCount,
    failed: failedCount,
    skipped: skippedCount,
    results,
  };
}
