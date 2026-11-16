import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export interface ExtractedVocabItem {
  english: string;
  japanese: string;
  partOfSpeech?: string;
  phonetic?: string;
}

export interface ExtractVocabResponse {
  suggestedTitle: string;
  items: ExtractedVocabItem[];
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

let cachedClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiServiceError(
      'サーバーの Gemini API キーが設定されていません。Secrets パネルで GEMINI_API_KEY を確認してください。',
      500,
      'API_KEY_MISSING'
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export class GeminiServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'GeminiServiceError';
    this.status = status;
    this.code = code;
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('DEADLINE_EXCEEDED') ||
        msg.includes('ECONNRESET');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 600 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function mapGeminiError(err: unknown): GeminiServiceError {
  if (err instanceof GeminiServiceError) {
    return err;
  }
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('PERMISSION_DENIED') || message.includes('403')) {
    return new GeminiServiceError(
      'Gemini API の認証に失敗しました。Settings > Secrets の API キーを確認してください。',
      403,
      'PERMISSION_DENIED'
    );
  }
  if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
    return new GeminiServiceError(
      'Gemini API キーが無効です。Settings > Secrets パネルを確認してください。',
      400,
      'API_KEY_INVALID'
    );
  }
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
    return new GeminiServiceError(
      '現在リクエストが集中しています。少し時間を置いてもう一度お試しください。',
      429,
      'RESOURCE_EXHAUSTED'
    );
  }
  if (message.includes('NOT_FOUND') || message.includes('404')) {
    return new GeminiServiceError(
      '画像解析モデルへの接続に失敗しました。しばらくしてからお試しください。',
      502,
      'MODEL_NOT_FOUND'
    );
  }
  return new GeminiServiceError(
    '画像の読み取り中にエラーが発生しました。明るい場所で単語がはっきり写るように撮り直してください。',
    500,
    'EXTRACTION_FAILED'
  );
}

export async function extractVocabFromImage(
  imageBase64: string,
  mimeType: string
): Promise<ExtractVocabResponse> {
  const normalizedMime = mimeType.toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    throw new GeminiServiceError(
      '対応していない画像形式です。JPEG・PNG・WebP・HEIC の画像を選択してください。',
      400,
      'INVALID_MIME_TYPE'
    );
  }

  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '').trim();
  if (!cleanBase64 || cleanBase64.length < 100) {
    throw new GeminiServiceError(
      '画像データが正しく読み込めませんでした。別の写真をお試しください。',
      400,
      'INVALID_IMAGE_DATA'
    );
  }

  const ai = getGeminiClient();

  const systemInstruction = [
    'あなたは日本の英語学習者向けの精密な単語帳OCR・辞書解析エンジンです。',
    '画像（市販の英単語帳、手書きノート、プリント、スクリーンショットなど）から英単語・英語表現とその日本語訳を抽出し、JSONで返してください。',
    'ルール:',
    '1. 画像内に記載されている見出しの英単語・熟語をすべて、上から下・左から右の読み順で漏れなく抽出する。',
    '2. 各英単語に対応する日本語訳を正確に対応づける。画像に複数の意味がある場合は簡潔に「／」や「、」でまとめる。',
    '3. もし画像内に日本語訳が書かれていない英単語がある場合は、文脈や一般的な意味に合う自然な日本語訳を補完する。',
    '4. ページ番号、見出し番号（例: "001", "(1)"）、音声マーク記号などのノイズは英語・日本語テキストから取り除く。',
    '5. 品詞（例: 動詞, 名詞, 形容詞, 副詞, 熟語）や発音記号が判別できる場合はそれぞれ partOfSpeech / phonetic に含める（不明な場合は空文字）。',
    '6. suggestedTitle には、ページの章題やテーマから推測した簡潔な単語帳タイトル（例: "ビジネス・経済の英単語", "Unit 4 重要動詞"）を日本語で設定する。',
    '7. 単語が1つも読み取れない画像の場合は、items を空配列 [] として返す。',
  ].join('\n');

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: normalizedMime,
                data: cleanBase64,
              },
            },
            {
              text: 'この写真から英単語・熟語と日本語訳のペアをすべて抽出してください。',
            },
          ],
        },
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedTitle: {
                type: Type.STRING,
                description: '写真の内容から推測した単語帳のタイトル',
              },
              items: {
                type: Type.ARRAY,
                description: '抽出された英単語と日本語訳のペア一覧',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    english: {
                      type: Type.STRING,
                      description: '英単語または英語フレーズ',
                    },
                    japanese: {
                      type: Type.STRING,
                      description: '対応する日本語訳',
                    },
                    partOfSpeech: {
                      type: Type.STRING,
                      description: '品詞（名詞、動詞、形容詞など。不明時は空文字）',
                    },
                    phonetic: {
                      type: Type.STRING,
                      description: '発音記号（画像に記載がある場合のみ。なければ空文字）',
                    },
                  },
                  required: ['english', 'japanese'],
                },
              },
            },
            required: ['suggestedTitle', 'items'],
          },
        },
      })
    );

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      return { suggestedTitle: '新しい単語帳', items: [] };
    }

    const parsed = JSON.parse(rawText) as Partial<ExtractVocabResponse>;
    const sanitizedItems: ExtractedVocabItem[] = Array.isArray(parsed.items)
      ? parsed.items
          .filter(
            (item): item is ExtractedVocabItem =>
              Boolean(item) &&
              typeof item.english === 'string' &&
              item.english.trim().length > 0 &&
              typeof item.japanese === 'string'
          )
          .map((item) => ({
            english: item.english.trim(),
            japanese: item.japanese.trim() || '（訳を入力してください）',
            partOfSpeech:
              typeof item.partOfSpeech === 'string' ? item.partOfSpeech.trim() : '',
            phonetic: typeof item.phonetic === 'string' ? item.phonetic.trim() : '',
          }))
      : [];

    return {
      suggestedTitle:
        typeof parsed.suggestedTitle === 'string' && parsed.suggestedTitle.trim()
          ? parsed.suggestedTitle.trim()
          : '新しい単語帳',
      items: sanitizedItems,
    };
  } catch (err: unknown) {
    throw mapGeminiError(err);
  }
}
