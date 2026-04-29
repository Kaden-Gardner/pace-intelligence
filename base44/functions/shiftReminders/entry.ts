import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Runs every 5 minutes. Sends reminder emails 4 hours and 1 hour before each scheduled shift.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  // Load today's and tomorrow's shifts (to cover 4hr window near midnight)
  const shifts = await base44.asServiceRole.entities.ScheduledShift.list("shift_date", 200);
  const relevant = shifts.filter((s) => s.shift_date === todayStr || s.shift_date === tomorrowStr);

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

  const emailPromises = [];

  for (const shift of relevant) {
    if (!shift.shift_time) continue;
    const [h, m] = shift.shift_time.split(":").map(Number);
    const shiftMs = new Date(`${shift.shift_date}T${shift.shift_time}:00`).getTime();
    const diffMins = (shiftMs - now.getTime()) / 60000;

    // Window: within 5 mins of the target (4hr = 240 mins, 1hr = 60 mins)
    const is4hr = diffMins >= 235 && diffMins <= 245;
    const is1hr = diffMins >= 55 && diffMins <= 65;
    if (!is4hr && !is1hr) continue;

    const windowLabel = is4hr ? "4 hours" : "1 hour";
    const dateStr = new Date(shift.shift_date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric"
    });

    const send = (email, name, role) => {
      if (!email) return;
      emailPromises.push(base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `⏰ Reminder: Your shift starts in ${windowLabel} — ${dateStr}`,
        body: `Hi ${name},\n\nThis is a reminder that your ${role} shift at Pace Bars starts in ${windowLabel}.\n\n📅 Date: ${dateStr}\n⏰ Start Time: ${shift.shift_time}${shift.special_order ? `\n⭐ Special Order: ${shift.special_order_name || "Yes"}` : ""}${shift.notes ? `\n📝 Notes: ${shift.notes}` : ""}\n\n— Pace Bars Scheduling`
      }));
    };

    (shift.assigned_employees || []).forEach((id) => {
      send(getEmail(id), empById[id]?.name || "Team Member", "production");
    });

    (shift.on_call_employees || []).forEach((id) => {
      send(getEmail(id), empById[id]?.name || "Team Member", "on-call");
    });

    if (shift.mixer_employee) {
      // Mixer reminder uses their earlier arrival time
      const mixerMins = h * 60 + m - 90;
      const mixerMs = new Date(`${shift.shift_date}T00:00:00`).getTime() + mixerMins * 60000;
      const mixerDiff = (mixerMs - now.getTime()) / 60000;
      const mixerIs4hr = mixerDiff >= 235 && mixerDiff <= 245;
      const mixerIs1hr = mixerDiff >= 55 && mixerDiff <= 65;
      if (mixerIs4hr || mixerIs1hr) {
        const mixerWindow = mixerIs4hr ? "4 hours" : "1 hour";
        const mixerEmail = getEmail(shift.mixer_employee);
        const mixerName = empById[shift.mixer_employee]?.name || "Team Member";
        if (mixerEmail) {
          emailPromises.push(base44.asServiceRole.integrations.Core.SendEmail({
            to: mixerEmail,
            subject: `⏰ Reminder: Your MIXER arrival is in ${mixerWindow} — ${dateStr}`,
            body: `Hi ${mixerName},\n\nThis is a reminder that you need to arrive as MIXER in ${mixerWindow} (1.5 hrs before the shift starts).\n\n📅 Date: ${dateStr}\n⏰ Shift Start: ${shift.shift_time}${shift.notes ? `\n📝 Notes: ${shift.notes}` : ""}\n\n— Pace Bars Scheduling`
          }));
        }
      }
    }
  }

  await Promise.allSettled(emailPromises);
  return Response.json({ ok: true, reminders_sent: emailPromises.length, checked_shifts: relevant.length });
});