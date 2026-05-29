import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { employee_id, employee_name, employee_number, action, entry_id, clock_in } = await req.json();

    if (action === 'clock_in') {
      const now = new Date().toISOString();
      const created = await base44.asServiceRole.entities.TimeEntry.create({
        employee_id,
        employee_name,
        employee_number,
        clock_in: now,
      });
      return Response.json({ entry: created, time: now });
    }

    if (action === 'clock_out') {
      const clockOut = new Date().toISOString();
      const mins = (new Date(clockOut) - new Date(clock_in)) / 60000;
      const total_hours = Math.max(0, mins / 60);
      const updated = await base44.asServiceRole.entities.TimeEntry.update(entry_id, {
        clock_out: clockOut,
        total_hours,
      });
      return Response.json({ entry: updated, time: clockOut, total_hours });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});