/**
 * Budget tier repository.
 */
import { sql } from '../db.js';
import type { BudgetTierRow } from '../types/entities.js';

/**
 * Finds an active budget tier by code.
 * Returns null if not found or inactive (triggers BUDGET_TIER_NOT_FOUND).
 */
export async function findBudgetTierByCode(
  code: string,
): Promise<BudgetTierRow | null> {
  const rows = await sql<BudgetTierRow[]>`
    SELECT * FROM budget_tier
    WHERE code = ${code} AND active = true
  `;
  return rows[0] ?? null;
}

/**
 * Returns all active budget tiers (used by simulation service).
 */
export async function listActiveBudgetTiers(): Promise<BudgetTierRow[]> {
  return sql<BudgetTierRow[]>`
    SELECT * FROM budget_tier
    WHERE active = true
    ORDER BY target_retail_price ASC
  `;
}
