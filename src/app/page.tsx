'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Sparkles, Download, Clock, Shield, Zap, Star, ChevronRight, X, Loader2, Mail, Eye, EyeOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';

const styles = [
  { name: 'Corporate', image: '/styles/corporate.jpg', desc: 'Classic business look' },
  { name: 'Creative', image: '/styles/creative.jpg', desc: 'Modern & approachable' },
  { name: 'Studio', image: '/styles/studio.jpg', desc: 'Professional studio lighting' },
  { name: 'Outdoor', image: '/styles/outdoor.jpg', desc: 'Natural background' },
];

const testimonials = [
  { name: 'Sarah K.', role: 'Product Manager', text: 'Got 20 headshots in 5 minutes. My LinkedIn engagement went up 40%.', avatar: '👩‍💼' },
  { name: 'Mike R.', role: 'Software Engineer', text: 'Saved $300 on a photographer. These look even better honestly.', avatar: '👨‍💻' },
  { name: 'Lisa T.', role: 'Marketing Director', text: 'Used these for our entire team. Consistent, professional, fast.', avatar: '👩‍🎨' },
];

const faqs = [
  { q: 'How many photos do I need?', a: 'Upload 5-10 selfies from different angles. More variety = better results.' },
  { q: 'How long does it take?', a: 'About 2-3 minutes to generate your headshots after uploading.' },
  { q: 'Can I use these on LinkedIn?', a: 'Yes! That\'s exactly what they\'re designed for. Also great for resumes, company websites, and social media.' },
  { q: 'What if I don\'t like the results?', a: 'We\'ll regenerate for free, or give you a full refund. No questions asked.' },
];

