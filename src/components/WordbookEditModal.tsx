import React, { useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { createWordItem, type Wordbook, type WordItem } from '../domain/vocab';

interface WordbookEditModalProps {
  wordbook: Wordbook;
  onSave: (updated: Wordbook) => Promise<void>;
  onClose: () => void;
}

export const WordbookEditModal: React.FC<WordbookEditModalProps> = ({
  wordbook,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(wordbook.title);
  const [items, setItems] = useState<WordItem[]>(() =>
    wordbook.items.map((item) => ({ ...item }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdateItem = (
    id: string,
    field: 'english' | 'japanese' | 'partOfSpeech' | 'phonetic',
    value: string
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      createWordItem({ english: '', japanese: '', partOfSpeech: '', phonetic: '' }),
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = items
      .map((item) => ({
        ...item,
        english: item.english.trim(),
        japanese: item.japanese.trim(),
        partOfSpeech: (item.partOfSpeech ?? '').trim(),
        phonetic: (item.phonetic ?? '').trim(),
      }))
      .filter((item) => item.english.length > 0);

    if (cleaned.length === 0) {
      setError('少なくとも1つの英単語を入力してください。');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...wordbook,
        title: title.trim() || '無題の単語帳',
        updatedAt: new Date().toISOString(),
        items: cleaned,
      });
      onClose();
    } catch {
      setError('保存中にエラーが発生しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-wordbook-heading"
    >
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-md pt-safe">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
            aria-label="編集をキャンセル"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 id="edit-wordbook-heading" className="text-base font-bold text-slate-900">
            単語帳を編集
          </h2>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{saving ? '保存中...' : '保存'}</span>
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-5 pb-28">
        <div className="mx-auto max-w-4xl space-y-5">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="edit-wb-title"
              className="block text-xs font-semibold text-slate-600"
            >
              単語帳タイトル
            </label>
            <input
              id="edit-wb-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: TOEIC 頻出動詞"
              className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-base font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                単語リスト（<span className="font-mono-num">{items.length}</span>語）
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>単語を追加</span>
              </button>
            </div>

            {items.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono-num text-xs font-semibold text-slate-400">
                    #{String(idx + 1).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    aria-label={`${item.english || 'この単語'}を削除`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-500">
                      英単語・フレーズ
                    </label>
                    <input
                      type="text"
                      value={item.english}
                      onChange={(e) => handleUpdateItem(item.id, 'english', e.target.value)}
                      placeholder="例: implement"
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 font-display text-base font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500">
                      日本語訳
                    </label>
                    <input
                      type="text"
                      value={item.japanese}
                      onChange={(e) => handleUpdateItem(item.id, 'japanese', e.target.value)}
                      placeholder="例: 実行する、導入する"
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500">
                      品詞（任意）
                    </label>
                    <input
                      type="text"
                      value={item.partOfSpeech ?? ''}
                      onChange={(e) => handleUpdateItem(item.id, 'partOfSpeech', e.target.value)}
                      placeholder="動詞 / 名詞 など"
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500">
                      発音記号（任意）
                    </label>
                    <input
                      type="text"
                      value={item.phonetic ?? ''}
                      onChange={(e) => handleUpdateItem(item.id, 'phonetic', e.target.value)}
                      placeholder="/ˈɪmplɪment/"
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 font-mono-num text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
};
