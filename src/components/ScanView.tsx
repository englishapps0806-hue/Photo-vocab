import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  Image as ImageIcon,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  createId,
  createWordbook,
  type ExtractedWordDraft,
  type Wordbook,
} from '../domain/vocab';
import {
  extractVocabularyFromImage,
  prepareImageForUpload,
} from '../services/vision/VisionExtractor';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface ScanViewProps {
  onSaveWordbook: (wordbook: Wordbook, startLearningImmediately: boolean) => Promise<void>;
}

type ScanStage = 'capture' | 'preview' | 'review';

export const ScanView: React.FC<ScanViewProps> = ({ onSaveWordbook }) => {
  const isOnline = useOnlineStatus();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<ScanStage>('capture');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [preparedImage, setPreparedImage] = useState<{
    base64: string;
    mimeType: string;
  } | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [drafts, setDrafts] = useState<ExtractedWordDraft[]>([]);

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setIsPreparing(true);
    try {
      const prepared = await prepareImageForUpload(file);
      setPreviewUrl(prepared.previewUrl);
      setPreparedImage({ base64: prepared.base64, mimeType: prepared.mimeType });
      setStage('preview');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '画像を読み込めませんでした。別の写真をお試しください。'
      );
    } finally {
      setIsPreparing(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (libraryInputRef.current) libraryInputRef.current.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!preparedImage) return;
    setError(null);
    setIsAnalyzing(true);
    try {
      const result = await extractVocabularyFromImage(
        preparedImage.base64,
        preparedImage.mimeType
      );
      if (result.items.length === 0) {
        setError(
          '英単語を読み取れませんでした。ページにピントを合わせて、明るい場所で撮り直してください。'
        );
        return;
      }
      setTitle(result.suggestedTitle);
      setDrafts(result.items);
      setStage('review');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '画像の解析中にエラーが発生しました。もう一度お試しください。'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setStage('capture');
    setPreviewUrl('');
    setPreparedImage(null);
    setTitle('');
    setDrafts([]);
    setError(null);
  };

  const handleUpdateDraft = (
    id: string,
    field: 'english' | 'japanese' | 'partOfSpeech' | 'phonetic',
    value: string
  ) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  const handleRemoveDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const handleAddEmptyDraft = () => {
    setDrafts((prev) => [
      ...prev,
      {
        id: createId('draft'),
        english: '',
        japanese: '',
        partOfSpeech: '',
        phonetic: '',
      },
    ]);
  };

  const handleSave = async (startLearning: boolean) => {
    const validDrafts = drafts
      .map((d) => ({
        ...d,
        english: d.english.trim(),
        japanese: d.japanese.trim(),
        partOfSpeech: d.partOfSpeech.trim(),
        phonetic: d.phonetic.trim(),
      }))
      .filter((d) => d.english.length > 0);

    if (validDrafts.length === 0) {
      setError('保存するには少なくとも1つの英単語が必要です。');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const wordbook = createWordbook(title || '新しい単語帳', validDrafts);
      await onSaveWordbook(wordbook, startLearning);
      handleReset();
    } catch {
      setError('単語帳の保存に失敗しました。空き容量を確認してください。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden native iPhone file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => void handleFileSelected(e.target.files?.[0])}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void handleFileSelected(e.target.files?.[0])}
      />

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      {stage === 'capture' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-7">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              単語帳をスキャンして作成
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              市販の単語帳・プリント・ノートを撮影または写真ライブラリから選ぶと、AIが英単語と日本語訳を自動で対応づけて読み取ります。
            </p>

            {!isOnline && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900">
                現在オフラインのため写真のAI解析は実行できません。オンライン復帰後にご利用ください。
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={isPreparing}
                onClick={() => cameraInputRef.current?.click()}
                className="flex min-h-[112px] flex-col items-center justify-center gap-2.5 rounded-2xl bg-blue-600 px-5 py-5 text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
              >
                {isPreparing ? (
                  <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
                ) : (
                  <Camera className="h-7 w-7" aria-hidden="true" />
                )}
                <span className="text-base font-bold">カメラで撮影</span>
                <span className="text-xs text-blue-100">単語帳のページを撮る</span>
              </button>

              <button
                type="button"
                disabled={isPreparing}
                onClick={() => libraryInputRef.current?.click()}
                className="flex min-h-[112px] flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 text-slate-900 transition-all hover:bg-slate-100 active:scale-[0.98] disabled:opacity-60"
              >
                <ImageIcon className="h-7 w-7 text-blue-600" aria-hidden="true" />
                <span className="text-base font-bold">写真ライブラリから選択</span>
                <span className="text-xs text-slate-500">保存済みの画像を使う</span>
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-5">
            <h3 className="text-sm font-bold text-slate-900">きれいに読み取るコツ</h3>
            <ul className="mt-4 space-y-3.5 text-sm text-slate-600">
              <li className="flex items-start gap-3">
                <span className="font-mono-num text-xs font-bold text-blue-600">01.</span>
                <span>英単語と日本語訳の両方が画面に収まるように真上から撮影します。</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-mono-num text-xs font-bold text-blue-600">02.</span>
                <span>影や照明の反射を避けると認識精度が上がります。</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-mono-num text-xs font-bold text-blue-600">03.</span>
                <span>読み取り後は一覧画面で単語や訳を自由に修正・追加できます。</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {stage === 'preview' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 lg:col-span-7">
            <img
              src={previewUrl}
              alt="選択された単語帳の写真"
              className="max-h-[420px] w-full object-contain"
            />
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">この写真から抽出しますか？</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Geminiの画像認識が英単語と日本語訳を自動でペアリングします。読み取り後に編集・修正できます。
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={isAnalyzing || !isOnline}
                onClick={() => void handleAnalyze()}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <span>英単語を解析中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                    <span>AIで英単語を読み取る</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleReset}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>別の写真を選び直す</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <label
                htmlFor="extracted-wb-title"
                className="block text-xs font-semibold text-slate-600"
              >
                単語帳のタイトル
              </label>
              <input
                id="extracted-wb-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="単語帳の名前を入力"
                className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2 text-base font-bold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>抽出結果</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num font-semibold text-slate-900">
                {drafts.length}語
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600">
              誤認識や訳の修正があればタップして編集できます
            </p>
            <button
              type="button"
              onClick={handleAddEmptyDraft}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>単語を追加</span>
            </button>
          </div>

          <div className="space-y-3">
            {drafts.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="font-mono-num text-xs font-semibold text-slate-400">
                    #{String(idx + 1).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDraft(item.id)}
                    aria-label={`${item.english || '行'}を削除`}
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
                      onChange={(e) => handleUpdateDraft(item.id, 'english', e.target.value)}
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 font-display text-base font-bold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500">
                      日本語訳
                    </label>
                    <input
                      type="text"
                      value={item.japanese}
                      onChange={(e) => handleUpdateDraft(item.id, 'japanese', e.target.value)}
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave(true)}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="h-5 w-5" aria-hidden="true" />
              <span>{isSaving ? '保存中...' : '保存して音声学習を始める'}</span>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSave(false)}
                className="flex min-h-[52px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                保存のみ
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleReset}
                className="flex min-h-[52px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                やり直す
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
