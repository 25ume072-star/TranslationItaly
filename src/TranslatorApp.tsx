import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ArrowLeftRight,
  ChevronDown,
  Clipboard,
  Eraser,
  Languages,
  Loader2,
  Moon,
  Sun,
  Volume2,
} from 'lucide-react';

type LangDirection = 'en-it' | 'it-en';

interface HistoryEntry {
  id: string;
  input: string;
  output: string;
  direction: LangDirection;
  timestamp: number;
}

interface AltMatch {
  translation: string;
  quality: number;
}

const LANG_LABELS: Record<LangDirection, { source: string; target: string }> = {
  'en-it': { source: 'English', target: 'Italian' },
  'it-en': { source: 'Italian', target: 'English' },
};

const LANG_FLAGS: Record<LangDirection, { source: string; target: string }> = {
  'en-it': { source: '\u{1F1EC}\u{1F1E7}', target: '\u{1F1EE}\u{1F1F9}' },
  'it-en': { source: '\u{1F1EE}\u{1F1F9}', target: '\u{1F1EC}\u{1F1E7}' },
};

const LANG_CODES: Record<LangDirection, { source: string; target: string }> = {
  'en-it': { source: 'en', target: 'it' },
  'it-en': { source: 'it', target: 'en' },
};

const CHAR_LIMIT = 500;

function getRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem('translator-history');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadDarkMode(): boolean {
  try {
    const raw = localStorage.getItem('translator-dark');
    return raw === 'true';
  } catch {
    return false;
  }
}

