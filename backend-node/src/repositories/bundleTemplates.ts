/**
 * Bundle template repository.
 *
 * Loads templates with their slots and allowed roles pre-populated.
 * The template selector uses this to route generation requests to the correct template.
 */
import { sql } from '../db.js';
import type {
  BundleTemplateRow,
  BundleTemplateSlotRow,
  BundleTemplateSlotRoleRow,
  BundleTemplateWithSlots,
} from '../types/entities.js';

/**
 * Returns all active bundle templates with their slots and allowed roles.
 * Used by the product coverage simulation endpoint (AC10.2, AC10.3).
 */
export async function listAllActiveTemplates(): Promise<BundleTemplateWithSlots[]> {
  const templates = await sql<BundleTemplateRow[]>`
    SELECT * FROM bundle_template WHERE active = true ORDER BY id ASC
  `;
  if (templates.length === 0) return [];

  const slots = await sql<BundleTemplateSlotRow[]>`
    SELECT * FROM bundle_template_slot
    WHERE bundle_template_id = ANY(${sql.array(templates.map(t => t.id), 'int8')})
    ORDER BY display_order ASC
  `;

  const slotIds = slots.map(s => s.id);
  const roleRows = slotIds.length > 0
    ? await sql<BundleTemplateSlotRoleRow[]>`
        SELECT * FROM bundle_template_slot_role
        WHERE slot_id = ANY(${sql.array(slotIds, 'int8')})
      `
    : [];

  const rolesBySlot = new Map<number, string[]>();
  for (const row of roleRows) {
    const existing = rolesBySlot.get(row.slot_id) ?? [];
    existing.push(row.role);
    rolesBySlot.set(row.slot_id, existing);
  }

  const slotsByTemplate = new Map<number, BundleTemplateSlotRow[]>();
  for (const slot of slots) {
    const existing = slotsByTemplate.get(slot.bundle_template_id) ?? [];
    existing.push(slot);
    slotsByTemplate.set(slot.bundle_template_id, existing);
  }

  return templates.map(template => ({
    ...template,
    slots: (slotsByTemplate.get(template.id) ?? []).map(slot => ({
      ...slot,
      allowed_roles: rolesBySlot.get(slot.id) ?? [],
    })),
  }));
}

/**
 * Finds an ACTIVE bundle template by code, with all slots and allowed roles.
 * Returns null if not found or inactive.
 */
export async function findTemplateByCode(
  code: string,
): Promise<BundleTemplateWithSlots | null> {
  const templates = await sql<BundleTemplateRow[]>`
    SELECT * FROM bundle_template
    WHERE code = ${code} AND active = true
  `;

  if (templates.length === 0) return null;

  const template = templates[0];

  const slots = await sql<BundleTemplateSlotRow[]>`
    SELECT * FROM bundle_template_slot
    WHERE bundle_template_id = ${template.id}
    ORDER BY display_order ASC
  `;

  if (slots.length === 0) {
    return { ...template, slots: [] };
  }

  const slotIds = slots.map(s => s.id);
  const roleRows = await sql<BundleTemplateSlotRoleRow[]>`
    SELECT * FROM bundle_template_slot_role
    WHERE slot_id = ANY(${sql.array(slotIds, 'int8')})
  `;

  // Group roles by slot_id
  const rolesBySlot = new Map<number, string[]>();
  for (const row of roleRows) {
    const existing = rolesBySlot.get(row.slot_id) ?? [];
    existing.push(row.role);
    rolesBySlot.set(row.slot_id, existing);
  }

  return {
    ...template,
    slots: slots.map(slot => ({
      ...slot,
      allowed_roles: rolesBySlot.get(slot.id) ?? [],
    })),
  };
}
