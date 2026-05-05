import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Called by entity automation when a ScheduledShift is created or updated.
// On CREATE: notify all assigned, on-call, and mixer employees.
// On UPDATE: only notify employees who were newly added to the shift (not those already assigned).
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const eventType = body?.event?.type; // "create" or "update"
  const shift = body?.data;
  const oldShift = body?.old_data; // only present on update events

  if (!shift) return Response.json({ ok: true });

  const allEmployees = await base44.asServiceRole.entities.Employee.list();
  const allUsers = await base44.asServiceRole.entities.User.list();

  const emailByEmpNumber = {};
  allUsers.forEach((u) => {
    if (u.employee_number && u.email) emailByEmpNumber[u.employee_number] = u.email;
  });
  const empById = {};
  allEmployees.forEach((e) => { empById[e.id] = e; });

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

  // For updates: only notify newly added employees (diffing old vs new)
  const prevAssigned = new Set(oldShift?.assigned_employees || []);
  const prevOnCall = new Set(oldShift?.on_call_employees || []);
  const prevMixer = oldShift?.mixer_employee || null;

  const isCreate = eventType === "create";

  // On create: notify everyone. On update: only notify those newly added.
  const newlyAssigned = (shift.assigned_employees || []).filter((id) => isCreate || !prevAssigned.has(id));
  const newlyOnCall = (shift.on_call_employees || []).filter((id) => isCreate || !prevOnCall.has(id));
  const mixerChanged = isCreate || shift.mixer_employee !== prevMixer;

  const actionWord = isCreate ? "been scheduled for" : "been added to";
  const emailPromises = [];

  newlyAssigned.forEach((id) => {
    if (!shouldSend(id)) return;
    const email = getEmail(id);
    const name = empById[id]?.name || "Team Member";
    if (email) {
      emailPromises.push(base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `📅 Shift ${isCreate ? "Scheduled" : "Update"} — ${dateStr}`,
        body: `Hi ${name},\n\nYou've ${actionWord} a shift at Pace Bars.\n\n📅 Date: ${dateStr}\n⏰ Start Time: ${shift.shift_time || "TBD"}\n${shift.special_order ? `⭐ Special Order: ${shift.special_order_name || "Yes"}\n` : ""}${shift.notes ? `📝 Notes: ${shift.notes}\n` : ""}\nCheck the app for full details.\n\n— Pace Bars Scheduling`
      }));
    }
  });

  newlyOnCall.forEach((id) => {
    if (!shouldSend(id)) return;
    const email = getEmail(id);
    const name = empById[id]?.name || "Team Member";
    if (email) {
      emailPromises.push(base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `📅 On-Call ${isCreate ? "Scheduled" : "Update"} — ${dateStr}`,
        body: `Hi ${name},\n\nYou've ${actionWord} an ON-CALL shift at Pace Bars. You may be called in if needed.\n\n📅 Date: ${dateStr}\n⏰ Start Time: ${shift.shift_time || "TBD"}\n${shift.notes ? `📝 Notes: ${shift.notes}\n` : ""}\nCheck the app for full details.\n\n— Pace Bars Scheduling`
      }));
    }
  });

  if (shift.mixer_employee && mixerChanged && shouldSend(shift.mixer_employee)) {
    const email = getEmail(shift.mixer_employee);
    const name = empById[shift.mixer_employee]?.name || "Team Member";
    if (email && shift.shift_time) {
      const [h, m] = shift.shift_time.split(":").map(Number);
      const totalMins = h * 60 + m - 90;
      const hh = Math.floor(((totalMins % 1440) + 1440) % 1440 / 60);
      const mm = ((totalMins % 60) + 60) % 60;
      const mixerTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      emailPromises.push(base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `🧪 Mixer ${isCreate ? "Scheduled" : "Update"} — ${dateStr}`,
        body: `Hi ${name},\n\nYou've ${actionWord} a shift as MIXER at Pace Bars.\n\n📅 Date: ${dateStr}\n⏰ Your Arrival Time: ${mixerTime} (1.5 hrs before shift)\n${shift.notes ? `📝 Notes: ${shift.notes}\n` : ""}\nCheck the app for full details.\n\n— Pace Bars Scheduling`
      }));
    }
  }

  await Promise.allSettled(emailPromises);
  return Response.json({ ok: true, emails_sent: emailPromises.length, event: eventType });
});