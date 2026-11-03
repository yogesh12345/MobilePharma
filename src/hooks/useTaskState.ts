import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useMobileAccess } from "../context/mobileAccess";
import { navigationKey, readTaskState, saveTaskState, taskStateKey } from "../services/navigationState";

export function useTaskState<T>(task: string, field: string, fallback: T, isValid: (value: unknown) => value is T): [T, Dispatch<SetStateAction<T>>] {
  const access = useMobileAccess();
  const key = taskStateKey(navigationKey(access.data?.account.userId ?? 0, access.customer?.customerId ?? null), `${task}:${field}`);
  const [value, setValue] = useState<T>(() => {
    const saved = readTaskState<unknown>(key, fallback);
    return isValid(saved) ? saved : fallback;
  });
  const latest = useRef(value);

  useLayoutEffect(() => {
    latest.current = value;
    saveTaskState(key, value);
  }, [key, value]);

  useEffect(() => {
    const saveOnExit = () => saveTaskState(key, latest.current);
    window.addEventListener("pagehide", saveOnExit);
    return () => window.removeEventListener("pagehide", saveOnExit);
  }, [key]);

  return [value, setValue];
}
