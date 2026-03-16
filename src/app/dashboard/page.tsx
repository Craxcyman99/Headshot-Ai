'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Upload, Camera, Loader2, Check, AlertCircle, ArrowRight, X } from 'lucide-react';

interface UploadedFile {
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
}

const styles = [
  { id: 'professional', name: 'Professional', desc: 'Classic corporate headshot with studio lighting', emoji: '👔' },
  { id: 'casual', name: 'Casual', desc: 'Natural relaxed look, soft lighting, authentic expression', emoji: '😊' },
  { id: 'creative', name: 'Creative', desc: 'Artistic, dramatic lighting, editorial style', emoji: '🎨' },
  { id: 'executive', name: 'Executive', desc: 'Power pose, premium studio lighting, boardroom ready', emoji: '🏆' },
  { id: 'linkedin', name: 'LinkedIn', desc: 'Friendly professional smile, business casual', emoji: '💼' },
  { id: 'tech', name: 'Tech', desc: 'Modern clean aesthetic, smart casual, startup vibe', emoji: '💻' },
  { id: 'medical', name: 'Medical', desc: 'Clinical yet warm, trustworthy caring expression', emoji: '🏥' },
  { id: 'legal', name: 'Legal', desc: 'Formal attire, authoritative composed expression', emoji: '⚖️' },
];

