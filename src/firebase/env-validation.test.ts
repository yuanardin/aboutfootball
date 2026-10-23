import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OPTIONAL_FIREBASE_ENV_KEYS,
  REQUIRED_FIREBASE_ENV_KEYS,
  getMissingRequiredFirebaseEnvKeys,
  isFirebaseEnvConfigured,
  type FirebaseEnvValues,
} from './env-validation';

function coreValues(overrides: FirebaseEnvValues = {}): FirebaseEnvValues {
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'scorecast.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'scorecast',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:1234567890:web:abcdef',
    ...overrides,
  };
}

test('only Authentication and Firestore keys are required', () => {
  assert.deepEqual([...REQUIRED_FIREBASE_ENV_KEYS], [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ]);
});

test('Storage, Messaging and Analytics keys are optional', () => {
  for (const key of OPTIONAL_FIREBASE_ENV_KEYS) {
    assert.equal((REQUIRED_FIREBASE_ENV_KEYS as readonly string[]).includes(key), false);
  }
});

test('missing optional values never mark Firebase as unconfigured', () => {
  const values = coreValues({
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: '',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: undefined,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: '',
  });

  assert.deepEqual(getMissingRequiredFirebaseEnvKeys(values), []);
  assert.equal(isFirebaseEnvConfigured(values), true);
});

test('completely absent optional values still keep Firebase configured', () => {
  assert.equal(isFirebaseEnvConfigured(coreValues()), true);
});

test('each missing core value is reported by name', () => {
  for (const key of REQUIRED_FIREBASE_ENV_KEYS) {
    const values = coreValues({ [key]: '' });

    assert.deepEqual(getMissingRequiredFirebaseEnvKeys(values), [key]);
    assert.equal(isFirebaseEnvConfigured(values), false);
  }
});

test('blank or whitespace-only values count as missing', () => {
  const values = coreValues({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: '   ' });

  assert.deepEqual(getMissingRequiredFirebaseEnvKeys(values), [
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  ]);
});

test('validation never returns or leaks the configured values', () => {
  const values = coreValues({ NEXT_PUBLIC_FIREBASE_API_KEY: '' });
  const missing = getMissingRequiredFirebaseEnvKeys(values);

  assert.deepEqual(missing, ['NEXT_PUBLIC_FIREBASE_API_KEY']);
  assert.equal(JSON.stringify(missing).includes('api-key'), false);
});
