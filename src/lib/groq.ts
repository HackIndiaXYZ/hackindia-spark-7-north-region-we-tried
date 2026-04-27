// Bypass SSL checks for corporate/hackathon networks that use self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import Groq from "groq-sdk";

const DEFAULT_MODEL = "llama-3.1-8b-instant";

function normalizeEnvValue(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  return trimmed.length > 0 ? trimmed : null;
}

export function getGroqApiKey(): string | null {
  return (
    normalizeEnvValue(process.env.GROQ_API_KEY) ??
    normalizeEnvValue(process.env.NEXT_PUBLIC_GROQ_API_KEY)
  );
}

export function createGroqClient(): Groq | null {
  const apiKey = getGroqApiKey();
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

export function getGroqModelName(): string {
  return normalizeEnvValue(process.env.GROQ_MODEL) ?? DEFAULT_MODEL;
}

export function isGroqRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("rate limit")
  );
}

export function extractRetryDelaySeconds(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/retry in\s+([\d.]+)s/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.ceil(seconds) : null;
}
