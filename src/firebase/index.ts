import { getApps, getApp, initializeApp } from 'firebase/app';
import { firebaseConfig } from './config';
import { useUser } from './auth/use-user';

function initializeFirebase() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export { initializeFirebase, useUser };
export * from './provider';
