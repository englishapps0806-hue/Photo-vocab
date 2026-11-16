import React, { useMemo, useState } from 'react';
import { Clock, Play, Trash2 } from 'lucide-react';
import {
  computeStudyStats,
  formatJapaneseDate,
  type StudySession,
} from '../domain/vocab';

interface HistoryViewProps {
  sessions: StudySession[];
  existingWordbookIds: Set<string>;
  onReplayWordbook: (wordbookId: string) => void;
  onClearHistory: () => Promise<void>;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}分${secs}秒` : `${mins}分`;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  sessions,
  existingWordbookIds,
  onReplayWordbook,
  onClearHistory,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const stats = useMemo(() => computeStudyStats(sessions), [sessions]);

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">学習回数</div>
          <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
            {stats.totalSessions}
            <span className="ml-1 text-xs font-normal text-slate-500">回</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">累計リスニング</div>
          <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
            {stats.totalWordsReviewed}
            <span className="ml-1 text-xs font-normal text-slate-500">語</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">学習時間</div>
          <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
            {stats.totalMinutes}
            <span className="ml-1 text-xs font-normal text-slate-500">分</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">連続学習</div>
          <div className="mt-1 font-mono-num text-2xl font-bold text-blue-600">
            {stats.streakDays}
            <span className="ml-1 text-xs font-normal text-slate-500">日</span>
          </div>
        </div>
      </div>

      {/* Session List */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">学習履歴</h2>

          {sessions.length > 0 && (
            <div>
              {confirmClear ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await onClearHistory();
                      setConfirmClear(false);
                    }}
                    className="min-h-[44px] rounded-xl bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700 whitespace-nowrap"
                  >
                    履歴を全削除
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[44px] rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                  >
                    キャンセル
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-600 whitespace-nowrap"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>履歴をクリア</span>
                </button>
              )}
            </div>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Clock className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700">
              まだ学習履歴がありません
            </p>
            <p className="mt-1 text-xs text-slate-500">
              「再生学習」で英単語の音声再生を行うと、自動的に記録されます。
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((session) => {
              const canReplay = existingWordbookIds.has(session.wordbookId);
              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-3 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-900">
                      {session.wordbookTitle}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatJapaneseDate(session.endedAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">
                        {session.wordsStudied}/{session.totalWordsInDeck}語
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">
                        {formatDuration(session.durationSeconds)}
                      </span>
                      {session.completedRound && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-emerald-700">1周完了</span>
                        </>
                      )}
                    </div>
                  </div>

                  {canReplay && (
                    <button
                      type="button"
                      onClick={() => onReplayWordbook(session.wordbookId)}
                      aria-label={`${session.wordbookTitle}をもう一度再生`}
                      className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Play className="h-3.5 w-3.5 fill-current text-blue-600" aria-hidden="true" />
                      <span>復習</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
