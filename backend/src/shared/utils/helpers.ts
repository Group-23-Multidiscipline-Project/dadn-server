export const parseJsonToObject = (
  rawPayload: string,
): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(rawPayload) as unknown;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return null;
  } catch {
    return null;
  }
};

export const resolveTimestamp = (timestamp: unknown): Date | null => {
  if (timestamp === undefined || timestamp === null) {
    return new Date();
  }

  if (typeof timestamp !== 'string' && typeof timestamp !== 'number') {
    return null;
  }

  const parsedDate = new Date(timestamp);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

export const coerceNumber = (input: unknown): number | null => {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }

  if (typeof input === 'string' && input.trim().length > 0) {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

export const coerceBoolean = (input: unknown): boolean | null => {
  if (typeof input === 'boolean') {
    return input;
  }

  if (typeof input === 'number') {
    if (input === 1) {
      return true;
    }
    if (input === 0) {
      return false;
    }
  }

  if (typeof input === 'string') {
    const normalized = input.trim().toLowerCase();

    if (normalized === 'true' || normalized === '1') {
      return true;
    }

    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  return null;
};

export const coerceString = (input: unknown): string | undefined => {
  if (typeof input !== 'string') {
    return undefined;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normalizePayload = (
  payload: unknown,
): Record<string, unknown> | null => {
  if (payload && typeof payload === 'object' && !Buffer.isBuffer(payload)) {
    return payload as Record<string, unknown>;
  }

  if (Buffer.isBuffer(payload)) {
    return parseJsonToObject(payload.toString('utf-8'));
  }

  if (typeof payload === 'string') {
    return parseJsonToObject(payload);
  }

  return null;
};
