import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Called by entity automation when a ScheduledShift is created or updated.
// Sends email to all assigned, on-call, and mixer employees.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const eventType = body?.event?.type; // "create" or "update"
  const shift = body?.data;

  if (!shift) return Response.json({ ok: true });

  const allEmployees = await base44.asServiceRole.entities.Employee.list();
  const allUsers = await base44.asServiceRole.entities.User.list();

  // Build email lookup: employee_number -> email (from User records)
  const emailByEmpNumber = {};
  allUsers.forEach((u) => {
    if (u.employee_number && u.email) emailByEmpNumber[u.employee_number] = u.email;
  });
  // Also map by employee id -> employee record
  const empById = {};
  allEmployees.forEach((e) => { empById[e.id] = e; });

  function getEmail(empId) {
    const emp = empById[empId];
    if (!emp) return null;
    // Prefer app account email (via employee_number match with User records)
    if (emp.employee_number && emailByEmpNumber[emp.employee_number]) {
      return emailByEmpNumber[emp.employee_number];
    }
    // Fall back to email field on Employee record if it exists
    return emp.email || null;
  }

  const dateStr = new Date(shift.shift_date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  const actionWord = eventType === "create" ? "been scheduled for" : "been updated on";
  const emailPromises = [];

  // Working employees
  (shift.assigned_employees || []).forEach((id) => {
    const email = getEmail(id);
    const name = empById[id]?.name || "Team Member";
    if (email) {
      emailPromises.push(base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `📅 Shift Update — ${dateStr}`,
        body: `Hi ${name},\n\nYou've ${actionWord} a shift at Pace Bars.\n\n📅 Date: ${dateStr}\n⏰ Start Time: ${shift.shift_time || "TBD"}\n${shift.special_order ? `⭐ Special Order: ${shift.special_order_name || "Yes"}\n` : ""}${shift.notes ? `📝 Notes: ${shift.notes}\n` : ""}\nCheck the app for full details.\n\n— Pace Bars Scheduling`
      }));
    }
  });

  // On-call employees
  (shift.on_call_employees || []).forEach((id) => {
    const email = getEmail(id);
    const name = empById[id]?.name || "Team Member";
    if (email) {
      emailPromises.push(base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `📅 On-Call Shift — ${dateStr}`,
        body: `Hi ${name},\n\nYou've ${actionWord} an ON-CALL shift at Pace Bars. You may be called in if needed.\n\n📅 Date: ${dateStr}\n⏰ Start Time: ${shift.shift_time || "TBD"}\n${shift.notes ? `📝 Notes: ${shift.notes}\n` : ""}\nCheck the app for full details.\n\n— Pace Bars Scheduling`
      }));
    }
  });

  // Mixer
  if (shift.mixer_employee) {
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
        subject: `🧪 Mixer Shift — ${dateStr}`,
        body: `Hi ${name},\n\nYou've ${actionWord} a shift as MIXER at Pace Bars.\n\n📅 Date: ${dateStr}\n⏰ Your Arrival Time: ${mixerTime} (1.5 hrs before shift)\n${shift.notes ? `📝 Notes: ${shift.notes}\n` : ""}\nCheck the app for full details.\n\n— Pace Bars Scheduling`
      }));
    }
  }

  await Promise.allSettled(emailPromises);
  return Response.json({ ok: true, emails_sent: emailPromises.length });
});