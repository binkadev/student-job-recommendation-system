import { useCallback, useState } from "react";
import { readStorage, writeStorage } from "../utils/localStorage";

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => readStorage(key, initialValue));

  const updateValue = useCallback(
    (nextValue: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved = typeof nextValue === "function" ? (nextValue as (current: T) => T)(current) : nextValue;
        writeStorage(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, updateValue] as const;
}