function AuthModal({ isOpen, onClose, redirectTo }: { isOpen: boolean; onClose: () => void; redirectTo?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === 'signup') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        const callbackUrl = `${window.location.origin}/auth/callback${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''}`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callbackUrl },
        });
        if (error) throw error;
        // If autoconfirm is on, user session exists immediately
        if (data?.session) {
          // Persist session via server-set cookies before navigating
          const sessionRes = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            }),
          });
          if (!sessionRes.ok) {
            const detail = await sessionRes.json().catch(() => ({}));
            throw new Error(detail.error || `Failed to persist session (${sessionRes.status})`);
          }
          window.location.href = redirectTo || '/dashboard';
          return;
        }
        setConfirmEmail(true);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Persist session via server-set cookies before navigating
        if (data?.session) {
          const sessionRes = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            }),
          });
          if (!sessionRes.ok) {
            const detail = await sessionRes.json().catch(() => ({}));
            throw new Error(detail.error || `Failed to persist session (${sessionRes.status})`);
          }
        }
        window.location.href = redirectTo || '/dashboard';
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null);
    setConfirmEmail(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-dark-950/80 backdrop-blur-sm px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md p-8 rounded-3xl bg-dark-900 border border-dark-700/50 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-dark-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>

          {confirmEmail ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-brand-400" />
              </div>
              <h2 className="text-2xl font-display font-bold mb-2">Confirm Your Email</h2>
              <p className="text-dark-300 mb-1">We sent a confirmation link to</p>
              <p className="font-semibold text-white mb-4">{email}</p>
              <p className="text-dark-400 text-sm mb-6">Click the link in your email to activate your account, then come back and sign in.</p>
              <button
                onClick={() => { setConfirmEmail(false); setMode('signin'); setPassword(''); }}
                className="px-6 py-2.5 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-xl font-medium transition text-sm"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center mx-auto mb-4">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-display font-bold mb-1">
                  {mode === 'signin' ? 'Sign In to HeadshotAI' : 'Create Your Account'}
                </h2>
                <p className="text-dark-400 text-sm">
                  {mode === 'signin' ? 'Enter your email and password to continue' : 'Sign up to get started with your headshots'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-dark-800 border border-dark-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition text-white placeholder-dark-500"
                  />
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Create a password (min 6 chars)' : 'Password'}
                    className="w-full px-4 py-3 rounded-xl bg-dark-800 border border-dark-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition text-white placeholder-dark-500 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200 transition"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {error && (
                  <p className="text-red-400 text-sm text-center">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 disabled:opacity-50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {mode === 'signin' ? 'Signing in...' : 'Creating account...'}</>
                  ) : (
                    mode === 'signin' ? 'Sign In' : 'Create Account'
                  )}
                </button>
              </form>

              <p className="text-dark-500 text-sm text-center mt-4">
                {mode === 'signin' ? (
                  <>Don&apos;t have an account?{' '}<button onClick={switchMode} className="text-brand-400 hover:text-brand-300 font-medium transition">Sign Up</button></>
                ) : (
                  <>Already have an account?{' '}<button onClick={switchMode} className="text-brand-400 hover:text-brand-300 font-medium transition">Sign In</button></>
                )}
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-dark-950" />}>
      <LandingPageContent />
    </Suspense>
  );
}

function LandingPageContent() {
  const searchParams = useSearchParams();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | undefined>();

  // Auto-open auth modal when redirected from protected route
  useEffect(() => {
    const redirect = searchParams.get('redirect');
    // Prevent open redirect: only allow relative paths
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('://')) {
      setRedirectTo(redirect);
      setShowAuth(true);
    }
    const error = searchParams.get('error');
    if (error) {
      // Could show error toast here
      console.error('Auth error:', error);
    }
  }, [searchParams]);

  const handleGetStarted = (e: React.MouseEvent) => {
    e.preventDefault();
    setRedirectTo('/dashboard');
    setShowAuth(true);
  };

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl">Headshot<span className="text-brand-400">AI</span></span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#pricing" className="text-dark-300 hover:text-white transition hidden sm:block">Pricing</a>
            <a href="#faq" className="text-dark-300 hover:text-white transition hidden sm:block">FAQ</a>
            <button onClick={handleGetStarted} className="px-4 py-2 bg-brand-500 hover:bg-brand-400 rounded-full font-medium transition">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-900/20 via-dark-950 to-dark-950" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500/10 border border-brand-500/20 rounded-full text-brand-300 text-sm mb-8">
              <Sparkles className="w-4 h-4" /> AI-Powered Professional Headshots
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-7xl font-display font-bold tracking-tight mb-6"
          >
            Professional Headshots
            <br />
            <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              From Your Selfies
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-dark-300 max-w-2xl mx-auto mb-10"
          >
            Upload 5-10 selfies. Get 20+ professional headshots in 2 minutes.
            Perfect for LinkedIn, resumes, and company websites.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={handleGetStarted}
              className="px-8 py-4 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 rounded-full font-semibold text-lg shadow-lg shadow-brand-500/25 transition-all hover:scale-105"
            >
              Create Your Headshots — $19
            </button>
            <span className="text-dark-400 text-sm">30-day money-back guarantee</span>
          </motion.div>

          {/* Social Proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 flex items-center justify-center gap-6 text-dark-400"
          >
            <div className="flex -space-x-2">
              {['👩‍💼', '👨‍💻', '👩‍🎨', '👨‍🔬', '👩‍⚕️'].map((e, i) => (
                <div key={i} className="w-10 h-10 rounded-full bg-dark-800 border-2 border-dark-950 flex items-center justify-center text-lg">
                  {e}
                </div>
              ))}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1 text-yellow-400">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <span className="text-sm">2,847+ headshots generated</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Before/After */}
      <section className="py-20 bg-dark-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4">See the Difference</h2>
            <p className="text-dark-400 text-lg">Your selfies → Professional headshots in 2 minutes</p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-6">
            {styles.map((style, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative rounded-2xl overflow-hidden bg-dark-800 border border-dark-700/50 hover:border-brand-500/50 transition-all cursor-pointer"
              >
                <div className="aspect-square bg-gradient-to-br from-dark-700 to-dark-800 flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-12 h-12 text-dark-500 mx-auto mb-2" />
                    <span className="text-dark-400 text-sm">{style.name}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{style.name}</h3>
                  <p className="text-dark-400 text-sm">{style.desc}</p>
                </div>
                <div className="absolute inset-0 bg-brand-500/10 opacity-0 group-hover:opacity-100 transition" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4">3 Simple Steps</h2>
            <p className="text-dark-400 text-lg">No studio, no photographer, no waiting</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <Camera className="w-8 h-8" />, title: 'Upload Selfies', desc: '5-10 photos from your phone. Different angles, expressions, lighting.' },
              { icon: <Sparkles className="w-8 h-8" />, title: 'AI Does Its Thing', desc: 'Our AI analyzes your features and generates professional headshots.' },
              { icon: <Download className="w-8 h-8" />, title: 'Download & Use', desc: 'Pick your favorites. Download in high-res. Use everywhere.' },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center p-8 rounded-2xl bg-dark-900/50 border border-dark-800/50"
              >
                <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-6 text-brand-400">
                  {step.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-dark-400">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-dark-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <Clock className="w-6 h-6" />, title: '2-Minute Delivery', desc: 'No waiting days for results. Your headshots are ready in minutes.' },
              { icon: <Shield className="w-6 h-6" />, title: 'Privacy First', desc: 'Your photos are deleted after 24 hours. We never share your data.' },
              { icon: <Zap className="w-6 h-6" />, title: 'Unlimited Regenerations', desc: 'Not happy? Regenerate as many times as you want. No extra charge.' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="flex gap-4 p-6"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-dark-400 text-sm">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4">Loved by Professionals</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-dark-900/50 border border-dark-800/50"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-dark-800 flex items-center justify-center text-2xl">{t.avatar}</div>
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-dark-400 text-sm">{t.role}</div>
                  </div>
                </div>
                <p className="text-dark-300">{t.text}</p>
                <div className="flex gap-1 text-yellow-400 mt-4">
                  {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-current" />)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-dark-900/50">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4">Simple Pricing</h2>
            <p className="text-dark-400 text-lg">One price. No subscriptions. Yours forever.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative p-8 rounded-3xl bg-dark-800 border-2 border-brand-500 shadow-lg shadow-brand-500/10"
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-brand-500 rounded-full text-sm font-medium">
              Most Popular
            </div>

            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold mb-2">Professional Pack</h3>
              <div className="text-5xl font-bold mb-2">$19</div>
              <p className="text-dark-400">One-time payment</p>
            </div>

            <ul className="space-y-3 mb-8 max-w-md mx-auto">
              {[
                '20+ AI-generated headshots',
                '4 professional styles',
                'High-resolution downloads',
                'Commercial usage rights',
                '24-hour photo deletion',
                'Unlimited regenerations',
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-dark-200">
                  <span className="text-brand-400">✓</span> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={handleGetStarted}
              className="block w-full text-center px-8 py-4 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 rounded-full font-semibold text-lg transition-all hover:scale-105"
            >
              Get Started Now
            </button>

            <p className="text-center text-dark-400 text-sm mt-4">30-day money-back guarantee</p>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4">Frequently Asked</h2>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-2xl bg-dark-900/50 border border-dark-800/50 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                >
                  <span className="font-medium">{faq.q}</span>
                  <ChevronRight className={`w-5 h-5 text-dark-400 transition-transform ${openFaq === i ? 'rotate-90' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-dark-300">{faq.a}</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-b from-dark-900/50 to-dark-950">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-display font-bold mb-6">
              Ready for Your New Headshot?
            </h2>
            <p className="text-xl text-dark-300 mb-8">
              Join 2,800+ professionals who upgraded their image.
            </p>
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 rounded-full font-semibold text-lg shadow-lg shadow-brand-500/25 transition-all hover:scale-105"
            >
              Get Started — $19 <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-dark-800">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <Camera className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold">HeadshotAI</span>
          </div>
          <p className="text-dark-500 text-sm">&copy; 2026 HeadshotAI. All rights reserved.</p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} redirectTo={redirectTo} />
    </div>
  );
}
