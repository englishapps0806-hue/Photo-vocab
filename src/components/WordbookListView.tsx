import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Camera,
  Pencil,
  Play,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { formatJapaneseDate, type Wordbook } from '../domain/vocab';

interface WordbookListViewProps {
  wordbooks: Wordbook[];
  activeWordbookId: string | null;
  onSelectAndPlay: (wordbookId: string) => void;
  onEditWordbook: (wordbook: Wordbook) => void;
  onDeleteWordbook: (wordbookId: string) => Promise<void>;
  onGoToScan: () => void;
  onLoadSampleWordbook: () => Promise<void>;
}

export const WordbookListView: React.FC<WordbookListViewProps> = ({
  wordbooks,
  activeWordbookId,
  onSelectAndPlay,
  onEditWordbook,
  onDeleteWordbook,
  onGoToScan,
  onLoadSampleWordbook,
}) => {
  const [query, setQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return wordbooks;
    return wordbooks.filter(
      (wb) =>
        wb.title.toLowerCase().includes(q) ||
        wb.items.some(
          (item) =>
            item.english.toLowerCase().includes(q) ||
            item.japanese.toLowerCase().includes(q)
        )
    );
  }, [query, wordbooks]);

  if (wordbooks.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <BookOpen className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">
          まだ単語帳がありません
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          単語帳のページを撮影してAIで自動作成するか、サンプル単語帳を読み込んで2秒間隔の英語音声リスニングを試してみましょう。
        </p>

        <div className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onGoToScan}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 whitespace-nowrap"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            <span>写真から作成する</span>
          </button>
          <button
            type="button"
            onClick={() => void onLoadSampleWordbook()}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span>サンプル10語を試す</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            保存した単語帳
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            端末内に保護保存され、オフラインでも学習できます
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToScan}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          <span>新しい写真をスキャン</span>
        </button>
      </div>

      {wordbooks.length >= 2 && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="単語帳名・英単語・日本語訳で検索"
            className="min-h-[48px] w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          「{query}」に一致する単語帳が見つかりませんでした。
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((wb) => {
            const total = wb.items.length;
            const masteredCount = wb.items.filter((i) => i.mastered).length;
            const progressPct = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
            const isActive = wb.id === activeWordbookId;
            const isConfirmingDelete = confirmDeleteId === wb.id;

            return (
              <article
                key={wb.id}
                className={`flex flex-col justify-between rounded-3xl border bg-white p-5 transition-colors ${
                  isActive ? 'border-blue-300 ring-2 ring-blue-500/15' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {wb.title}
                    </h3>
                    {isActive && (
                      <span className="shrink-0 text-xs font-semibold text-blue-600">
                        選択中
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono-num font-semibold text-slate-700">
                      {total}語
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      習得 <span className="font-mono-num">{masteredCount}/{total}</span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>最終学習 {formatJapaneseDate(wb.lastStudiedAt)}</span>
                  </div>

                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  {wb.items.length > 0 && (
                    <p className="mt-3 truncate text-xs text-slate-500">
                      {wb.items
                        .slice(0, 4)
                        .map((item) => item.english)
                        .join(' / ')}
                      {wb.items.length > 4 ? ' ...' : ''}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => onSelectAndPlay(wb.id)}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    <span>音声再生で学ぶ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onEditWordbook(wb)}
                    aria-label={`${wb.title}を編集`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteWordbook(wb.id);
                          setConfirmDeleteId(null);
                        }}
                        className="min-h-[44px] rounded-xl bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700 whitespace-nowrap"
                      >
                        削除実行
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[44px] rounded-xl border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(wb.id)}
                      aria-label={`${wb.title}を削除`}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
