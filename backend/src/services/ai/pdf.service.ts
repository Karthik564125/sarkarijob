import axios from 'axios';
import https from 'https';
import { PDFParse } from 'pdf-parse';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export interface PdfExtractionResult {
  success: boolean;
  text: string;
  pageCount: number;
  error?: string;
}

/**
 * Downloads an official government recruitment PDF and extracts plain text content.
 */
export async function extractTextFromPdfUrl(pdfUrl: string): Promise<PdfExtractionResult> {
  try {
    if (!pdfUrl || !pdfUrl.startsWith('http')) {
      return { success: false, text: '', pageCount: 0, error: 'Invalid or missing PDF URL' };
    }

    console.log(`[PdfService] Downloading PDF from: ${pdfUrl}`);
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      httpsAgent,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/pdf,*/*',
      },
    });

    const buffer = Buffer.from(response.data);
    if (!buffer || buffer.length === 0) {
      return { success: false, text: '', pageCount: 0, error: 'Downloaded PDF file buffer is empty (0 bytes)' };
    }

    console.log(`[PdfService] Extracting text from PDF (${buffer.length} bytes)...`);
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();

    const extractedText = (textResult.text || '').trim();
    if (!extractedText || extractedText.length < 50) {
      return {
        success: false,
        text: extractedText,
        pageCount: textResult.total || 0,
        error: 'Extracted text is empty or too short (scanned PDF or invalid format)',
      };
    }

    console.log(`[PdfService] PDF text extraction succeeded (${textResult.total || 0} pages, ${extractedText.length} characters)`);
    return {
      success: true,
      text: extractedText,
      pageCount: textResult.total || 0,
    };
  } catch (err: any) {
    const errMsg = err?.message || 'Unknown PDF extraction error';
    console.error(`[PdfService] Extraction failed for ${pdfUrl}: ${errMsg}`);
    return {
      success: false,
      text: '',
      pageCount: 0,
      error: errMsg,
    };
  }
}

