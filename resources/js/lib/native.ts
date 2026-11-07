import { Capacitor } from '@capacitor/core';

/**
 * Is the platform running inside the Android/iOS app?
 *
 * The app is the website in a native shell (Capacitor). One answer,
 * asked in one place, because three things differ inside it: speech
 * goes through the phone's own engine, a daily reminder is scheduled,
 * and nothing may ask the learner to pay outside the store — the
 * stores' rule, and the most common reason an app is rejected.
 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
