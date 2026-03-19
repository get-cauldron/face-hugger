import { describe, it, expect } from 'vitest';
import { formatBytes, formatSpeed, formatEta } from './repoUtils';

describe('formatBytes', () => {
  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });
  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });
  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });
});

describe('formatEta', () => {
  it('returns "--" for zero or negative', () => {
    expect(formatEta(0)).toBe('--');
    expect(formatEta(-1)).toBe('--');
  });
  it('formats seconds', () => {
    expect(formatEta(45)).toBe('45s');
  });
  it('formats minutes', () => {
    expect(formatEta(90)).toBe('1m 30s');
  });
});

describe('formatSpeed', () => {
  it('appends /s to formatBytes output', () => {
    expect(formatSpeed(1024)).toBe('1 KB/s');
  });
});
