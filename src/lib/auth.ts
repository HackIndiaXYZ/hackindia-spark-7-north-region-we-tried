import { cookies } from "next/headers";

const AUTH_COOKIE_NAME = "session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecretKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET || "default-secret-change-me";
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Check email/password against env vars */
export function verifyCredentials(email: string, password: string): boolean {
  const validEmail = (process.env.RECRUITER_EMAIL || "admin@interviewai.com").trim().toLowerCase();
  const validPassword = process.env.RECRUITER_PASSWORD || "admin123";
  return email.trim().toLowerCase() === validEmail && password === validPassword;
}

/** Create an HMAC-signed session token */
export async function createSessionToken(): Promise<string> {
  const payload = JSON.stringify({
    role: "recruiter",
    iat: Date.now(),
  });
  
  // Base64URL encode payload
  const encodedPayload = btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  
  // Sign payload
  const encoder = new TextEncoder();
  const key = await getSecretKey();
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(encodedPayload)
  );
  
  // Base64URL encode signature
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureBase64 = btoa(String.fromCharCode.apply(null, signatureArray))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${encodedPayload}.${signatureBase64}`;
}

/** Verify an HMAC-signed session token */
export async function verifySessionToken(token: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  
  const [encodedPayload, signatureBase64url] = parts;
  
  try {
    // Decode Base64URL signature back to Uint8Array
    let signatureBase64 = signatureBase64url.replace(/-/g, "+").replace(/_/g, "/");
    while (signatureBase64.length % 4) signatureBase64 += "=";
    
    const signatureBinary = atob(signatureBase64);
    const signatureBytes = new Uint8Array(signatureBinary.length);
    for (let i = 0; i < signatureBinary.length; i++) {
      signatureBytes[i] = signatureBinary.charCodeAt(i);
    }

    const encoder = new TextEncoder();
    const key = await getSecretKey();
    
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(encodedPayload)
    );
  } catch (error) {
    return false;
  }
}

/** Check if the current request is authenticated (for server components) */
export async function getSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME);
  if (!sessionCookie?.value) return false;
  return await verifySessionToken(sessionCookie.value);
}

export { AUTH_COOKIE_NAME, COOKIE_MAX_AGE };
