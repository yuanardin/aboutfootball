// Firebase Authentication and Firestore only need these four client values.
// Keep this list in sync with `firebaseConfig` in `./config.ts`.
export const REQUIRED_FIREBASE_ENV_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

// Storage, Cloud Messaging and Analytics are not used by ScoreCast yet, so their
// values must never block Authentication/Firestore from starting.
export const OPTIONAL_FIREBASE_ENV_KEYS = [
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
] as const;

export type RequiredFirebaseEnvKey = (typeof REQUIRED_FIREBASE_ENV_KEYS)[number];
export type OptionalFirebaseEnvKey = (typeof OPTIONAL_FIREBASE_ENV_KEYS)[number];
export type FirebaseEnvKey = RequiredFirebaseEnvKey | OptionalFirebaseEnvKey;

export type FirebaseEnvValues = Partial<Record<FirebaseEnvKey, string | undefined>>;

export function getMissingRequiredFirebaseEnvKeys(values: FirebaseEnvValues): string[] {
  return REQUIRED_FIREBASE_ENV_KEYS.filter((key) => !values[key]?.trim());
}

export function isFirebaseEnvConfigured(values: FirebaseEnvValues): boolean {
  return getMissingRequiredFirebaseEnvKeys(values).length === 0;
}
