import React, { useState } from 'react';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 active:scale-[0.98] whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        <span>アプリを追加</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap shrink-0"
        >
          <PlusSquare className="h-4 w-4 text-blue-600" aria-hidden="true" />
          <span>ホームに追加</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 shadow-2xl sm:rounded-3xl pb-safe">
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="ios-install-title" className="text-lg font-bold text-slate-900">
                    ホーム画面に追加する
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Safariから追加すると、オフラインでもアプリのように全画面で学習できます。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="閉じる"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ol className="mt-5 space-y-4 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 font-mono-num text-xs font-bold text-blue-700">
                    1
                  </span>
                  <div className="pt-0.5 leading-relaxed">
                    Safari画面下のツールバーにある
                    <span className="mx-1 inline-flex items-center gap-1 font-semibold text-slate-900">
                      <Share className="h-4 w-4 text-blue-600" aria-hidden="true" />
                      共有ボタン
                    </span>
                    をタップします。
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 font-mono-num text-xs font-bold text-blue-700">
                    2
                  </span>
                  <div className="pt-0.5 leading-relaxed">
                    メニューを下にスクロールし、
                    <span className="mx-1 inline-flex items-center gap-1 font-semibold text-slate-900">
                      <PlusSquare className="h-4 w-4 text-slate-700" aria-hidden="true" />
                      ホーム画面に追加
                    </span>
                    を選択します。
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 font-mono-num text-xs font-bold text-blue-700">
                    3
                  </span>
                  <div className="pt-0.5 leading-relaxed">
                    右上の<strong className="text-slate-900">「追加」</strong>をタップすると完了です。
                  </div>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
