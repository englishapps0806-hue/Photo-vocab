import React, { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  Pause,
  Pencil,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Square,
  Volume2,
} from 'lucide-react';
import type { PlaybackPhase, PlayerSettings, Wordbook, WordItem } from '../domain/vocab';
import type { VoiceOption } from '../services/speech/SpeechPlayer';

interface PlayerController {
  phase: PlaybackPhase;
  currentIndex: number;
  currentItem: WordItem | null;
  orderedItems: WordItem[];
  waitRemainingMs: number;
  voices: VoiceOption[];
  speechError: string | null;
  play: (indexOverride?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  togglePlayPause: () => void;
  nextWord: () => void;
  prevWord: () => void;
  speakSingleWord: (text: string) => void;
  setCurrentIndex: (idx: number) => void;
}

interface PlayerViewProps {
  wordbooks: Wordbook[];
  activeWordbook: Wordbook | null;
  onSelectWordbook: (wordbookId: string) => void;
  onEditWordbook: (wordbook: Wordbook) => void;
  onToggleMastered: (wordbookId: string, wordId: string) => Promise<void>;
  settings: PlayerSettings;
  onUpdateSettings: (partial: Partial<PlayerSettings>) => void;
  player: PlayerController;
  onGoToScan: () => void;
}

const SPEED_OPTIONS = [
  { label: '0.8x', value: 0.8 },
  { label: '0.95x', value: 0.95 },
  { label: '1.1x', value: 1.1 },
  { label: '1.25x', value: 1.25 },
];

export const PlayerView: React.FC<PlayerViewProps> = ({
  wordbooks,
  activeWordbook,
  onSelectWordbook,
  onEditWordbook,
  onToggleMastered,
  settings,
  onUpdateSettings,
  player,
  onGoToScan,
}) => {
  const [hideJapanese, setHideJapanese] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);

