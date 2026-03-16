'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Download, Loader2, Check, RefreshCw, Share2 } from 'lucide-react';

type Props = {
  params: Promise<{ jobId: string }>;
};

export default function ResultsPage({ params }: Props) {
  const [status, setStatus] = useState<'loading' | 'generating' | 'completed' | 'failed'>('loading');
  const [images, setImages] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [jobId, setJobId] = useState<string>('');
  const [pollAttempts, setPollAttempts] = useState(0);

  const MAX_POLL_ATTEMPTS = 100; // ~5 minutes at 3s interval

  useEffect(() => {
    params.then(p => setJobId(p.jobId));
  }, [params]);

  useEffect(() => {
    if (!jobId) return;

    const searchParams = new URLSearchParams(window.location.search);
    const paymentSuccess = searchParams.get('payment') === 'success';

    const startGenerationAndPoll = async () => {
      try {
        // If coming back from successful payment, trigger generation first
        if (paymentSuccess) {
          setStatus('generating');
          const genRes = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId }),
          });

          if (!genRes.ok) {
            const errData = await genRes.json();
            // If 402, payment wasn't recorded yet (webhook delay) — poll anyway
            if (genRes.status !== 402) {
              throw new Error(errData.error || 'Generation failed');
            }
          }

          const genData = await genRes.json();
          if (genData.status === 'completed') {
            setStatus('completed');
            setImages(genData.images || []);
            // Clean up URL params
            window.history.replaceState({}, '', `/results/${jobId}`);
            return;
          }
        }

        // Poll for status
        poll();
      } catch (err) {
        console.error('Generation error:', err);
        // Fall through to polling — maybe payment webhook hasn't fired yet
        poll();
      }
    };

    let attemptCount = 0;
    const poll = async () => {
      try {
        attemptCount++;
        if (attemptCount > MAX_POLL_ATTEMPTS) {
          console.error('Polling timed out after max attempts');
          setStatus('failed');
          return;
        }

        const res = await fetch(`/api/generate?jobId=${jobId}`);
        const data = await res.json();

        if (data.status === 'completed') {
          setStatus('completed');
          setImages(data.results || []);
        } else if (data.status === 'failed') {
          setStatus('failed');
        } else {
          setStatus('generating');
          setTimeout(poll, 3000);
        }
      } catch {
        setStatus('failed');
      }
    };

    startGenerationAndPoll();
  }, [jobId]);

  const toggleSelect = (index: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelected(newSelected);
  };

  const downloadSelected = () => {
    const selectedImages = Array.from(selected).map(i => images[i]);
    selectedImages.forEach((url, i) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `headshot-${i + 1}.jpg`;
      a.click();
    });
  };

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Nav */}
      <nav className="border-b border-dark-800/50 bg-dark-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl">Headshot<span className="text-brand-400">AI</span></span>
          </a>
          <a href="/dashboard" className="text-dark-400 hover:text-white transition text-sm">
            Create More
          </a>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Loading / Generating State */}
        {status === 'loading' || status === 'generating' ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-full bg-brand-500/10 flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
              <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
            </div>
            <h1 className="text-2xl font-display font-bold mb-2">Creating Your Headshots</h1>
            <p className="text-dark-400 mb-4">This usually takes 2-3 minutes...</p>
            <div className="max-w-md mx-auto bg-dark-800 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-brand-500 to-brand-400"
                initial={{ width: '0%' }}
                animate={{ width: '60%' }}
                transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
              />
            </div>
          </motion.div>
        ) : status === 'failed' ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4">😔</div>
            <h1 className="text-2xl font-display font-bold mb-2">Something Went Wrong</h1>
            <p className="text-dark-400 mb-6">Don&apos;t worry, we didn&apos;t charge you.</p>
            <a
              href="/dashboard"
              className="px-6 py-3 bg-brand-500 hover:bg-brand-400 rounded-full font-medium transition"
            >
              Try Again
            </a>
          </motion.div>
        ) : (
          /* Results */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-display font-bold mb-1">Your Headshots</h1>
                <p className="text-dark-400">{images.length} professional headshots generated</p>
              </div>
              <div className="flex gap-3">
                <button className="px-4 py-2 border border-dark-700 hover:border-dark-500 rounded-full text-sm font-medium transition flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Regenerate
                </button>
                <button
                  onClick={downloadSelected}
                  disabled={selected.size === 0}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 rounded-full text-sm font-medium transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download {selected.size > 0 ? `(${selected.size})` : ''}
                </button>
              </div>
            </div>

            {/* Selection hint */}
            <p className="text-dark-400 text-sm mb-4">Click images to select for download</p>

            {/* Image Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((url, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => toggleSelect(i)}
                  className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer transition-all group ${
                    selected.has(i)
                      ? 'ring-4 ring-brand-500 ring-offset-2 ring-offset-dark-950'
                      : 'hover:ring-2 hover:ring-dark-500'
                  }`}
                >
                  <img
                    src={url}
                    alt={`Headshot ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {selected.has(i) && (
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-950/60 to-transparent opacity-0 group-hover:opacity-100 transition" />
                </motion.div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="mt-12 p-6 rounded-2xl bg-dark-900/50 border border-dark-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1">Love your headshots?</h3>
                  <p className="text-dark-400 text-sm">Share HeadshotAI with friends and get free credits.</p>
                </div>
                <button className="px-4 py-2 border border-dark-700 hover:border-dark-500 rounded-full text-sm font-medium transition flex items-center gap-2">
                  <Share2 className="w-4 h-4" /> Share
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
