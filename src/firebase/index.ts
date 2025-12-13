import { getApps, getApp, initializeApp } from 'firebase/app';
import { firebaseConfig } from './config';

function initializeFirebase() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export { initializeFirebase };
export * from './provider';
