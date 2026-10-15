const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/user-not-found': 'No account found for this email.',
  'auth/wrong-password': 'Incorrect password. Try again.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'Network issue. Check your connection and try again.',
  'auth/internal-error': 'Something went wrong on our side. Try again.',
  'auth/popup-blocked': 'The popup was blocked by your browser. Allow popups for this site.',
  'auth/popup-closed-by-user': 'The sign-in window was closed before completing.',
  'auth/cancelled-popup-request': 'The sign-in window was closed before completing.',
  'auth/api-key-not-valid': 'Authentication is misconfigured. Contact the site admin.',
  'auth/invalid-api-key': 'Authentication is misconfigured. Contact the site admin.',
  'auth/operation-not-allowed':
    'This sign-in method is not enabled in the Firebase console.',
  'auth/account-exists-with-different-credential':
    'An account already exists with the same email using a different sign-in method.',
};

export function getFirebaseErrorMessage(code?: string): string {
  if (!code) return FALLBACK_MESSAGE;
  return FIREBASE_ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE;
}