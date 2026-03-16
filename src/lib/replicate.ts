import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// ---------- Style prompt templates ----------

export const STYLE_PROMPTS: Record<string, string> = {
  professional:
    "Professional corporate headshot, {background} background, sharp focus, studio lighting, high-end commercial photography, wearing business attire, confident expression, 8k quality",
  casual:
    "Natural casual headshot, {background} background, soft natural lighting, relaxed authentic expression, lifestyle photography, approachable look, high quality portrait",
  creative:
    "Creative artistic headshot, {background} background, dramatic lighting, bold composition, editorial photography style, unique perspective, magazine quality",
  executive:
    "Executive portrait headshot, {background} background, power pose, premium studio lighting, luxury feel, commanding presence, boardroom ready, ultra sharp",
  linkedin:
    "LinkedIn profile headshot, {background} background, friendly professional smile, business casual attire, warm studio lighting, trustworthy appearance, high resolution",
  tech:
    "Tech industry headshot, {background} background, modern clean aesthetic, smart casual, approachable startup vibe, natural lighting, authentic smile",
  medical:
    "Medical professional headshot, {background} background, clean white coat, trustworthy caring expression, clinical yet warm, professional healthcare photography",
  legal:
    "Legal professional headshot, {background} background, formal attire, authoritative composed expression, traditional studio setup, dignified portrait",
};

export const BACKGROUND_DESCRIPTIONS: Record<string, string> = {
  neutral: "neutral gray gradient",
  white: "clean white",
  office: "modern office blurred",
  outdoor: "outdoor natural blurred",
  dark: "dark moody gradient",
  studio: "classic studio backdrop",
  city: "city skyline blurred",
};

const MODEL = "black-forest-labs/flux-dev-lora";

// ---------- Types ----------

interface GenerateOptions {
  imageUrls: string[];
  style: string;
  background?: string;
  numOutputs?: number;
  userId: string;
  jobId: string;
}

interface GenerateResult {
  urls: string[];
  predictionId: string;
}

// ---------- Core generation ----------

export async function generateHeadshots({
  imageUrls,
  style,
  background = "neutral",
  numOutputs = 4,
  userId,
  jobId,
}: GenerateOptions): Promise<GenerateResult> {
  const promptTemplate = STYLE_PROMPTS[style] || STYLE_PROMPTS.professional;
  const bgDescription = BACKGROUND_DESCRIPTIONS[background] || background;
  const prompt = promptTemplate.replace("{background}", bgDescription);

  const prediction = await withRetry(async () => {
    return replicate.predictions.create({
      model: MODEL,
      input: {
        prompt,
        image: imageUrls[0], // primary input image
        num_outputs: numOutputs,
        guidance_scale: 3.5,
        num_inference_steps: 28,
        seed: Math.floor(Math.random() * 2147483647),
        lora_scale: 0.9,
        output_format: "webp",
        output_quality: 90,
      },
      ...(process.env.NEXT_PUBLIC_APP_URL && {
        webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/replicate`,
        webhook_events_filter: ["completed"],
      }),
    });
  });

  // Return immediately — caller should poll via getPredictionStatus() or wait for webhook
  return {
    urls: [],
    predictionId: prediction.id,
  };
}

// ---------- Retry logic ----------

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // Don't retry on auth errors
      if (
        error instanceof Error &&
        (error.message.includes("401") || error.message.includes("403"))
      ) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(
          `Replicate request failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${Math.round(delay)}ms:`,
          error instanceof Error ? error.message : error
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Utilities ----------

export function getAvailableStyles(): string[] {
  return Object.keys(STYLE_PROMPTS);
}

export function getAvailableBackgrounds(): string[] {
  return Object.keys(BACKGROUND_DESCRIPTIONS);
}

export function getStylePrompt(style: string): string | undefined {
  return STYLE_PROMPTS[style];
}

export async function cancelPrediction(predictionId: string): Promise<void> {
  await replicate.predictions.cancel(predictionId);
}

export async function getPredictionStatus(predictionId: string) {
  return replicate.predictions.get(predictionId);
}
