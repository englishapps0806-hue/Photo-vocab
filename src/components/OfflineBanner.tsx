import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-2">
        <WifiOff className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <span className="leading-snug">
          オフラインモード：保存済みの単語帳・音声再生・学習履歴は引き続き利用できます（写真解析はオンライン時に利用可能）。
        </span>
      </div>
    </div>
  );
};
