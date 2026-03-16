/**
 * Centralized config with validated environment variables.
 * Fails fast on missing required vars (except during build with placeholder values).
 */

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

function validateSecret(name: string, value: string): void {
  // Skip validation during build or in non-production
  if (!IS_PRODUCTION || IS_BUILD) return;

  const lower = value.toLowerCase();
  if (
    lower.includes('placeholder') ||
    lower.includes('test') ||
    lower === '' ||
    lower === 'undefined' ||
    lower === 'null'
  ) {
    throw new Error(
      `SECURITY: ${name} contains a placeholder/test value in production. ` +
      `Set a real secret before deploying.`
    );
  }
}

export const config = {
  app: {
    url: env('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  },
  stripe: {
    secretKey: (() => {
      const v = env('STRIPE_SECRET_KEY', 'sk_test_placeholder');
      validateSecret('STRIPE_SECRET_KEY', v);
      return v;
    })(),
    publishableKey: env('STRIPE_PUBLISHABLE_KEY', 'pk_test_placeholder'),
    webhookSecret: (() => {
      const v = env('STRIPE_WEBHOOK_SECRET', 'whsec_placeholder');
      validateSecret('STRIPE_WEBHOOK_SECRET', v);
      return v;
    })(),
    priceId: env('STRIPE_PRICE_ID', 'price_placeholder'),
  },
  supabase: {
    url: env('NEXT_PUBLIC_SUPABASE_URL', 'https://placeholder.supabase.co'),
    anonKey: env('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'placeholder'),
    serviceRoleKey: (() => {
      const v = env('SUPABASE_SERVICE_ROLE_KEY', 'placeholder');
      validateSecret('SUPABASE_SERVICE_ROLE_KEY', v);
      return v;
    })(),
  },
  replicate: {
    apiToken: (() => {
      const v = env('REPLICATE_API_TOKEN', 'replicate_placeholder');
      validateSecret('REPLICATE_API_TOKEN', v);
      return v;
    })(),
  },
} as const;
