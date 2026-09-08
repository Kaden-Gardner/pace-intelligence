import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Auto-generates 8-hour weekday (Mon–Fri) time entries for salary employees,
// clocking in at 7:00 AM local (Mountain) time. Salary staff don't use the
// time clock, so these entries represent their fixed weekly hours.
//
// Idempotent: if a salary employee already has any entry on a given weekday,
// that day is skipped — safe to re-run.
//
// Default target week:
//   - On Sunday → fills the UPCOMING week (Mon–Fri).
//   - Any other day → fills the current week (the Monday that started this week).
// Override with { "week_start": "YYYY-MM-DD" } (a Monday) to backfill a week.

function getMountainOffsetMs() {
  const now = new Date();
  const denverStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(now);
  const [datePart, timePart] = denverStr.split(", ");
  const [mo, dy, yr] = datePart.split("/");
  const denverLocal = new Date(`${yr}-${mo}-${dy}T${timePart}Z`);
  return now.getTime() - denverLocal.getTime();
}

function pad(n) { return String(n).padStart(2, "0"); }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const offsetMs = getMountainOffsetMs();
    const nowMt = new Date(new Date().getTime() - offsetMs);

    let weekStart;
    if (body.week_start) {
      weekStart = new Date(body.week_start + "T00:00:00");
    } else {
      const day = nowMt.getDay(); // 0 Sun .. 6 Sat
      if (day === 0) {
        // Sunday → upcoming Monday (tomorrow)
        weekStart = new Date(nowMt.getFullYear(), nowMt.getMonth(), nowMt.getDate() + 1);
      } else {
        // Mon–Sat → Monday that started this week
        weekStart = new Date(nowMt.getFullYear(), nowMt.getMonth(), nowMt.getDate() - (day - 1));
      }
    }
    if (isNaN(weekStart.getTime())) {
      return Response.json({ error: "Invalid week_start" }, { status: 400 });
    }

    const weekdays = [];
    for (let i = 0; i < 5; i++) {
      weekdays.push(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));
    }

    const employees = await base44.asServiceRole.entities.Employee.list("name", 500);
    const salaryEmps = employees.filter((e) => e.is_salary && !e.terminated);

    const users = await base44.asServiceRole.entities.User.list();
    const userIdByNumber = {};
    users.forEach((u) => { if (u.employee_number) userIdByNumber[u.employee_number] = u.id; });

    // Existing entries (recent) to skip duplicates — keyed by employee_id + Mountain date.
    const recent = await base44.asServiceRole.entities.TimeEntry.list("-clock_in", 2000);
    const existing = new Set();
    recent.forEach((te) => {
      if (!te.clock_in || !te.employee_id) return;
      const d = new Date(new Date(te.clock_in).getTime() - offsetMs);
      existing.add(`${te.employee_id}|${dateKey(d)}`);
    });

    const NOTE = "Salary (auto)";
    let created = 0;
    let skipped = 0;
    const createdRecords = [];

    for (const emp of salaryEmps) {
      const userId = emp.employee_number ? userIdByNumber[emp.employee_number] : null;
      for (const d of weekdays) {
        const key = `${emp.id}|${dateKey(d)}`;
        if (existing.has(key)) { skipped++; continue; }
        const dateStr = dateKey(d);
        const inMs = new Date(`${dateStr}T07:00:00`).getTime() + offsetMs;
        const outMs = inMs + 8 * 3600000;
        const rec = await base44.asServiceRole.entities.TimeEntry.create({
          user_id: userId || null,
          employee_id: emp.id,
          employee_name: emp.name,
          employee_number: emp.employee_number || null,
          clock_in: new Date(inMs).toISOString(),
          clock_out: new Date(outMs).toISOString(),
          total_hours: 8,
          notes: NOTE,
        });
        created++;
        createdRecords.push({ employee: emp.name, date: dateStr, id: rec.id });
      }
    }

    return Response.json({
      ok: true,
      week_start: dateKey(weekStart),
      weekdays: weekdays.map(dateKey),
      salary_employees: salaryEmps.length,
      created,
      skipped,
      records: createdRecords,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}