const backgrounds = [
  { id: 'neutral', name: 'Neutral', color: 'linear-gradient(135deg, #9ca3af, #6b7280)' },
  { id: 'white', name: 'White', color: '#ffffff' },
  { id: 'office', name: 'Office', color: '#374151' },
  { id: 'outdoor', name: 'Outdoor', color: '#166534' },
  { id: 'dark', name: 'Dark', color: '#1f2937' },
  { id: 'studio', name: 'Studio', color: '#7c3aed' },
  { id: 'city', name: 'City', color: '#1e3a5f' },
];

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-dark-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-brand-400 animate-spin" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedStyle, setSelectedStyle] = useState('professional');
  const [selectedBg, setSelectedBg] = useState('neutral');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  // Handle cancelled payment redirect
  useEffect(() => {
    if (searchParams.get('payment') === 'cancelled') {
      setError('Payment was cancelled. You can try again anytime.');
      setStep(3);
    }
  }, [searchParams]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }));
    setFiles(prev => [...prev, ...newFiles].slice(0, 15)); // Max 15
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 15,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const uploadAndCheckout = async () => {
    if (files.length < 5) {
      setError('Please upload at least 5 photos for best results.');
      return;
    }

    setCheckoutLoading(true);
    setError(null);

    try {
      // Validate that file objects are still readable before building FormData.
      // File objects from drag-drop can become detached under browser memory
      // pressure, causing fetch() to throw "The string did not match the
      // expected pattern" when serializing the multipart body.
      for (const f of files) {
        try {
          // Reading a 1-byte slice verifies the blob data is still accessible
          await f.file.slice(0, 1).arrayBuffer();
        } catch {
          setError('Some photos are no longer accessible. Please remove them and re-upload.');
          setCheckoutLoading(false);
          setStep(1);
          return;
        }
      }

      // Build FormData with validated files
      const formData = new FormData();
      files.forEach(f => formData.append('photos', f.file));
      formData.append('style', selectedStyle);
      formData.append('background', selectedBg);

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });

      // Guard against non-JSON responses (e.g. HTML error page from expired session)
      const contentType = uploadRes.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        window.location.href = '/?redirect=/dashboard';
        return;
      }

      const uploadData = await uploadRes.json();

      if (uploadRes.status === 401) {
        window.location.href = '/?redirect=/dashboard';
        return;
      }

      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      setJobId(uploadData.jobId);
      setStep(3);
    } catch (err: any) {
      console.error('Upload error:', err);
      // If the error looks like a cookie/auth/DOMException issue, redirect to re-auth
      const msg = err.message || '';
      if (msg.includes('pattern') || msg.includes('cookie') || err.name === 'DOMException') {
        window.location.href = '/?redirect=/dashboard';
        return;
      }
      setError(
        msg.includes('pattern') || msg.includes('Authentication')
          ? 'Your session has expired. Redirecting to sign in...'
          : msg || 'Upload failed. Please try again.'
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!jobId) return;

    setCheckoutLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      
      const checkoutContentType = res.headers.get('content-type') || '';
      if (!checkoutContentType.includes('application/json')) {
        window.location.href = '/?redirect=/dashboard';
        return;
      }

      const data = await res.json();

      if (res.status === 401) {
        window.location.href = '/?redirect=/dashboard';
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      // Validate Stripe URL before navigating
      if (!data.url || typeof data.url !== 'string') {
        throw new Error('Invalid checkout URL received');
      }
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Checkout error:', err);
      const msg = err.message || '';
      if (msg.includes('pattern') || msg.includes('cookie') || err.name === 'DOMException') {
        window.location.href = '/?redirect=/dashboard';
        return;
      }
      setError(msg || 'Checkout failed. Please try again.');
      setCheckoutLoading(false);
    }
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
          <div className="hidden sm:flex items-center gap-4 text-sm text-dark-400">
            <span className={step >= 1 ? 'text-brand-400' : ''}>1. Upload</span>
            <span>→</span>
            <span className={step >= 2 ? 'text-brand-400' : ''}>2. Style</span>
            <span>→</span>
            <span className={step >= 3 ? 'text-brand-400' : ''}>3. Checkout</span>
            <span>→</span>
            <span className={step >= 4 ? 'text-brand-400' : ''}>4. Generate</span>
          </div>
          <div className="sm:hidden text-sm text-brand-400 font-medium">
            Step {step} of 4
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
          {step === 1 && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h1 className="text-3xl font-display font-bold mb-2">Upload Your Selfies</h1>
              <p className="text-dark-400 mb-8">Upload 5-10 photos. Different angles, expressions, and lighting work best.</p>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-dark-700 hover:border-dark-500 bg-dark-900/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-12 h-12 text-dark-500 mx-auto mb-4" />
                <p className="text-lg font-medium mb-1">
                  {isDragActive ? 'Drop your photos here' : 'Drag & drop your photos'}
                </p>
                <p className="text-dark-400 text-sm">or click to browse • JPG, PNG, WebP • Max 10MB each</p>
              </div>

              {/* Preview Grid */}
              {files.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">{files.length} photo{files.length !== 1 ? 's' : ''} uploaded</h3>
                    <span className={`text-sm ${files.length >= 5 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {files.length >= 5 ? '✓ Ready' : `Need ${5 - files.length} more`}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {files.map((f, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-dark-800 group">
                        <img src={f.preview} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-dark-900/80 text-white opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {files.length > 0 && (
                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setStep(2)}
                    disabled={files.length < 5}
                    className="px-6 py-3 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-medium transition flex items-center gap-2"
                  >
                    Choose Style <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 2: Style */}
          {step === 2 && (
            <motion.div
              key="style"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h1 className="text-3xl font-display font-bold mb-2">Choose Your Style</h1>
              <p className="text-dark-400 mb-8">Select the look that fits your professional image.</p>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Style Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {styles.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStyle(s.id)}
                    className={`p-6 rounded-2xl border-2 text-left transition-all ${
                      selectedStyle === s.id
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-dark-700 bg-dark-900/50 hover:border-dark-500'
                    }`}
                  >
                    <div className="text-3xl mb-3">{s.emoji}</div>
                    <h3 className="font-semibold mb-1">{s.name}</h3>
                    <p className="text-dark-400 text-sm">{s.desc}</p>
                  </button>
                ))}
              </div>

              {/* Background Selection */}
              <h3 className="font-medium mb-4">Background</h3>
              <div className="flex flex-wrap gap-3 mb-8">
                {backgrounds.map(bg => (
                  <button
                    key={bg.id}
                    onClick={() => setSelectedBg(bg.id)}
                    className={`w-16 h-16 rounded-xl border-2 transition-all ${
                      selectedBg === bg.id ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-dark-700'
                    }`}
                    style={{ background: bg.color }}
                    title={bg.name}
                  />
                ))}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border border-dark-700 hover:border-dark-500 rounded-full font-medium transition"
                >
                  Back
                </button>
                <button
                  onClick={uploadAndCheckout}
                  disabled={checkoutLoading}
                  className="px-6 py-3 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 rounded-full font-medium transition flex items-center gap-2"
                >
                  {checkoutLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      Continue to Checkout <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Checkout */}
          {step === 3 && (
            <motion.div
              key="checkout"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center py-12"
            >
              <h1 className="text-3xl font-display font-bold mb-2">Checkout</h1>
              <p className="text-dark-400 mb-8">Review your order and complete payment to generate your headshots.</p>

              {/* Summary */}
              <div className="max-w-md mx-auto p-6 rounded-2xl bg-dark-900/50 border border-dark-800/50 mb-8 text-left">
                <div className="flex justify-between py-2 border-b border-dark-800">
                  <span className="text-dark-400">Photos</span>
                  <span>{files.length} uploaded</span>
                </div>
                <div className="flex justify-between py-2 border-b border-dark-800">
                  <span className="text-dark-400">Style</span>
                  <span>{styles.find(s => s.id === selectedStyle)?.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-dark-800">
                  <span className="text-dark-400">Background</span>
                  <span>{backgrounds.find(b => b.id === selectedBg)?.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-dark-800">
                  <span className="text-dark-400">Outputs</span>
                  <span>20+ headshots</span>
                </div>
                <div className="flex justify-between py-3 text-lg font-semibold">
                  <span>Total</span>
                  <span>$19.00</span>
                </div>
              </div>

              {error && (
                <div className="max-w-md mx-auto p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setStep(2)}
                  disabled={checkoutLoading}
                  className="px-6 py-3 border border-dark-700 hover:border-dark-500 rounded-full font-medium transition disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  className="px-8 py-3 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 rounded-full font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                >
                  {checkoutLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      Pay $19 & Generate <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-dark-400 text-sm mt-6">
                Secure payment via Stripe. You'll be redirected to complete checkout.
              </p>
            </motion.div>
          )}

          {/* Step 4: Generate (after payment redirect) */}
          {step === 4 && (
            <motion.div
              key="generate"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 rounded-full bg-brand-500/10 flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
                <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
              </div>
              <h1 className="text-3xl font-display font-bold mb-2">Generating Your Headshots</h1>
              <p className="text-dark-400 mb-8">This usually takes 2-3 minutes. Please don't close this page.</p>

              {error && (
                <div className="max-w-md mx-auto p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="max-w-md mx-auto bg-dark-800 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-brand-500 to-brand-400"
                  initial={{ width: '0%' }}
                  animate={{ width: '60%' }}
                  transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
