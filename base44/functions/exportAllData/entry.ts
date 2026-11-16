import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// User records are not readable through the service role — they are fetched separately below.
const TABLES = [
  'Employee',
  'EmployeeRate',
  'Shift',
  'BaseMixingShift',
  'ScheduledShift',
  'ScheduledBaseMixShift',
  'TimeEntry',
  'Availability',
  'PermanentAvailability',
  'Post',
  'PostLike',
  'PostComment',
  'Flavor',
  'FlavorSet',
  'FlavorPrice',
  'FlavorJugDefaults',
  'FlavorJugInventory',
  'BaseInventory',
  'BaseMixDefaults',
  'BagInventory',
  'Inventory',
  'PalletLot',
  'CaseSize',
  'IngredientInventory',
  'IngredientConversion',
  'MaterialInventory',
  'MaterialDefaults',
  'StockItem',
  'StockInventory',
  'SupplyPrice',
  'OrderPickup',
  'OrderPickupItem',
  'Freezer',
  'FreezerItem',
  'MachineLog',
  'WorkAidCounter',
  'WorkAidVideo',
  'PerformanceSettings',
  'FacilityCost',
  'SavingsGoal',
  'PayPeriodSettings',
  'TaxSettings',
];

async function fetchAll(entity: any) {
  const rows: any[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 200; i++) {
    const page = await entity.list({ sort: '-created_date', limit: 500, ...(cursor ? { cursor } : {}) });
    const items = Array.isArray(page) ? page : page.items || [];
    rows.push(...items);
    if (Array.isArray(page) || !page.has_more || !page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return rows;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Only admins can export app data' }, { status: 403 });

    const tables: Record<string, any[]> = {};
    const errors: string[] = [];

    for (let i = 0; i < TABLES.length; i += 6) {
      const batch = TABLES.slice(i, i + 6);
      const results = await Promise.allSettled(
        batch.map((name) => fetchAll(base44.asServiceRole.entities[name]))
      );
      results.forEach((result, idx) => {
        const name = batch[idx];
        if (result.status === 'fulfilled') {
          tables[name] = result.value;
        } else {
          tables[name] = [];
          errors.push(`${name}: ${result.reason?.message || 'failed'}`);
        }
      });
    }

    try {
      const users = await base44.entities.User.list();
      tables.User = Array.isArray(users) ? users : users?.items || [];
    } catch (e: any) {
      tables.User = [];
      errors.push(`User: ${e.message}`);
    }

    if (errors.length > 0) {
      return Response.json(
        {
          error:
            'The export was interrupted by the app\'s read limit, so it would be incomplete. Please try again in about a minute.',
          errors,
        },
        { status: 429 }
      );
    }

    const counts: Record<string, number> = {};
    Object.keys(tables).forEach((name) => {
      counts[name] = tables[name].length;
    });

    return Response.json({
      app: 'Pace Intelligence',
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      total_records: Object.values(counts).reduce((sum, n) => sum + n, 0),
      counts,
      tables,
      errors,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}