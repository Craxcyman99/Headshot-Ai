/**
 * Input validation helpers for API routes.
 */

import { getAvailableStyles, getAvailableBackgrounds } from './replicate';

const VALID_STYLES = new Set(getAvailableStyles());
const VALID_BACKGROUNDS = new Set(getAvailableBackgrounds());

/**
 * Validate that a style ID is one of the allowed values.
 */
export function validateStyle(style: string | null | undefined): { valid: boolean; error?: string; value: string } {
  const value = style || 'professional';
  if (!VALID_STYLES.has(value)) {
    return { valid: false, error: `Invalid style: "${value}". Allowed: ${[...VALID_STYLES].join(', ')}`, value };
  }
  return { valid: true, value };
}

/**
 * Validate that a background ID is one of the allowed values.
 */
export function validateBackground(bg: string | null | undefined): { valid: boolean; error?: string; value: string } {
  const value = bg || 'neutral';
  if (!VALID_BACKGROUNDS.has(value)) {
    return { valid: false, error: `Invalid background: "${value}". Allowed: ${[...VALID_BACKGROUNDS].join(', ')}`, value };
  }
  return { valid: true, value };
}

/**
 * Validate a UUID string.
 */
export function validateUUID(id: string | null | undefined): { valid: boolean; error?: string; value: string } {
  const value = id || '';
  if (!value) return { valid: false, error: 'ID is required', value };
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return { valid: false, error: 'Invalid ID format', value };
  }
  return { valid: true, value };
}
