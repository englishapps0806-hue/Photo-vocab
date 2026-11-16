import { createId, type ExtractedWordDraft } from '../../domain/vocab';

export interface VisionExtractResult {
  suggestedTitle: string;
  items: ExtractedWordDraft[];
}

const MAX_DIMENSION_PX = 1600;
const JPEG_QUALITY = 0.85;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('画像の読み込みに失敗しました。'));
      }
    };
    reader.onerror = () => reject(new Error('画像ファイルの読み込み中にエラーが発生しました。'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像をデコードできませんでした。JPEGまたはPNGをお試しください。'));
    img.src = src;
  });
}

/**
 * Resizes large iPhone photos (12MP/48MP) on-device before upload
 * so extraction completes rapidly on cellular connections.
 */
export async function prepareImageForUpload(
  file: File
): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  const rawDataUrl = await readFileAsDataUrl(file);

  try {
    const img = await loadImageElement(rawDataUrl);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    if (!width || !height) {
      throw new Error('Invalid dimensions');
    }

    const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D unavailable');
    }

    ctx.drawImage(img, 0, 0, targetW, targetH);
    const compressedUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const base64 = compressedUrl.split(',')[1] ?? '';

    return {
      base64,
      mimeType: 'image/jpeg',
      previewUrl: compressedUrl,
    };
  } catch {
    // Fallback for HEIC or formats that canvas couldn't decode directly
    const [header, base64 = ''] = rawDataUrl.split(',');
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const mimeType = file.type || mimeMatch?.[1] || 'image/jpeg';
    return {
      base64,
      mimeType,
      previewUrl: rawDataUrl,
    };
  }
}

export async function extractVocabularyFromImage(
  imageBase64: string,
  mimeType: string
): Promise<VisionExtractResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('現在オフラインです。写真のAI解析にはインターネット接続が必要です。');
  }

  let response: Response;
  try {
    response = await fetch('/api/extract-vocab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64, mimeType }),
    });
  } catch {
    throw new Error('サーバーに接続できませんでした。通信環境を確認してもう一度お試しください。');
  }

  let payload: {
    suggestedTitle?: string;
    items?: Array<{
      english: string;
      japanese: string;
      partOfSpeech?: string;
      phonetic?: string;
    }>;
    error?: string;
  };

  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new Error('サーバーから正しい応答を受信できませんでした。');
  }

  if (!response.ok) {
    throw new Error(payload.error || `読み取りに失敗しました (${response.status})`);
  }

  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  return {
    suggestedTitle: payload.suggestedTitle || '新しい単語帳',
    items: rawItems.map((item) => ({
      id: createId('draft'),
      english: item.english ?? '',
      japanese: item.japanese ?? '',
      partOfSpeech: item.partOfSpeech ?? '',
      phonetic: item.phonetic ?? '',
    })),
  };
}
