/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { base64ToArray } from '../helpers/array-base64-translator';

/**
 * Gets a PushSubscription for the current user that uses `vapidKey` as its application server key.
 *
 * An existing subscription is only reused if it was created with the same key. A subscription
 * stays bound to the key it was created with, and browsers reject `PushManager.subscribe()` with
 * a different key while a subscription exists, so on a mismatch the existing subscription is
 * unsubscribed first and a new one is created with `vapidKey`. If the browser does not expose the
 * key of the existing subscription, the existing subscription is reused.
 */
export async function getPushSubscription(
  swRegistration: ServiceWorkerRegistration,
  vapidKey: string
): Promise<PushSubscription> {
  // Chrome <= 75 doesn't support base64-encoded VAPID key. For backward compatibility, VAPID key
  // submitted to pushManager#subscribe must be of type Uint8Array.
  const applicationServerKey = base64ToArray(vapidKey);

  const subscription = await swRegistration.pushManager.getSubscription();
  if (subscription) {
    if (isSubscribedWithKey(subscription, applicationServerKey)) {
      return subscription;
    }
    await subscription.unsubscribe();
  }

  return swRegistration.pushManager.subscribe({
    userVisibleOnly: true,
    // `PushManager.subscribe` expects a `BufferSource`; `base64ToArray` produces a typed array.
    // Cast to satisfy the lib typing differences across TS DOM versions.
    applicationServerKey: applicationServerKey as unknown as BufferSource
  });
}

/**
 * Returns false if the browser exposes the application server key of `subscription` and it differs
 * from `expectedKey`, true otherwise. Keys are compared byte-wise, so different base64 spellings of
 * the same key are considered equal.
 */
function isSubscribedWithKey(
  subscription: PushSubscription,
  expectedKey: Uint8Array
): boolean {
  const currentKey = subscription.options?.applicationServerKey;
  if (!currentKey) {
    return true;
  }

  const currentKeyBytes = new Uint8Array(currentKey);
  return (
    currentKeyBytes.length === expectedKey.length &&
    currentKeyBytes.every((byte, i) => byte === expectedKey[i])
  );
}

/**
 * Unsubscribes the current PushSubscription, if there is one.
 *
 * @returns The result of `PushSubscription.unsubscribe()`, or `true` if there is no subscription.
 */
export async function unsubscribePushSubscription(
  swRegistration: ServiceWorkerRegistration
): Promise<boolean> {
  const subscription = await swRegistration.pushManager.getSubscription();
  if (subscription) {
    return subscription.unsubscribe();
  }

  // If there's no subscription, consider it a success.
  return true;
}
