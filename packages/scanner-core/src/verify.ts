/** Server-only entry for the web app: domain verification over the SSRF-safe fetcher (no Playwright). */
export { checkVerification, type VerificationResult } from "./verification";
export { createSafeFetchText } from "./net";
export { botUserAgent } from "./config";
