import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Browser client (uses anon key, respects RLS)
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Server admin client (bypasses RLS - use only in API routes/server actions)
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// ---------- Convenience singleton exports ----------

// Anon client for client-side use (lazy-initialized)
let _supabase: ReturnType<typeof createBrowserClient> | null = null;
export function getSupabase() {
  if (!_supabase) _supabase = createSupabaseBrowserClient();
  return _supabase;
}
/** @deprecated Use getSupabase() — this getter creates a new client per access in SSR */
export const supabase = typeof window !== "undefined"
  ? createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  : (null as any);

// Admin client for server-side use (lazy-initialized)
let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | null = null;
export function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
  return _supabaseAdmin;
}
export const supabaseAdmin = (() => {
  // Only create on server side
  if (typeof window !== "undefined") return null as any;
  try {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  } catch {
    return null as any;
  }
})();

// ---------- Auth helpers ----------

export async function getUser() {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function signUp(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ---------- Storage helpers ----------

const UPLOADS_BUCKET = "uploads";
const RESULTS_BUCKET = "results";

export async function uploadImage(
  file: File | Blob,
  path: string,
  bucket: string = UPLOADS_BUCKET
): Promise<string> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return publicUrl;
}

export async function uploadImages(
  files: File[],
  userId: string,
  jobId: string
): Promise<string[]> {
  const urls: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${jobId}/input_${i}.${ext}`;
    const url = await uploadImage(file, path);
    urls.push(url);
  }

  return urls;
}

export async function uploadResultImage(
  imageUrl: string,
  userId: string,
  jobId: string,
  index: number
): Promise<string> {
  // Download from Replicate URL and re-upload to our storage
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const path = `${userId}/${jobId}/result_${index}.webp`;
  return uploadImage(blob, path, RESULTS_BUCKET);
}

export function getPublicUrl(path: string, bucket: string = UPLOADS_BUCKET) {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

export async function deleteImages(paths: string[], bucket: string = UPLOADS_BUCKET) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
}

// Ensure buckets exist (run on startup / setup)
export async function ensureBuckets() {
  const supabase = createSupabaseAdminClient();

  for (const bucket of [UPLOADS_BUCKET, RESULTS_BUCKET]) {
    const { data: existing } = await supabase.storage.getBucket(bucket);
    if (!existing) {
      await supabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      });
    }
  }
}
