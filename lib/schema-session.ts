import { type EventSchema, createEmptySchema } from './event-schema';

const KEY = 'venuehopperSchema';

export function saveSchema(schema: EventSchema): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(schema));
  } catch {
    // sessionStorage unavailable (SSR, private mode quota) — silent fail
  }
}

export function loadSchema(): EventSchema | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EventSchema;
  } catch {
    return null;
  }
}

export function loadOrCreateSchema(): EventSchema {
  return loadSchema() ?? createEmptySchema();
}

export function clearSchema(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
