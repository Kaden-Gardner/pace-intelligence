import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Called by entity automation when a ScheduledBaseMixShift is created or updated.
// On CREATE: notify admin, mixers, and shift lead.
// On UPDATE: only notify employees who were newly added to the shift.
// Respects the same notification preferences as production shift scheduling (notifications_disabled).
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const eventType = body?.event?.type; // "create" or "update"
  const shift = body?.data;
  const oldShift = body?.old_data;

  if (!shift) return Response.json({ ok: true });

  const [allEmployees, allUsers, flavorSets] = await Promise.all([
    base44.asServiceRole.entities.Employee.list(),
    base44.asServiceRole.entities.User.list(),
    base44.asServiceRole.entities.FlavorSet.list(),
  ]);

  const emailByEmpNumber = {};
  allUsers.forEach((u) => {
    if (u.employee_number && u.email) emailByEmpNumber[u.employee_number] = u.email;
  });
  const empById = {};
  allEmployees.forEach((e) => { empById[e.id] = e; });

  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });

  function getEmail(empId) {
    const emp = empById[empId];
    if (!emp) return null;
    if (emp.employee_number && emailByEmpNumber[emp.employee_number]) {
      return emailByEmpNumber[emp.employee_number];
    }
    return emp.email || null;
  }

  function shouldSend(empId) {
    const emp = empById[empId];
    if (!emp) return false;
    return !emp.notifications_disabled;
  }

  const dateStr = new Date(shift.shift_date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  const fs = fsMap[shift.flavorset_id];
  const flavorName = fs?.name || "Unknown";
  const batches = shift.batch_size || 1;
  const gallons = batches * 240;

  // Collect all assigned employee IDs with their roles
  const roleMap = {};
  if (shift.admin_employee) roleMap[shift.admin_employee] = "Admin";
  if (shift.shift_lead) roleMap[shift.shift_lead] = "Shift Lead";
  [shift.mixer_1, shift.mixer_2, shift.mixer_3].filter(Boolean).forEach((id) => {
    if (!roleMap[id]) roleMap[id] = "Mixer";
  });

  // For updates: build previous set to diff against
  const prevIds = new Set([oldShift?.admin_employee, oldShift?.shift_lead, oldShift?.mixer_1, oldShift?.mixer_2, oldShift?.mixer_3].filter(Boolean));
  const isCreate = eventType === "create";

  const actionWord = isCreate ? "been scheduled for" : "been added to";
  const emailPromises = [];

  Object.entries(roleMap).forEach(([id, role]) => {
    if (!shouldSend(id)) return;
    if (!isCreate && prevIds.has(id)) return; // already was on the shift — skip
    const email = getEmail(id);
    const name = empById[id]?.name || "Team Member";
    if (email) {
      emailPromises.push(base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `🧪 Base Mix Shift ${isCreate ? "Scheduled" : "Update"} — ${dateStr}`,
        body: `Hi ${name},\n\nYou've ${actionWord} a BASE MIX shift at Pace Bars.\n\n📅 Date: ${dateStr}\n🟣 Flavor Set: ${flavorName}\n🪣 Batches: ${batches} (${gallons} gallons)\n👤 Your Role: ${role}${shift.notes ? `\n📝 Notes: ${shift.notes}` : ""}\n\nCheck the app for full details.\n\n— Pace Bars Scheduling`
      }));
    }
  });

  await Promise.allSettled(emailPromises);
  return Response.json({ ok: true, emails_sent: emailPromises.length, event: eventType });
});