export default function TranslatorApp() {
  const [direction, setDirection] = useState<LangDirection>('en-it');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [alternatives, setAlternatives] = useState<AltMatch[]>([]);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [swapSpin, setSwapSpin] = useState(false);
  const [justTranslated, setJustTranslated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [darkMode, setDarkMode] = useState(loadDarkMode);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem('translator-dark', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('translator-history', JSON.stringify(history));
  }, [history]);

  const handleSwap = useCallback(() => {
    setSwapSpin(true);
    setTimeout(() => setSwapSpin(false), 300);
    setDirection((prev) => (prev === 'en-it' ? 'it-en' : 'en-it'));
    setInputText(outputText);
    setOutputText(inputText);
    setAlternatives([]);
    setError('');
  }, [inputText, outputText]);

  const handleClear = useCallback(() => {
    setInputText('');
    setOutputText('');
    setAlternatives([]);
    setError('');
    setJustTranslated(false);
  }, []);

  const handleTranslate = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    setIsLoading(true);
    setError('');
    setOutputText('');
    setAlternatives([]);
    setJustTranslated(false);

    try {
      const { source, target } = LANG_CODES[direction];
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
      const res = await fetch(url);

      if (!res.ok) throw new Error('Translation service unavailable. Please try again.');

      const data = await res.json();

      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        const translated = data.responseData.translatedText;
        setOutputText(translated);
        setJustTranslated(true);

        const matches: AltMatch[] = (data.matches || [])
          .filter(
            (m: { translation: string; match: string }) =>
              m.translation !== translated && m.match,
          )
          .slice(0, 3)
          .map((m: { translation: string; match: string }) => ({
            translation: m.translation,
            quality: parseFloat(m.match) || 0,
          }));
        setAlternatives(matches);

        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          input: text,
          output: translated,
          direction,
          timestamp: Date.now(),
        };
        setHistory((prev) => [entry, ...prev].slice(0, 50));
      } else if (data.responseStatus === 403) {
        setError('Daily translation limit reached. Please try again tomorrow.');
      } else {
        setError('Could not translate the text. Please check your input.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [inputText, direction]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleTranslate();
      }
    },
    [handleTranslate],
  );

  const handleSpeak = useCallback((text: string, lang: string) => {
    if (!text || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'en' ? 'en-US' : 'it-IT';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const handleCopy = useCallback(() => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [outputText]);

  const handleHistoryClick = useCallback((entry: HistoryEntry) => {
    setDirection(entry.direction);
    setInputText(entry.input);
    setOutputText(entry.output);
    setAlternatives([]);
    setError('');
    setJustTranslated(true);
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const labels = LANG_LABELS[direction];
  const flags = LANG_FLAGS[direction];
  const codes = LANG_CODES[direction];
  const charCount = inputText.length;
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const charPercent = Math.min((charCount / CHAR_LIMIT) * 100, 100);
  const barColor =
    charPercent > 90 ? 'bg-red-500' : charPercent > 60 ? 'bg-amber-500' : 'bg-sky-500';
  const barColorDark =
    charPercent > 90 ? 'dark:bg-red-400' : charPercent > 60 ? 'dark:bg-amber-400' : 'dark:bg-sky-400';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex flex-col relative overflow-hidden">
        {/* Floating Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-24 -left-24 w-72 h-72 sm:w-96 sm:h-96 bg-sky-400/20 dark:bg-sky-600/10 rounded-full blur-3xl animate-blob-1" />
          <div className="absolute top-1/3 -right-16 w-64 h-64 sm:w-80 sm:h-80 bg-blue-400/15 dark:bg-blue-600/10 rounded-full blur-3xl animate-blob-2" />
          <div className="absolute -bottom-20 left-1/3 w-56 h-56 sm:w-72 sm:h-72 bg-cyan-400/15 dark:bg-cyan-600/10 rounded-full blur-3xl animate-blob-3" />
        </div>

        {/* Header */}
        <header className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/50 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm">
                <Languages className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                Translator
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">
                Ctrl+Enter to translate
              </span>
              <button
                onClick={() => setDarkMode((p) => !p)}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-500 dark:text-slate-400 cursor-pointer"
                title={darkMode ? 'Light mode' : 'Dark mode'}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 py-6 sm:py-10 relative z-[1]">
          <div className="w-full max-w-5xl">
            {/* Hero Tagline */}
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 dark:from-sky-400 dark:via-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                Seamless English / Italian Translation
              </h2>
              <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                Type, translate, and listen -- powered by AI
              </p>
            </div>

            {/* Glass Translator Card */}
            <div className="bg-white/55 dark:bg-slate-800/55 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-slate-700/40 shadow-lg p-4 sm:p-6">
              {/* Direction Bar */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-5">
                <span className="px-3 sm:px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <span>{flags.source}</span>
                  <span>{labels.source}</span>
                </span>
                <button
                  onClick={handleSwap}
                  className={`w-10 h-10 sm:w-10 sm:h-10 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-sky-300 dark:hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md active:scale-90 cursor-pointer ${
                    swapSpin ? 'rotate-180' : 'rotate-0'
                  }`}
                  style={{ transition: 'transform 300ms ease-in-out' }}
                  title="Swap languages"
                >
                  <ArrowLeftRight className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </button>
                <span className="px-3 sm:px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <span>{flags.target}</span>
                  <span>{labels.target}</span>
                </span>
              </div>

              {/* Text Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {/* Input */}
                <div className="relative bg-white/80 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm focus-within:ring-2 focus-within:ring-sky-300/50 dark:focus-within:ring-sky-500/30 focus-within:border-sky-300 dark:focus-within:border-sky-600 transition-all duration-200 flex flex-col">
                  <div className="px-3 sm:px-4 pt-2.5 pb-1 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {flags.source} {labels.source}
                    </span>
                    <span className="text-xs text-slate-300 dark:text-slate-600">
                      {charCount} chars / {wordCount} words
                    </span>
                  </div>
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type something to translate..."
                    maxLength={CHAR_LIMIT}
                    className="flex-1 min-h-[140px] sm:min-h-[200px] max-h-[300px] p-3 sm:p-4 text-base text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 bg-transparent resize-none focus:outline-none"
                    dir="auto"
                  />
                  {/* Character limit bar */}
                  <div className="px-3 sm:px-4 pt-0 pb-1">
                    <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor} ${barColorDark}`}
                        style={{ width: `${charPercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="px-3 sm:px-4 pb-2 sm:pb-3 flex items-center gap-1">
                    <button
                      onClick={() => handleSpeak(inputText, codes.source)}
                      className="w-9 h-9 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:w-8 sm:h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                      title={`Listen in ${labels.source}`}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleClear}
                      className="w-9 h-9 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:w-8 sm:h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                      title="Clear"
                    >
                      <Eraser className="w-4 h-4" />
                    </button>
                    <span className="ml-auto text-xs text-slate-300 dark:text-slate-600 sm:hidden">
                      Tap Translate below
                    </span>
                  </div>
                </div>

                {/* Output */}
                <div className="relative bg-slate-50/80 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                  <div className="px-3 sm:px-4 pt-2.5 pb-1 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {flags.target} {labels.target}
                    </span>
                    <div className="relative flex items-center gap-1">
                      {outputText && (
                        <>
                          <button
                            onClick={() => handleSpeak(outputText, codes.target)}
                            className="w-9 h-9 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:w-8 sm:h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                            title={`Listen in ${labels.target}`}
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCopy}
                            className="w-9 h-9 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:w-8 sm:h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                            title="Copy to clipboard"
                          >
                            <Clipboard className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {copied && (
                        <span className="absolute -top-7 right-0 text-xs font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/40 px-2 py-0.5 rounded animate-copied whitespace-nowrap">
                          Copied!
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-h-[140px] sm:min-h-[200px] max-h-[300px] p-3 sm:p-4 text-base text-slate-700 dark:text-slate-200 overflow-auto">
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2 text-sky-600 dark:text-sky-400 h-full">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Translating...</span>
                      </div>
                    ) : outputText ? (
                      <p className={`whitespace-pre-wrap leading-relaxed ${justTranslated ? 'animate-fade-up' : ''}`}>
                        {outputText}
                      </p>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-200 dark:text-slate-700">
                        <Languages className="w-12 h-12 mb-2" />
                        <span className="text-sm">Translation will appear here</span>
                      </div>
                    )}
                  </div>

                  {/* Alternatives */}
                  {alternatives.length > 0 && (
                    <div className="border-t border-slate-100 dark:border-slate-700/50">
                      <button
                        onClick={() => setShowAlternatives((p) => !p)}
                        className="w-full px-3 sm:px-4 py-2 flex items-center justify-between text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        <span>Alternative translations ({alternatives.length})</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${showAlternatives ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {showAlternatives && (
                        <div className="px-3 sm:px-4 pb-3 space-y-2 animate-fade-up">
                          {alternatives.map((alt, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                            >
                              <div className="flex-1">
                                <p>{alt.translation}</p>
                                <div className="mt-1 h-1 w-16 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-sky-400 dark:bg-sky-500"
                                    style={{ width: `${alt.quality}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-xs text-slate-300 dark:text-slate-600 mt-0.5">
                                {alt.quality.toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mt-3 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-600 dark:text-red-400 animate-fade-up">
                  {error}
                </div>
              )}

              {/* Translate Button */}
              <div className="mt-4 sm:mt-5 flex justify-center">
                <button
                  onClick={handleTranslate}
                  disabled={isLoading || !inputText.trim()}
                  className="w-full sm:w-auto px-8 py-3 min-h-[44px] rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 dark:from-sky-600 dark:to-blue-700 text-white font-semibold text-sm shadow-md hover:shadow-lg hover:from-sky-600 hover:to-blue-700 dark:hover:from-sky-500 dark:hover:to-blue-600 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 relative overflow-hidden"
                >
                  {isLoading && <span className="absolute inset-0 animate-shimmer" />}
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin relative z-[1]" />
                      <span className="relative z-[1]">Translating...</span>
                    </>
                  ) : (
                    <span>Translate</span>
                  )}
                </button>
              </div>
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="mt-6 sm:mt-8">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setShowHistory((p) => !p)}
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <span>Recent translations</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <button
                    onClick={handleClearHistory}
                    className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>

                {showHistory && (
                  <div className="space-y-2">
                    {history.slice(0, showHistory ? 50 : 3).map((entry, i) => (
                      <button
                        key={entry.id}
                        onClick={() => handleHistoryClick(entry)}
                        className="w-full text-left bg-white/55 dark:bg-slate-800/40 backdrop-blur-lg rounded-xl border border-slate-200/50 dark:border-slate-700/30 p-3 sm:p-4 hover:bg-white/80 dark:hover:bg-slate-800/60 hover:border-sky-200 dark:hover:border-sky-700/40 transition-all duration-200 cursor-pointer group"
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 dark:text-slate-200 truncate group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors">
                              {entry.input}
                            </p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 truncate mt-0.5">
                              {entry.output}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">
                              {LANG_FLAGS[entry.direction].source}{'\u2192'}{LANG_FLAGS[entry.direction].target}
                            </span>
                            <span className="text-xs text-slate-300 dark:text-slate-600">
                              {getRelativeTime(entry.timestamp)}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer
          className="text-center py-4 text-xs text-slate-400 dark:text-slate-600 border-t border-slate-100 dark:border-slate-800/50"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          Powered by MyMemory Translation API
        </footer>
      </div>
    </div>
  );
}
