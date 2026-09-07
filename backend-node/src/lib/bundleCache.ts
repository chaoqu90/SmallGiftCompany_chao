/**
 * In-memory TTL cache for generated bundle snapshots.
 *
 * Bundles are stored here after generation and evicted once added to cart
 * (at which point they are persisted to the DB). Entries also expire after
 * TTL_MS to avoid unbounded memory growth.
 *
 * This is intentionally process-local. On Lambda, the generate → add-to-cart
 * flow typically hits the same warm container. On cache miss the cart route
 * falls back to a DB lookup (for bundles already persisted).
 */
import type { BundleSnapshot } from '../repositories/generatedBundles.js';

export interface BundleCacheEntry {
  snapshot: BundleSnapshot;
  templateCode: string;
  expiresAt: number;
}

const CACHE = new Map<string, BundleCacheEntry>();
const TTL_MS = 30 * 60 * 1000; // 30 minutes

export function putBundle(publicId: string, snapshot: BundleSnapshot, templateCode: string): void {
  CACHE.set(publicId, { snapshot, templateCode, expiresAt: Date.now() + TTL_MS });
}

export function getBundle(publicId: string): BundleCacheEntry | null {
  const entry = CACHE.get(publicId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(publicId);
    return null;
  }
  return entry;
}

export function evictBundle(publicId: string): void {
  CACHE.delete(publicId);
}
