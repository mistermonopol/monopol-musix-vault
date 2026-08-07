import { describe, expect, it } from 'vitest';

import {
  MalformedByteRangeError,
  MultipleByteRangesNotSupportedError,
  parseByteRange,
  UnsatisfiableByteRangeError,
} from '../src/domain/byte-range.js';

describe('parseByteRange', () => {
  it.each([
    ['bytes=0-0', 100, { start: 0, end: 0, length: 1 }],
    ['bytes=0-99', 100, { start: 0, end: 99, length: 100 }],
    ['bytes=50-999', 100, { start: 50, end: 99, length: 50 }],
    ['bytes=99-', 100, { start: 99, end: 99, length: 1 }],
    ['bytes=0-', 100, { start: 0, end: 99, length: 100 }],
    ['bytes=-1', 100, { start: 99, end: 99, length: 1 }],
    ['bytes=-25', 100, { start: 75, end: 99, length: 25 }],
    ['bytes=-999', 100, { start: 0, end: 99, length: 100 }],
    ['BYTES=2-3', 10, { start: 2, end: 3, length: 2 }],
    [' bytes=2-3 ', 10, { start: 2, end: 3, length: 2 }],
  ])('normalizes %s', (header, size, expected) => {
    expect(parseByteRange(header, size)).toEqual(expected);
  });

  it.each(['', 'items=0-1', 'bytes=', 'bytes=-', 'bytes=one-two', 'bytes=1 -2', 'bytes=+1-2']) (
    'distinguishes malformed input %j',
    (header) => expect(() => parseByteRange(header, 100)).toThrow(MalformedByteRangeError),
  );

  it.each(['bytes=100-', 'bytes=100-200', 'bytes=8-7', 'bytes=-0']) (
    'distinguishes unsatisfiable input %j',
    (header) => expect(() => parseByteRange(header, 100)).toThrow(UnsatisfiableByteRangeError),
  );

  it('treats every syntactically valid range as unsatisfiable for an empty file', () => {
    expect(() => parseByteRange('bytes=0-', 0)).toThrow(UnsatisfiableByteRangeError);
    expect(() => parseByteRange('bytes=-1', 0)).toThrow(UnsatisfiableByteRangeError);
  });

  it('rejects multiple ranges explicitly', () => {
    expect(() => parseByteRange('bytes=0-1,4-5', 100)).toThrow(MultipleByteRangesNotSupportedError);
  });

  it('handles integer text larger than JavaScript safe integers without rounding', () => {
    expect(() => parseByteRange('bytes=999999999999999999999-', 100)).toThrow(UnsatisfiableByteRangeError);
    expect(parseByteRange('bytes=-999999999999999999999', 100)).toEqual({ start: 0, end: 99, length: 100 });
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid resource size %s', (size) => {
    expect(() => parseByteRange('bytes=0-', size)).toThrow(RangeError);
  });
});
