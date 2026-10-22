import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { PluginMapSettings } from '../models/types';

const SETTINGS_DOC_REF = doc(db, 'plugin_map_settings', 'config');

export const DEFAULT_PLUGIN_SETTINGS: PluginMapSettings = {
  isEnabled: true,
  pluginTitle: 'Restaurant Map & Direct Ordering',
  defaultLat: 33.7297, // Kashmir / India region fallback
  defaultLng: 75.1498,
  defaultZoom: 13,
  allowPublicRegistration: true,
  autoApproveNewRestaurants: false,
};

export const pluginSettingsService = {
  async getSettings(): Promise<PluginMapSettings> {
    try {
      const snap = await getDoc(SETTINGS_DOC_REF);
      if (snap.exists()) {
        return snap.data() as PluginMapSettings;
      }
      // Bootstrap default settings if doc does not exist
      await setDoc(SETTINGS_DOC_REF, {
        ...DEFAULT_PLUGIN_SETTINGS,
        updatedAt: serverTimestamp(),
      });
      return DEFAULT_PLUGIN_SETTINGS;
    } catch (err) {
      console.warn('Error fetching plugin_map_settings:', err);
      return DEFAULT_PLUGIN_SETTINGS;
    }
  },

  subscribeSettings(callback: (settings: PluginMapSettings) => void) {
    return onSnapshot(
      SETTINGS_DOC_REF,
      (snap) => {
        if (snap.exists()) {
          callback(snap.data() as PluginMapSettings);
        } else {
          callback(DEFAULT_PLUGIN_SETTINGS);
        }
      },
      (err) => {
        console.warn('Plugin settings subscription error:', err);
        callback(DEFAULT_PLUGIN_SETTINGS);
      }
    );
  },

  async updateSettings(partial: Partial<PluginMapSettings>): Promise<void> {
    await setDoc(
      SETTINGS_DOC_REF,
      {
        ...partial,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },

  async togglePluginStatus(enabled: boolean): Promise<void> {
    await this.updateSettings({ isEnabled: enabled });
  },
};
