// Encrypted local persistence for the zustand store.
// Payload is XChaCha20-Poly1305 encrypted (pure JS, Expo Go compatible) with a per-device key kept in
// expo-secure-store (iOS Keychain / Android Keystore). The ciphertext lives in AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, hexToBytes, utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils.js';
import type { StateStorage } from 'zustand/middleware';

const KEY_NAME = 'righto.v1.key';
const PREFIX = 'enc1:';
let keyPromise: Promise<Uint8Array | null> | null = null;

async function loadKey(): Promise<Uint8Array | null> {
  if (!keyPromise) {
    keyPromise = (async () => {
      try {
        if (!(await SecureStore.isAvailableAsync())) return null;
        const existing = await SecureStore.getItemAsync(KEY_NAME);
        if (existing) return hexToBytes(existing);
        const fresh = Crypto.getRandomBytes(32);
        await SecureStore.setItemAsync(KEY_NAME, bytesToHex(fresh), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
        return fresh;
      } catch {
        return null;
      }
    })();
  }
  return keyPromise;
}

export function encrypt(key: Uint8Array, plain: string) {
  const nonce = Crypto.getRandomBytes(24);
  const ct = xchacha20poly1305(key, nonce).encrypt(utf8ToBytes(plain));
  return PREFIX + bytesToHex(nonce) + ':' + bytesToHex(ct);
}

export function decrypt(key: Uint8Array, stored: string) {
  const [nonceHex, ctHex] = stored.slice(PREFIX.length).split(':');
  return bytesToUtf8(xchacha20poly1305(key, hexToBytes(nonceHex)).decrypt(hexToBytes(ctHex)));
}

export const encryptedStorage: StateStorage = {
  async getItem(name) {
    const raw = await AsyncStorage.getItem(name);
    if (raw == null) return null;
    if (!raw.startsWith(PREFIX)) return raw; // plain fallback (web / no secure store)
    const key = await loadKey();
    if (!key) return null;
    try { return decrypt(key, raw); } catch { return null; }
  },
  async setItem(name, value) {
    const key = await loadKey();
    await AsyncStorage.setItem(name, key ? encrypt(key, value) : value);
  },
  async removeItem(name) {
    await AsyncStorage.removeItem(name);
  },
};

/** Wipe everything Righto keeps on this device (sign-out / delete account). */
export async function wipeLocalData(storeName: string) {
  await AsyncStorage.removeItem(storeName);
  try { await SecureStore.deleteItemAsync(KEY_NAME); } catch { /* ignore */ }
  keyPromise = null;
}
