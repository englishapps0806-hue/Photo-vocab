import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createId,
  type PlaybackPhase,
  type PlayerSettings,
  type StudySession,
  type Wordbook,
  type WordItem,
} from '../domain/vocab';
import { speechPlayer, type VoiceOption } from '../services/speech/SpeechPlayer';

interface UseVocabPlayerOptions {
  wordbook: Wordbook | null;
  settings: PlayerSettings;
  onWordReviewed?: (wordbookId: string, wordId: string) => void;
  onSessionRecorded?: (session: StudySession) => void;
}

export function useVocabPlayer({
  wordbook,
  settings,
  onWordReviewed,
  onSessionRecorded,
}: UseVocabPlayerOptions) {
  const [phase, setPhase] = useState<PlaybackPhase>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [waitRemainingMs, setWaitRemainingMs] = useState(0);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([]);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const runTokenRef = useRef(0);
  const waitIntervalRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const studiedWordIdsRef = useRef<Set<string>>(new Set());
  const pausedDuringWaitRef = useRef(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const onWordReviewedRef = useRef(onWordReviewed);
  onWordReviewedRef.current = onWordReviewed;

  const onSessionRecordedRef = useRef(onSessionRecorded);
  onSessionRecordedRef.current = onSessionRecorded;

  const items = wordbook?.items ?? [];

  // Rebuild shuffle order when wordbook or shuffle setting changes
  useEffect(() => {
    const indices = items.map((_, i) => i);
    if (settings.shuffleMode) {
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
    }
    setShuffleOrder(indices);
  }, [wordbook?.id, items.length, settings.shuffleMode]);

  const orderedItems: WordItem[] = useMemo(() => {
    if (shuffleOrder.length !== items.length) return items;
    return shuffleOrder.map((idx) => items[idx]).filter(Boolean);
  }, [items, shuffleOrder]);

  const orderedItemsRef = useRef(orderedItems);
  orderedItemsRef.current = orderedItems;

  const wordbookRef = useRef(wordbook);
  wordbookRef.current = wordbook;

  // Load voices (iOS Safari fires voiceschanged asynchronously)
  useEffect(() => {
    const refreshVoices = () => {
      setVoices(speechPlayer.getEnglishVoices());
    };
    refreshVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices);
      };
    }
    return undefined;
  }, []);

  const clearWaitTimer = useCallback(() => {
    if (waitIntervalRef.current !== null) {
      window.clearInterval(waitIntervalRef.current);
      waitIntervalRef.current = null;
    }
  }, []);

  const flushSessionIfNeeded = useCallback((completedRound: boolean) => {
    const wb = wordbookRef.current;
    const startedAtMs = sessionStartRef.current;
    const count = studiedWordIdsRef.current.size;

    if (wb && startedAtMs && count > 0) {
      const endedAtMs = Date.now();
      const durationSeconds = Math.max(1, Math.round((endedAtMs - startedAtMs) / 1000));
      const session: StudySession = {
        id: createId('sess'),
        wordbookId: wb.id,
        wordbookTitle: wb.title,
        wordsStudied: count,
        totalWordsInDeck: wb.items.length,
        durationSeconds,
        completedRound,
        startedAt: new Date(startedAtMs).toISOString(),
        endedAt: new Date(endedAtMs).toISOString(),
      };
      onSessionRecordedRef.current?.(session);
    }

    sessionStartRef.current = null;
    studiedWordIdsRef.current.clear();
  }, []);

  const stop = useCallback(() => {
    runTokenRef.current += 1;
    clearWaitTimer();
    speechPlayer.stop();
    pausedDuringWaitRef.current = false;
    setWaitRemainingMs(0);
    setPhase('idle');
    flushSessionIfNeeded(false);
  }, [clearWaitTimer, flushSessionIfNeeded]);

  // Stop cleanly when switching wordbooks
  useEffect(() => {
    stop();
    setCurrentIndex(0);
  }, [wordbook?.id, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runTokenRef.current += 1;
      clearWaitTimer();
      speechPlayer.stop();
      flushSessionIfNeeded(false);
    };
  }, [clearWaitTimer, flushSessionIfNeeded]);

  const waitWithCountdown = useCallback(
    (durationMs: number, token: number): Promise<boolean> => {
      return new Promise((resolve) => {
        clearWaitTimer();
        const start = Date.now();
        setWaitRemainingMs(durationMs);

        waitIntervalRef.current = window.setInterval(() => {
          if (runTokenRef.current !== token) {
            clearWaitTimer();
            resolve(false);
            return;
          }
          const elapsed = Date.now() - start;
          const remaining = Math.max(0, durationMs - elapsed);
          setWaitRemainingMs(remaining);
          if (remaining <= 0) {
            clearWaitTimer();
            resolve(true);
          }
        }, 50);
      });
    },
    [clearWaitTimer]
  );

  const runFromIndex = useCallback(
    async (startIndex: number, startWithWaitMs = 0) => {
      const deck = orderedItemsRef.current;
      const wb = wordbookRef.current;
      if (!wb || deck.length === 0) return;

      if (!speechPlayer.isSupported()) {
        setSpeechError('お使いのブラウザは音声読み上げに対応していません。Safariの最新版をお試しください。');
        return;
      }

      setSpeechError(null);
      runTokenRef.current += 1;
      const token = runTokenRef.current;

      if (!sessionStartRef.current) {
        sessionStartRef.current = Date.now();
      }

      let idx = Math.max(0, Math.min(startIndex, deck.length - 1));

      if (startWithWaitMs > 0) {
        setPhase('waiting');
        pausedDuringWaitRef.current = false;
        const ok = await waitWithCountdown(startWithWaitMs, token);
        if (!ok || runTokenRef.current !== token) return;
        idx += 1;
        if (idx >= orderedItemsRef.current.length) {
          if (settingsRef.current.loopDeck) {
            idx = 0;
          } else {
            flushSessionIfNeeded(true);
            setPhase('idle');
            setCurrentIndex(0);
            setWaitRemainingMs(0);
            return;
          }
        }
      }

      while (runTokenRef.current === token) {
        const currentDeck = orderedItemsRef.current;
        if (idx >= currentDeck.length) {
          if (settingsRef.current.loopDeck) {
            idx = 0;
          } else {
            flushSessionIfNeeded(true);
            setPhase('idle');
            setCurrentIndex(0);
            setWaitRemainingMs(0);
            return;
          }
        }

        const item = currentDeck[idx];
        if (!item) break;

        setCurrentIndex(idx);
        setPhase('speaking');
        setWaitRemainingMs(0);
        pausedDuringWaitRef.current = false;

        try {
          await speechPlayer.speak({
            text: item.english,
            lang: 'en-US',
            rate: settingsRef.current.speechRate,
            preferredVoiceURI: settingsRef.current.preferredVoiceURI,
          });
        } catch (err) {
          if (runTokenRef.current !== token) return;
          setSpeechError(err instanceof Error ? err.message : '音声の再生に失敗しました。');
          setPhase('idle');
          return;
        }

        if (runTokenRef.current !== token) return;

        studiedWordIdsRef.current.add(item.id);
        if (wordbookRef.current) {
          onWordReviewedRef.current?.(wordbookRef.current.id, item.id);
        }

        // Optional Japanese meaning spoken after English word
        if (settingsRef.current.speakJapaneseAfter && item.japanese.trim()) {
          await new Promise((r) => window.setTimeout(r, 300));
          if (runTokenRef.current !== token) return;
          await speechPlayer.speak({
            text: item.japanese,
            lang: 'ja-JP',
            rate: 1.0,
          });
          if (runTokenRef.current !== token) return;
        }

        // Mandatory 2-second wait after word reading finishes before next word
        const hasNext = idx + 1 < orderedItemsRef.current.length || settingsRef.current.loopDeck;
        if (!hasNext) {
          flushSessionIfNeeded(true);
          setPhase('idle');
          setWaitRemainingMs(0);
          return;
        }

        const intervalMs = Math.round((settingsRef.current.intervalSeconds || 2.0) * 1000);
        setPhase('waiting');
        pausedDuringWaitRef.current = false;
        const completedWait = await waitWithCountdown(intervalMs, token);
        if (!completedWait || runTokenRef.current !== token) return;

        idx += 1;
      }
    },
    [flushSessionIfNeeded, waitWithCountdown]
  );

  const play = useCallback(
    (indexOverride?: number) => {
      speechPlayer.unlockAudio();
      const targetIndex =
        typeof indexOverride === 'number' ? indexOverride : currentIndex;
      void runFromIndex(targetIndex, 0);
    },
    [currentIndex, runFromIndex]
  );

  const pause = useCallback(() => {
    if (phase !== 'speaking' && phase !== 'waiting') return;
    const wasWaiting = phase === 'waiting';
    runTokenRef.current += 1;
    clearWaitTimer();
    speechPlayer.stop();
    pausedDuringWaitRef.current = wasWaiting;
    setPhase('paused');
  }, [clearWaitTimer, phase]);

  const resume = useCallback(() => {
    if (phase !== 'paused') return;
    speechPlayer.unlockAudio();
    if (pausedDuringWaitRef.current && waitRemainingMs > 150) {
      void runFromIndex(currentIndex, waitRemainingMs);
    } else if (pausedDuringWaitRef.current) {
      const nextIdx =
        currentIndex + 1 < orderedItemsRef.current.length
          ? currentIndex + 1
          : settingsRef.current.loopDeck
          ? 0
          : currentIndex;
      void runFromIndex(nextIdx, 0);
    } else {
      void runFromIndex(currentIndex, 0);
    }
  }, [currentIndex, phase, runFromIndex, waitRemainingMs]);

  const togglePlayPause = useCallback(() => {
    if (phase === 'speaking' || phase === 'waiting') {
      pause();
    } else if (phase === 'paused') {
      resume();
    } else {
      play(currentIndex);
    }
  }, [currentIndex, pause, phase, play, resume]);

  const nextWord = useCallback(() => {
    if (orderedItems.length === 0) return;
    const nextIdx = (currentIndex + 1) % orderedItems.length;
    setCurrentIndex(nextIdx);
    if (phase === 'speaking' || phase === 'waiting') {
      speechPlayer.unlockAudio();
      void runFromIndex(nextIdx, 0);
    } else if (phase === 'paused') {
      pausedDuringWaitRef.current = false;
      setWaitRemainingMs(0);
    }
  }, [currentIndex, orderedItems.length, phase, runFromIndex]);

  const prevWord = useCallback(() => {
    if (orderedItems.length === 0) return;
    const prevIdx = (currentIndex - 1 + orderedItems.length) % orderedItems.length;
    setCurrentIndex(prevIdx);
    if (phase === 'speaking' || phase === 'waiting') {
      speechPlayer.unlockAudio();
      void runFromIndex(prevIdx, 0);
    } else if (phase === 'paused') {
      pausedDuringWaitRef.current = false;
      setWaitRemainingMs(0);
    }
  }, [currentIndex, orderedItems.length, phase, runFromIndex]);

  const speakSingleWord = useCallback((text: string) => {
    speechPlayer.unlockAudio();
    runTokenRef.current += 1;
    clearWaitTimer();
    setPhase('idle');
    setWaitRemainingMs(0);
    void speechPlayer.speak({
      text,
      lang: 'en-US',
      rate: settingsRef.current.speechRate,
      preferredVoiceURI: settingsRef.current.preferredVoiceURI,
    });
  }, [clearWaitTimer]);

  const currentItem = orderedItems[currentIndex] ?? null;

  return {
    phase,
    currentIndex,
    currentItem,
    orderedItems,
    waitRemainingMs,
    voices,
    speechError,
    play,
    pause,
    resume,
    stop,
    togglePlayPause,
    nextWord,
    prevWord,
    speakSingleWord,
    setCurrentIndex,
  };
}
