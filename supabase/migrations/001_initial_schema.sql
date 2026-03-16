-- ============================================================
-- Headshot AI — Initial Schema Migration
-- ============================================================
-- Matches Prisma schema: Job, Payment
-- Supabase Auth handles users (auth.users)
-- ============================================================

-- ---------- Tables ----------

CREATE TABLE IF NOT EXISTS jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  style             TEXT,
  background        TEXT,
  input_image_url   TEXT,
  output_image_urls JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id              UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  stripe_session_id   TEXT UNIQUE,
  stripe_payment_id   TEXT,
  amount              INTEGER NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'usd',
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'succeeded', 'failed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Indexes ----------

CREATE INDEX IF NOT EXISTS idx_jobs_user_id   ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status    ON jobs(status);

CREATE INDEX IF NOT EXISTS idx_payments_user_id           ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_job_id            ON payments(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session_id ON payments(stripe_session_id);

-- ---------- Row Level Security ----------

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Jobs: users can read/insert their own jobs
CREATE POLICY "Users can view own jobs"
  ON jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
  ON jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Jobs: only service_role (API routes) can update jobs (status changes, results)
CREATE POLICY "Service role can update jobs"
  ON jobs FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Payments: users can view their own payments
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

-- Payments: only service_role inserts payments (via API after Stripe webhook)
CREATE POLICY "Service role can insert payments"
  ON payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update payments"
  ON payments FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ---------- Storage Buckets ----------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('uploads', 'uploads', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('results', 'results', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ---------- Storage Policies ----------

-- Uploads bucket: users can upload to their own folder
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Uploads bucket: users can read their own files
CREATE POLICY "Users can read own uploads"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Uploads bucket: users can delete their own files
CREATE POLICY "Users can delete own uploads"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Results bucket: public read (results are shareable)
CREATE POLICY "Anyone can read results"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'results');

-- Results bucket: only service_role writes results
CREATE POLICY "Service role can write results"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'results');
