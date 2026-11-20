/**
 * Browser-safe entry point: no Node or Playwright imports, so the web app's client
 * components can use it.
 */
export * from "./config";
export * from "./criteria";
export * from "./score";
export { normaliseUrl, isSameSite, isPdfUrl } from "./url";
export {
  VERIFICATION_METHODS,
  VERIFICATION_META_NAME,
  VERIFICATION_TXT_PREFIX,
  VERIFICATION_WELL_KNOWN_PATH,
  verificationInstructions,
  type VerificationMethod,
} from "./verification";
