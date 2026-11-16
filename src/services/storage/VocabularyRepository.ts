import {
  DEFAULT_PLAYER_SETTINGS,
  type PlayerSettings,
  type StudySession,
  type Wordbook,
} from '../../domain/vocab';

export interface VocabularyRepository {
  getAllWordbooks(): Promise<Wordbook[]>;
  saveWordbook(wordbook: Wordbook): Promise<void>;
  deleteWordbook(id: string): Promise<void>;
  getAllSessions(): Promise<StudySession[]>;
  addSession(session: StudySession): Promise<void>;
  clearSessions(): Promise<void>;
  getSettings(): Promise<PlayerSettings>;
  saveSettings(settings: PlayerSettings): Promise<void>;
}

const DB_NAME = 'photo-vocab-db';
const DB_VERSION = 1;
const STORE_WORDBOOKS = 'wordbooks';
const STORE_SESSIONS = 'sessions';
const STORE_SETTINGS = 'settings';
const SETTINGS_KEY = 'player-settings';

const LS_WORDBOOKS_KEY = 'photo_vocab_backup_wordbooks_v1';
const LS_SESSIONS_KEY = 'photo_vocab_backup_sessions_v1';
const LS_SETTINGS_KEY = 'photo_vocab_backup_settings_v1';

function safeLocalStorageGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeLocalStorageSet(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors in restricted storage environments
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore unsupported browser environments
  }
  return false;
}

class IndexedDBVocabularyRepository implements VocabularyRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_WORDBOOKS)) {
          db.createObjectStore(STORE_WORDBOOKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
    });
    return this.dbPromise;
  }

  private async runTx<T>(
    storeName: string,
    mode: IDBTransactionMode,
    op: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = op(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB transaction failed'));
    });
  }

  async getAllWordbooks(): Promise<Wordbook[]> {
    try {
      const rows = await this.runTx<Wordbook[]>(STORE_WORDBOOKS, 'readonly', (s) => s.getAll());
      if (rows.length === 0) {
        const backup = safeLocalStorageGet<Wordbook[]>(LS_WORDBOOKS_KEY, []);
        if (backup.length > 0) {
          for (const wb of backup) {
            await this.runTx(STORE_WORDBOOKS, 'readwrite', (s) => s.put(wb));
          }
          return backup.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        }
      }
      const sorted = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      safeLocalStorageSet(LS_WORDBOOKS_KEY, sorted);
      return sorted;
    } catch {
      const backup = safeLocalStorageGet<Wordbook[]>(LS_WORDBOOKS_KEY, []);
      return backup.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
  }

  async saveWordbook(wordbook: Wordbook): Promise<void> {
    try {
      await this.runTx(STORE_WORDBOOKS, 'readwrite', (s) => s.put(wordbook));
    } catch {
      // Fallback handled by localStorage mirror below
    }
    const existing = safeLocalStorageGet<Wordbook[]>(LS_WORDBOOKS_KEY, []);
    const next = [wordbook, ...existing.filter((w) => w.id !== wordbook.id)];
    safeLocalStorageSet(LS_WORDBOOKS_KEY, next);
  }

  async deleteWordbook(id: string): Promise<void> {
    try {
      await this.runTx(STORE_WORDBOOKS, 'readwrite', (s) => s.delete(id));
    } catch {
      // Fallback handled by localStorage mirror below
    }
    const existing = safeLocalStorageGet<Wordbook[]>(LS_WORDBOOKS_KEY, []);
    safeLocalStorageSet(
      LS_WORDBOOKS_KEY,
      existing.filter((w) => w.id !== id)
    );
  }

  async getAllSessions(): Promise<StudySession[]> {
    try {
      const rows = await this.runTx<StudySession[]>(STORE_SESSIONS, 'readonly', (s) => s.getAll());
      if (rows.length === 0) {
        const backup = safeLocalStorageGet<StudySession[]>(LS_SESSIONS_KEY, []);
        if (backup.length > 0) {
          for (const sess of backup) {
            await this.runTx(STORE_SESSIONS, 'readwrite', (s) => s.put(sess));
          }
          return backup.sort((a, b) => b.endedAt.localeCompare(a.endedAt));
        }
      }
      const sorted = [...rows].sort((a, b) => b.endedAt.localeCompare(a.endedAt));
      safeLocalStorageSet(LS_SESSIONS_KEY, sorted);
      return sorted;
    } catch {
      const backup = safeLocalStorageGet<StudySession[]>(LS_SESSIONS_KEY, []);
      return backup.sort((a, b) => b.endedAt.localeCompare(a.endedAt));
    }
  }

  async addSession(session: StudySession): Promise<void> {
    try {
      await this.runTx(STORE_SESSIONS, 'readwrite', (s) => s.put(session));
    } catch {
      // Fallback handled by localStorage mirror below
    }
    const existing = safeLocalStorageGet<StudySession[]>(LS_SESSIONS_KEY, []);
    const next = [session, ...existing.filter((s) => s.id !== session.id)].slice(0, 200);
    safeLocalStorageSet(LS_SESSIONS_KEY, next);
  }

  async clearSessions(): Promise<void> {
    try {
      await this.runTx(STORE_SESSIONS, 'readwrite', (s) => s.clear());
    } catch {
      // Fallback handled by localStorage mirror below
    }
    safeLocalStorageSet(LS_SESSIONS_KEY, []);
  }

  async getSettings(): Promise<PlayerSettings> {
    try {
      const saved = await this.runTx<PlayerSettings | undefined>(
        STORE_SETTINGS,
        'readonly',
        (s) => s.get(SETTINGS_KEY)
      );
      if (saved) {
        return { ...DEFAULT_PLAYER_SETTINGS, ...saved };
      }
    } catch {
      // Fallback to localStorage
    }
    const backup = safeLocalStorageGet<Partial<PlayerSettings>>(LS_SETTINGS_KEY, {});
    return { ...DEFAULT_PLAYER_SETTINGS, ...backup };
  }

  async saveSettings(settings: PlayerSettings): Promise<void> {
    try {
      await this.runTx(STORE_SETTINGS, 'readwrite', (s) => s.put(settings, SETTINGS_KEY));
    } catch {
      // Fallback handled by localStorage mirror below
    }
    safeLocalStorageSet(LS_SETTINGS_KEY, settings);
  }
}

export const vocabularyRepository: VocabularyRepository = new IndexedDBVocabularyRepository();
