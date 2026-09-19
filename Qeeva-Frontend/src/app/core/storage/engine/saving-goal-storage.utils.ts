import { ExpenseItem } from '@core/domain/models';

export interface MergeConflictInfo {
  hasConflict: boolean;
  existingTarget?: number;
  incomingTarget?: number;
}

export interface MergeItemResult {
  mergedItem: ExpenseItem;
  conflict: MergeConflictInfo;
}

export function normalizeName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

export function createItemId(name: string | null | undefined, type: ExpenseItem['type'] | string | null | undefined): string {
  const normalizedName = normalizeName(name);
  const normalizedType = (type ?? 'Burn').toString().toLowerCase();
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `item-${normalizedName || 'unnamed'}-${normalizedType}-${timestamp}-${random}`;
}

export function mergeItems(existing: ExpenseItem | null | undefined, incoming: ExpenseItem | null | undefined): MergeItemResult {
  const safeExisting = existing ?? null;
  const safeIncoming = incoming ?? null;
  const existingTarget = safeExisting?.targetTotal;
  const incomingTarget = safeIncoming?.targetTotal;
  const hasConflict = existingTarget !== undefined && incomingTarget !== undefined && existingTarget !== incomingTarget;

  const merged: ExpenseItem = {
    id: safeExisting?.id ?? safeIncoming?.id ?? createItemId(safeIncoming?.name ?? safeExisting?.name, safeIncoming?.type ?? safeExisting?.type),
    name: safeIncoming?.name ?? safeExisting?.name ?? 'Unnamed Item',
    amount: (safeExisting?.amount ?? 0) + (safeIncoming?.amount ?? 0),
    unitPrice: safeIncoming?.unitPrice ?? safeExisting?.unitPrice ?? 0,
    quantity: (safeExisting?.quantity ?? 0) + (safeIncoming?.quantity ?? 0),
    type: safeIncoming?.type ?? safeExisting?.type ?? 'Burn',
    priority: safeExisting?.priority ?? safeIncoming?.priority ?? 'Want',
    targetTotal: hasConflict ? existingTarget : (existingTarget ?? incomingTarget),
    isReducible: safeExisting?.isReducible ?? safeIncoming?.isReducible ?? true,
    isIgnored: Boolean(safeExisting?.isIgnored || safeIncoming?.isIgnored),
    category: safeExisting?.category ?? safeIncoming?.category,
  };

  return {
    mergedItem: merged,
    conflict: {
      hasConflict,
      existingTarget,
      incomingTarget,
    }
  };
}
