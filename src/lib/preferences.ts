import { Store } from '@tauri-apps/plugin-store';

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load('preferences.json');
  }
  return store;
}

export async function getPreference<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const s = await getStore();
    const value = await s.get<T>(key);
    return value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setPreference<T>(key: string, value: T): Promise<void> {
  try {
    const s = await getStore();
    await s.set(key, value);
    await s.save();
  } catch {
    // Silently fail — preference persistence is not critical
  }
}
