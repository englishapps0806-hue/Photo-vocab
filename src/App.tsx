import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Camera, History, Volume2 } from 'lucide-react';
import {
  createSampleWordbook,
  DEFAULT_PLAYER_SETTINGS,
  type PlayerSettings,
  type StudySession,
  type Wordbook,
} from './domain/vocab';
import {
  requestPersistentStorage,
  vocabularyRepository,
} from './services/storage/VocabularyRepository';
import { useVocabPlayer } from './hooks/useVocabPlayer';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineBanner } from './components/OfflineBanner';
import { WordbookListView } from './components/WordbookListView';
import { ScanView } from './components/ScanView';
import { PlayerView } from './components/PlayerView';
import { HistoryView } from './components/HistoryView';
import { WordbookEditModal } from './components/WordbookEditModal';

type TabId = 'library' | 'scan' | 'player' | 'history';

const NAV_ITEMS: Array<{ id: TabId; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'library', label: '単語帳', icon: BookOpen },
  { id: 'scan', label: 'スキャン', icon: Camera },
  { id: 'player', label: '再生学習', icon: Volume2 },
  { id: 'history', label: '履歴', icon: History },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('library');
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_PLAYER_SETTINGS);
  const [activeWordbookId, setActiveWordbookId] = useState<string | null>(null);
  const [editingWordbook, setEditingWordbook] = useState<Wordbook | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      void requestPersistentStorage();
      const [loadedWbs, loadedSessions, loadedSettings] = await Promise.all([
        vocabularyRepository.getAllWordbooks(),
        vocabularyRepository.getAllSessions(),
        vocabularyRepository.getSettings(),
      ]);
      if (!mounted) return;
      setWordbooks(loadedWbs);
      setSessions(loadedSessions);
      setSettings(loadedSettings);
      if (loadedWbs.length > 0) {
        setActiveWordbookId(loadedWbs[0].id);
      }
      setIsLoaded(true);
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const activeWordbook = useMemo(
    () => wordbooks.find((wb) => wb.id === activeWordbookId) ?? wordbooks[0] ?? null,
    [activeWordbookId, wordbooks]
  );

  const existingWordbookIds = useMemo(
    () => new Set(wordbooks.map((wb) => wb.id)),
    [wordbooks]
  );

  const handleWordReviewed = useCallback((wordbookId: string, wordId: string) => {
    const now = new Date().toISOString();
    setWordbooks((prev) => {
      const updatedList = prev.map((wb) => {
        if (wb.id !== wordbookId) return wb;
        const updatedWb: Wordbook = {
          ...wb,
          lastStudiedAt: now,
          items: wb.items.map((item) =>
            item.id === wordId
              ? { ...item, reviewCount: item.reviewCount + 1, lastReviewedAt: now }
              : item
          ),
        };
        void vocabularyRepository.saveWordbook(updatedWb);
        return updatedWb;
      });
      return updatedList;
    });
  }, []);

  const handleSessionRecorded = useCallback((session: StudySession) => {
    setSessions((prev) => [session, ...prev]);
    void vocabularyRepository.addSession(session);
  }, []);

  const player = useVocabPlayer({
    wordbook: activeWordbook,
    settings,
    onWordReviewed: handleWordReviewed,
    onSessionRecorded: handleSessionRecorded,
  });

  const handleSaveNewWordbook = async (
    wordbook: Wordbook,
    startLearningImmediately: boolean
  ) => {
    await vocabularyRepository.saveWordbook(wordbook);
    setWordbooks((prev) => [wordbook, ...prev]);
    setActiveWordbookId(wordbook.id);
    setActiveTab(startLearningImmediately ? 'player' : 'library');
  };

  const handleUpdateWordbook = async (updated: Wordbook) => {
    await vocabularyRepository.saveWordbook(updated);
    setWordbooks((prev) =>
      prev.map((wb) => (wb.id === updated.id ? updated : wb))
    );
  };

  const handleDeleteWordbook = async (wordbookId: string) => {
    if (activeWordbook?.id === wordbookId) {
      player.stop();
    }
    await vocabularyRepository.deleteWordbook(wordbookId);
    setWordbooks((prev) => {
      const remaining = prev.filter((wb) => wb.id !== wordbookId);
      if (activeWordbookId === wordbookId) {
        setActiveWordbookId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
  };

  const handleToggleMastered = async (wordbookId: string, wordId: string) => {
    const target = wordbooks.find((wb) => wb.id === wordbookId);
    if (!target) return;
    const updated: Wordbook = {
      ...target,
      updatedAt: new Date().toISOString(),
      items: target.items.map((item) =>
        item.id === wordId ? { ...item, mastered: !item.mastered } : item
      ),
    };
    await handleUpdateWordbook(updated);
  };

  const handleUpdateSettings = (partial: Partial<PlayerSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      void vocabularyRepository.saveSettings(next);
      return next;
    });
  };

  const handleSelectAndPlay = (wordbookId: string) => {
    setActiveWordbookId(wordbookId);
    setActiveTab('player');
  };

  const handleLoadSample = async () => {
    const sample = createSampleWordbook();
    await vocabularyRepository.saveWordbook(sample);
    setWordbooks((prev) => [sample, ...prev]);
    setActiveWordbookId(sample.id);
    setActiveTab('player');
  };

  const handleClearHistory = async () => {
    await vocabularyRepository.clearSessions();
    setSessions([]);
  };

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 flex flex-col">
      {/* Sticky Top Bar (3-zone contract on desktop, compact 52px header on iPhone) */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md pt-safe">
        <div className="mx-auto flex h-[52px] max-w-5xl items-center justify-between gap-8 px-4 lg:h-16 lg:px-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Photo Vocab
          </button>

          {/* Zone 2: Desktop single-line text nav links */}
          <nav
            aria-label="メインナビゲーション"
            className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-600"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-2 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary/install action */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => setActiveTab('scan')}
              className="hidden lg:inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              <span>写真をスキャン</span>
            </button>
          </div>
        </div>
      </header>

      <OfflineBanner />

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-24 lg:px-6 lg:py-8 lg:pb-10">
        {!isLoaded ? (
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
            読み込み中...
          </div>
        ) : (
          <>
            {activeTab === 'library' && (
              <WordbookListView
                wordbooks={wordbooks}
                activeWordbookId={activeWordbook?.id ?? null}
                onSelectAndPlay={handleSelectAndPlay}
                onEditWordbook={(wb) => setEditingWordbook(wb)}
                onDeleteWordbook={handleDeleteWordbook}
                onGoToScan={() => setActiveTab('scan')}
                onLoadSampleWordbook={handleLoadSample}
              />
            )}

            {activeTab === 'scan' && (
              <ScanView onSaveWordbook={handleSaveNewWordbook} />
            )}

            {activeTab === 'player' && (
              <PlayerView
                wordbooks={wordbooks}
                activeWordbook={activeWordbook}
                onSelectWordbook={(id) => setActiveWordbookId(id)}
                onEditWordbook={(wb) => setEditingWordbook(wb)}
                onToggleMastered={handleToggleMastered}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                player={player}
                onGoToScan={() => setActiveTab('scan')}
              />
            )}

            {activeTab === 'history' && (
              <HistoryView
                sessions={sessions}
                existingWordbookIds={existingWordbookIds}
                onReplayWordbook={handleSelectAndPlay}
                onClearHistory={handleClearHistory}
              />
            )}
          </>
        )}
      </main>

      {/* Fixed Bottom Tab Bar on Mobile / iPhone (< lg) */}
      <nav
        aria-label="モバイルナビゲーション"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/90 bg-white/95 backdrop-blur-md pb-safe lg:hidden"
      >
        <div className="grid h-[58px] grid-cols-4 items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon
                  className={`h-[21px] w-[21px] ${isActive ? 'stroke-[2.4]' : 'stroke-[1.9]'}`}
                  aria-hidden="true"
                />
                <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Edit Modal for saved wordbooks */}
      {editingWordbook && (
        <WordbookEditModal
          wordbook={editingWordbook}
          onSave={handleUpdateWordbook}
          onClose={() => setEditingWordbook(null)}
        />
      )}
    </div>
  );
}
