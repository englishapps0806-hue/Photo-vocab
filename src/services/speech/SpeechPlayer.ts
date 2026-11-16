export interface VoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  isRecommended: boolean;
}

export interface SpeakOptions {
  text: string;
  lang: 'en-US' | 'ja-JP';
  rate: number;
  preferredVoiceURI?: string;
}

export interface SpeechPlayer {
  isSupported(): boolean;
  unlockAudio(): void;
  getEnglishVoices(): VoiceOption[];
  speak(options: SpeakOptions): Promise<void>;
  stop(): void;
}

const PREFERRED_EN_VOICE_KEYWORDS = [
  'samantha (enhanced)',
  'ava (enhanced)',
  'allison (enhanced)',
  'samantha',
  'ava',
  'allison',
  'alex',
  'daniel',
  'karen',
  'google us english',
  'google uk english',
  'aria',
  'jenny',
  'siri',
  'natural',
  'enhanced',
  'premium',
];

function scoreEnglishVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;

  if (lang === 'en-us') score += 50;
  else if (lang === 'en-gb') score += 40;
  else if (lang.startsWith('en-')) score += 25;
  else return -1;

  for (let i = 0; i < PREFERRED_EN_VOICE_KEYWORDS.length; i++) {
    if (name.includes(PREFERRED_EN_VOICE_KEYWORDS[i])) {
      score += 100 - i * 3;
      break;
    }
  }

  if (voice.localService) score += 10;
  if (voice.default) score += 5;
  return score;
}

class WebSpeechPlayer implements SpeechPlayer {
  private activeToken = 0;
  private activeTimer: number | null = null;
  private activeRejectOrResolve: (() => void) | null = null;

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * iOS Safari requires a synchronous speechSynthesis call inside the user tap gesture
   * before subsequent async/timer-driven utterances will play reliably.
   */
  unlockAudio(): void {
    if (!this.isSupported()) return;
    try {
      const silent = new SpeechSynthesisUtterance('');
      silent.volume = 0;
      silent.lang = 'en-US';
      window.speechSynthesis.speak(silent);
    } catch {
      // Ignore unlock failures on restricted platforms
    }
  }

  getEnglishVoices(): VoiceOption[] {
    if (!this.isSupported()) return [];
    const voices = window.speechSynthesis.getVoices();
    const scored = voices
      .map((v) => ({ voice: v, score: scoreEnglishVoice(v) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score);

    return scored.map((entry, idx) => ({
      voiceURI: entry.voice.voiceURI,
      name: entry.voice.name,
      lang: entry.voice.lang,
      isRecommended: idx === 0,
    }));
  }

  private resolveBestVoice(lang: 'en-US' | 'ja-JP', preferredVoiceURI?: string): SpeechSynthesisVoice | null {
    if (!this.isSupported()) return null;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    if (lang === 'en-US') {
      if (preferredVoiceURI) {
        const matched = voices.find((v) => v.voiceURI === preferredVoiceURI);
        if (matched) return matched;
      }
      const ranked = voices
        .map((v) => ({ voice: v, score: scoreEnglishVoice(v) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score);
      return ranked[0]?.voice ?? null;
    }

    const jaExact = voices.find((v) => v.lang.toLowerCase() === 'ja-jp');
    if (jaExact) return jaExact;
    return voices.find((v) => v.lang.toLowerCase().startsWith('ja')) ?? null;
  }

  stop(): void {
    this.activeToken += 1;
    if (this.activeTimer !== null) {
      window.clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    if (this.activeRejectOrResolve) {
      const done = this.activeRejectOrResolve;
      this.activeRejectOrResolve = null;
      done();
    }
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cancel failures
      }
    }
  }

  speak(options: SpeakOptions): Promise<void> {
    if (!this.isSupported()) {
      return Promise.reject(new Error('このブラウザは音声読み上げに対応していません。'));
    }

    this.stop();
    const token = this.activeToken;

    return new Promise((resolve) => {
      const finish = () => {
        if (this.activeTimer !== null) {
          window.clearTimeout(this.activeTimer);
          this.activeTimer = null;
        }
        this.activeRejectOrResolve = null;
        resolve();
      };

      this.activeRejectOrResolve = finish;

      const utterance = new SpeechSynthesisUtterance(options.text);
      utterance.lang = options.lang;
      utterance.rate = Math.max(0.6, Math.min(1.5, options.rate));
      utterance.pitch = 1.0;

      const voice = this.resolveBestVoice(options.lang, options.preferredVoiceURI);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => {
        if (this.activeToken !== token) return;
        finish();
      };

      utterance.onerror = () => {
        if (this.activeToken !== token) return;
        finish();
      };

      // Safety watchdog in case iOS Safari drops onend event
      const estimatedMs = Math.max(3000, options.text.length * 160 + 2500);
      this.activeTimer = window.setTimeout(() => {
        if (this.activeToken !== token) return;
        finish();
      }, estimatedMs);

      try {
        // Small tick after cancel() helps Safari avoid silent drops
        window.setTimeout(() => {
          if (this.activeToken !== token) return;
          window.speechSynthesis.speak(utterance);
        }, 30);
      } catch {
        finish();
      }
    });
  }
}

export const speechPlayer: SpeechPlayer = new WebSpeechPlayer();
