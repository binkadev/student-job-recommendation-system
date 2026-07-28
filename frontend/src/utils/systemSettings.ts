import { getStorageItem, setStorageItem } from "./localStorage";

const SYSTEM_SETTINGS_KEY = "admin-system-settings";

export interface CvSystemSettings {
  maxFileSizeMb: number;
  maxCvsPerUser: number;
}

export interface SystemSettings {
  cv: CvSystemSettings;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  cv: {
    maxFileSizeMb: 10,
    maxCvsPerUser: 5,
  },
};

export function getSystemSettings(): SystemSettings {
  const stored = getStorageItem<Partial<SystemSettings>>(SYSTEM_SETTINGS_KEY, {});
  return {
    cv: {
      maxFileSizeMb: normalizePositiveNumber(stored.cv?.maxFileSizeMb, DEFAULT_SYSTEM_SETTINGS.cv.maxFileSizeMb),
      maxCvsPerUser: normalizePositiveNumber(stored.cv?.maxCvsPerUser, DEFAULT_SYSTEM_SETTINGS.cv.maxCvsPerUser),
    },
  };
}

export function setSystemSettings(settings: SystemSettings) {
  setStorageItem(SYSTEM_SETTINGS_KEY, settings);
}

function normalizePositiveNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}
