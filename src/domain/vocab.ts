export interface WordItem {
  id: string;
  english: string;
  japanese: string;
  partOfSpeech?: string;
  phonetic?: string;
  mastered: boolean;
  reviewCount: number;
  lastReviewedAt?: string;
}

export interface Wordbook {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastStudiedAt?: string;
  items: WordItem[];
}

export interface StudySession {
  id: string;
  wordbookId: string;
  wordbookTitle: string;
  wordsStudied: number;
  totalWordsInDeck: number;
  durationSeconds: number;
  completedRound: boolean;
  startedAt: string;
  endedAt: string;
}

export interface PlayerSettings {
  speechRate: number; // 0.75 - 1.25
  intervalSeconds: number; // Default 2.0s per spec
  speakJapaneseAfter: boolean;
  loopDeck: boolean;
  shuffleMode: boolean;
  preferredVoiceURI: string;
}

export type PlaybackPhase = 'idle' | 'speaking' | 'waiting' | 'paused';

export interface ExtractedWordDraft {
  id: string;
  english: string;
  japanese: string;
  partOfSpeech: string;
  phonetic: string;
}

export interface StudySummaryStats {
  totalSessions: number;
  totalWordsReviewed: number;
  totalMinutes: number;
  streakDays: number;
}

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  speechRate: 0.95,
  intervalSeconds: 2.0,
  speakJapaneseAfter: false,
  loopDeck: false,
  shuffleMode: false,
  preferredVoiceURI: '',
};

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createWordItem(draft: {
  english: string;
  japanese: string;
  partOfSpeech?: string;
  phonetic?: string;
}): WordItem {
  return {
    id: createId('w'),
    english: draft.english.trim(),
    japanese: draft.japanese.trim(),
    partOfSpeech: draft.partOfSpeech?.trim() || '',
    phonetic: draft.phonetic?.trim() || '',
    mastered: false,
    reviewCount: 0,
  };
}

export function createWordbook(
  title: string,
  drafts: Array<{ english: string; japanese: string; partOfSpeech?: string; phonetic?: string }>
): Wordbook {
  const now = new Date().toISOString();
  return {
    id: createId('wb'),
    title: title.trim() || '無題の単語帳',
    createdAt: now,
    updatedAt: now,
    items: drafts
      .filter((d) => d.english.trim().length > 0)
      .map((d) => createWordItem(d)),
  };
}

export function computeStudyStats(sessions: StudySession[]): StudySummaryStats {
  const totalSessions = sessions.length;
  const totalWordsReviewed = sessions.reduce((acc, s) => acc + s.wordsStudied, 0);
  const totalSeconds = sessions.reduce((acc, s) => acc + s.durationSeconds, 0);
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));

  const daySet = new Set(
    sessions.map((s) => {
      const d = new Date(s.endedAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
    })
  );

  let streakDays = 0;
  if (daySet.size > 0) {
    const cursor = new Date();
    const todayKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (!daySet.has(todayKey)) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (true) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (daySet.has(key)) {
        streakDays += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return {
    totalSessions,
    totalWordsReviewed,
    totalMinutes,
    streakDays,
  };
}

export function formatJapaneseDate(isoString?: string): string {
  if (!isoString) return '未学習';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '未学習';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function createSampleWordbook(): Wordbook {
  return createWordbook('サンプル: 日常・ビジネス必須10語', [
    { english: 'implement', japanese: '実行する、導入する', partOfSpeech: '動詞', phonetic: '/ˈɪmplɪment/' },
    { english: 'sustainable', japanese: '持続可能な', partOfSpeech: '形容詞', phonetic: '/səˈsteɪnəbl/' },
    { english: 'priority', japanese: '優先事項', partOfSpeech: '名詞', phonetic: '/praɪˈɒrəti/' },
    { english: 'negotiate', japanese: '交渉する', partOfSpeech: '動詞', phonetic: '/nɪˈɡəʊʃieɪt/' },
    { english: 'efficient', japanese: '効率的な', partOfSpeech: '形容詞', phonetic: '/ɪˈfɪʃnt/' },
    { english: 'clarify', japanese: '明確にする', partOfSpeech: '動詞', phonetic: '/ˈklærəfaɪ/' },
    { english: 'perspective', japanese: '視点、見方', partOfSpeech: '名詞', phonetic: '/pəˈspektɪv/' },
    { english: 'collaborate', japanese: '協力する、共同作業する', partOfSpeech: '動詞', phonetic: '/kəˈlæbəreɪt/' },
    { english: 'reliable', japanese: '信頼できる', partOfSpeech: '形容詞', phonetic: '/rɪˈlaɪəbl/' },
    { english: 'accomplish', japanese: '成し遂げる、達成する', partOfSpeech: '動詞', phonetic: '/əˈkʌmplɪʃ/' },
  ]);
}
