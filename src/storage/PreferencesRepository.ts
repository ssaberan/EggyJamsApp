import type { AppPreferences } from './types';

export interface PreferencesRepository {
  getPreferences(): Promise<AppPreferences>;
  savePreferences(prefs: AppPreferences): Promise<void>;
}