  if (!activeWordbook || wordbooks.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <BookOpen className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">
          再生する単語帳を選択してください
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          写真を撮影・選択して単語帳を作成すると、自然な英語発音と2秒のインターバルで連続リスニング学習ができます。
        </p>
        <button
          type="button"
          onClick={onGoToScan}
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
        >
          写真をスキャンして始める
        </button>
      </div>
    );
  }

  const {
    phase,
    currentIndex,
    currentItem,
    orderedItems,
    waitRemainingMs,
    voices,
    speechError,
    play,
    stop,
    togglePlayPause,
    nextWord,
    prevWord,
    speakSingleWord,
  } = player;

  const totalCount = orderedItems.length;
  const intervalMs = Math.round((settings.intervalSeconds || 2.0) * 1000);
  const waitProgressPct =
    phase === 'waiting' && intervalMs > 0
      ? Math.max(0, Math.min(100, ((intervalMs - waitRemainingMs) / intervalMs) * 100))
      : 0;

  const phaseLabel =
    phase === 'speaking'
      ? '読み上げ中'
      : phase === 'waiting'
      ? `次の単語まで ${(waitRemainingMs / 1000).toFixed(1)}s`
      : phase === 'paused'
      ? '一時停止中'
      : '待機中（2.0秒間隔）';

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left / Top Column: Active Flashcard + Playback Controls */}
      <div className="space-y-4 lg:col-span-7">
        {/* Wordbook Selector Row */}
        <div className="flex items-center justify-between gap-2">
          <select
            aria-label="学習する単語帳を選択"
            value={activeWordbook.id}
            onChange={(e) => onSelectWordbook(e.target.value)}
            className="min-h-[44px] flex-1 truncate rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
          >
            {wordbooks.map((wb) => (
              <option key={wb.id} value={wb.id}>
                {wb.title}（{wb.items.length}語）
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onEditWordbook(activeWordbook)}
            aria-label="この単語帳を編集"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowAudioSettings((prev) => !prev)}
            aria-label="音声・再生設定"
            aria-expanded={showAudioSettings}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-colors ${
              showAudioSettings
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        {speechError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <span>{speechError}</span>
          </div>
        )}

        {/* Collapsible Audio Settings Panel */}
        {showAudioSettings && (
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">音声・再生設定</h3>
              <span className="font-mono-num text-xs text-slate-500">
                単語間待機 {settings.intervalSeconds.toFixed(1)}秒
              </span>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-600">再生速度</span>
              <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-xl bg-slate-100 p-1">
                {SPEED_OPTIONS.map((opt) => {
                  const active = Math.abs(settings.speechRate - opt.value) < 0.03;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onUpdateSettings({ speechRate: opt.value })}
                      className={`min-h-[40px] rounded-lg font-mono-num text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="voice-select"
                className="block text-xs font-medium text-slate-600"
              >
                英語音声（iPhoneでは拡張音声がおすすめです）
              </label>
              <select
                id="voice-select"
                value={settings.preferredVoiceURI}
                onChange={(e) => onUpdateSettings({ preferredVoiceURI: e.target.value })}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
              >
                <option value="">自動選択（最も自然な英語音声）</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang}){v.isRecommended ? ' ★推奨' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  英語の後に日本語訳も読み上げる
                </div>
                <div className="text-[11px] text-slate-500">
                  読み上げ後、2秒待ってから次の単語へ進みます
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.speakJapaneseAfter}
                onClick={() =>
                  onUpdateSettings({ speakJapaneseAfter: !settings.speakJapaneseAfter })
                }
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
                  settings.speakJapaneseAfter ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-xs transition-transform ${
                    settings.speakJapaneseAfter ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Active Flashcard */}
        <section
          aria-label="現在の単語カード"
          className="relative flex min-h-[260px] flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:min-h-[300px] sm:p-8"
        >
          {/* Card Top Row */}
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-mono-num font-bold text-slate-900">
                {String(currentIndex + 1).padStart(2, '0')} /{' '}
                {String(totalCount).padStart(2, '0')}
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-medium ${
                  phase === 'speaking'
                    ? 'text-blue-600'
                    : phase === 'waiting'
                    ? 'font-mono-num text-amber-700'
                    : 'text-slate-500'
                }`}
              >
                {phaseLabel}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setHideJapanese((prev) => !prev)}
                aria-label={hideJapanese ? '日本語訳を表示する' : '日本語訳を隠す'}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 whitespace-nowrap"
              >
                {hideJapanese ? (
                  <>
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    <span>訳を表示</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                    <span>訳を隠す</span>
                  </>
                )}
              </button>

              {currentItem && (
                <button
                  type="button"
                  onClick={() => void onToggleMastered(activeWordbook.id, currentItem.id)}
                  aria-label={currentItem.mastered ? '習得済みを解除' : '習得済みにする'}
                  className={`inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    currentItem.mastered
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>{currentItem.mastered ? '習得済' : '覚えた'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Card Center: Word & Meaning */}
          {currentItem ? (
            <div className="my-6 text-center">
              {(currentItem.partOfSpeech || currentItem.phonetic) && (
                <div className="mb-2 flex items-center justify-center gap-2 text-xs text-slate-500">
                  {currentItem.partOfSpeech && <span>{currentItem.partOfSpeech}</span>}
                  {currentItem.partOfSpeech && currentItem.phonetic && (
                    <span aria-hidden="true">·</span>
                  )}
                  {currentItem.phonetic && (
                    <span className="font-mono-num">{currentItem.phonetic}</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center gap-2">
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl break-words">
                  {currentItem.english}
                </h2>
                <button
                  type="button"
                  onClick={() => speakSingleWord(currentItem.english)}
                  aria-label={`${currentItem.english}を発音`}
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-blue-600 hover:bg-blue-50"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 min-h-[32px]">
                {hideJapanese ? (
                  <button
                    type="button"
                    onClick={() => setHideJapanese(false)}
                    className="min-h-[44px] rounded-xl border border-dashed border-slate-300 px-4 py-2 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700"
                  >
                    タップして日本語訳を表示
                  </button>
                ) : (
                  <p className="text-lg font-semibold text-slate-700 sm:text-xl">
                    {currentItem.japanese}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-slate-500">
              この単語帳には単語がありません。
            </div>
          )}

          {/* Card Bottom: 2-Second Interval Progress Bar */}
          <div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  phase === 'waiting'
                    ? 'bg-amber-500 duration-75'
                    : phase === 'speaking'
                    ? 'w-full bg-blue-600 duration-200'
                    : 'bg-slate-300 duration-200'
                }`}
                style={
                  phase === 'waiting'
                    ? { width: `${waitProgressPct}%` }
                    : phase === 'speaking'
                    ? { width: '100%' }
                    : { width: '0%' }
                }
              />
            </div>
          </div>
        </section>

        {/* Thumb-Zone Playback Controls */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onUpdateSettings({ shuffleMode: !settings.shuffleMode })}
              aria-label="シャッフル再生を切り替え"
              aria-pressed={settings.shuffleMode}
              className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl transition-colors ${
                settings.shuffleMode
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              <Shuffle className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={prevWord}
              aria-label="前の単語"
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl text-slate-700 hover:bg-slate-100 active:scale-95"
            >
              <SkipBack className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={togglePlayPause}
              aria-label={
                phase === 'speaking' || phase === 'waiting'
                  ? '一時停止'
                  : phase === 'paused'
                  ? '再生を再開'
                  : '再生を開始'
              }
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
            >
              {phase === 'speaking' || phase === 'waiting' ? (
                <Pause className="h-7 w-7 fill-current" />
              ) : (
                <Play className="ml-0.5 h-7 w-7 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={nextWord}
              aria-label="次の単語"
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl text-slate-700 hover:bg-slate-100 active:scale-95"
            >
              <SkipForward className="h-6 w-6" />
            </button>

            {phase !== 'idle' ? (
              <button
                type="button"
                onClick={stop}
                aria-label="停止して履歴を保存"
                className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <Square className="h-5 w-5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onUpdateSettings({ loopDeck: !settings.loopDeck })}
                aria-label="リピート再生を切り替え"
                aria-pressed={settings.loopDeck}
                className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl transition-colors ${
                  settings.loopDeck
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <Repeat className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-slate-500">
            <span>
              {phase === 'paused'
                ? '再生ボタンで続きから再開'
                : '1語読み上げ後、2秒待って次の単語を読みます'}
            </span>
          </div>
        </div>
      </div>

      {/* Right / Bottom Column: Word Queue */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-5">
        <div className="mb-3 flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-900">収録単語一覧</h3>
          <span className="font-mono-num text-xs text-slate-500">{totalCount}語</span>
        </div>

        <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
          {orderedItems.map((item, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => play(idx)}
                className={`flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  isCurrent ? 'bg-blue-50/90' : 'hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num text-xs font-medium text-slate-400">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={`truncate font-display text-sm font-bold ${
                        isCurrent ? 'text-blue-700' : 'text-slate-900'
                      }`}
                    >
                      {item.english}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate pl-6 text-xs text-slate-500">
                    {hideJapanese ? '（非表示中）' : item.japanese}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {item.mastered && (
                    <CheckCircle2
                      className="h-4 w-4 text-emerald-600"
                      aria-label="習得済み"
                    />
                  )}
                  <Volume2
                    className={`h-4 w-4 ${
                      isCurrent ? 'text-blue-600' : 'text-slate-300'
                    }`}
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
