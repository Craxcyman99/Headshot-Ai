'use client';

import { useEffect } from 'react';
import { Camera } from 'lucide-react';

export default function ResultsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Results page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-dark-950">
      <nav className="border-b border-dark-800/50 bg-dark-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl">
              Headshot<span className="text-brand-400">AI</span>
            </span>
          </a>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="text-6xl mb-4">😔</div>
        <h1 className="text-2xl font-display font-bold mb-2">Something Went Wrong</h1>
        <p className="text-dark-400 mb-6">
          We hit an unexpected error loading your results.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-brand-500 hover:bg-brand-400 rounded-full font-medium transition"
          >
            Try Again
          </button>
          <a
            href="/dashboard"
            className="px-6 py-3 border border-dark-700 hover:border-dark-500 rounded-full font-medium transition"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
