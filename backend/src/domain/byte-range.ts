export interface ByteRange {
  readonly end: number;
  readonly length: number;
  readonly start: number;
}

export class MalformedByteRangeError extends Error {
  public constructor(message = 'Malformed bytes range') {
    super(message);
    this.name = 'MalformedByteRangeError';
  }
}

export class UnsatisfiableByteRangeError extends Error {
  public constructor(public readonly resourceSize: number) {
    super(`Byte range is unsatisfiable for a resource of ${resourceSize} bytes`);
    this.name = 'UnsatisfiableByteRangeError';
  }
}

export class MultipleByteRangesNotSupportedError extends Error {
  public constructor() {
    super('Multiple byte ranges are not supported');
    this.name = 'MultipleByteRangesNotSupportedError';
  }
}

/** Parses one RFC 9110 bytes range and normalizes it to inclusive offsets. */
export function parseByteRange(value: string, resourceSize: number): ByteRange {
  assertResourceSize(resourceSize);

  const match = /^bytes=([^\s]+)$/i.exec(value.trim());
  if (match === null || match[1] === undefined) throw new MalformedByteRangeError();

  const rangeValue = match[1];
  if (rangeValue.includes(',')) throw new MultipleByteRangesNotSupportedError();

  const parts = /^(\d*)-(\d*)$/.exec(rangeValue);
  if (parts === null || parts[1] === undefined || parts[2] === undefined) {
    throw new MalformedByteRangeError();
  }

  const [, startText, endText] = parts;
  if (startText === '' && endText === '') throw new MalformedByteRangeError();
  if (resourceSize === 0) throw new UnsatisfiableByteRangeError(resourceSize);

  if (startText === '') {
    const suffixLength = parseInteger(endText);
    if (suffixLength === 0n) throw new UnsatisfiableByteRangeError(resourceSize);
    const length = Number(suffixLength > BigInt(resourceSize) ? BigInt(resourceSize) : suffixLength);
    return { start: resourceSize - length, end: resourceSize - 1, length };
  }

  const startValue = parseInteger(startText);
  if (startValue >= BigInt(resourceSize)) throw new UnsatisfiableByteRangeError(resourceSize);
  const start = Number(startValue);

  if (endText === '') return { start, end: resourceSize - 1, length: resourceSize - start };

  const requestedEnd = parseInteger(endText);
  if (requestedEnd < startValue) throw new UnsatisfiableByteRangeError(resourceSize);
  const end = Number(requestedEnd >= BigInt(resourceSize) ? BigInt(resourceSize - 1) : requestedEnd);
  return { start, end, length: end - start + 1 };
}

function parseInteger(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new MalformedByteRangeError();
  }
}

function assertResourceSize(resourceSize: number): void {
  if (!Number.isSafeInteger(resourceSize) || resourceSize < 0) {
    throw new RangeError('Resource size must be a non-negative safe integer');
  }
}
