import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Triggered when a production Shift record is created.
// Sends a summary email to any admin employees who have opted into shift post notifications.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const shift = body?.data;
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

  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });

  // Only admins who opted in to shift post notifications
  const recipients = allEmployees.filter((e) =>
    e.app_role === "admin" && e.notify_shift_posts && !e.notifications_disabled && e.employee_number && emailByEmpNumber[e.employee_number]
  );

  if (recipients.length === 0) return Response.json({ ok: true, emails_sent: 0 });

  const dateStr = new Date(shift.shift_date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  const fs = fsMap[shift.flavorset_id];
  const flavorName = fs?.name || "Unknown Flavor";

  // Calculate ROI color label using same thresholds as Financials page
  // We don't have rates here so we just report the data, no ROI calculation
  // Instead we compute a simple profitRatio indicator from cases produced
  // (The full ROI calc requires EmployeeRate + TimeEntry data — just report production stats)

  const totalCases = [
    shift.flavorset_cases || 0,
    shift.individual_flavor_1_cases || 0,
    shift.individual_flavor_2_cases || 0,
    shift.individual_flavor_3_cases || 0,
    shift.individual_flavor_4_cases || 0,
  ].reduce((a, b) => a + b, 0);

  const waste = shift.waste || 0;
  const duration = shift.shift_duration || 0;
  const startTime = shift.shift_time || "N/A";
  const cph = duration > 0 ? (totalCases / duration).toFixed(1) : "N/A";

  // Color dot emoji based on flavorset color (approximate)
  let colorEmoji = "🔵";
  if (fs?.color) {
    const hex = fs.color.toLowerCase().replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (r > 180 && g < 100) colorEmoji = "🔴";
    else if (r > 180 && g > 100 && b < 80) colorEmoji = "🟠";
    else if (r > 180 && g > 180 && b < 80) colorEmoji = "🟡";
    else if (g > 150 && r < 120) colorEmoji = "🟢";
    else if (b > 150 && r < 120) colorEmoji = "🔵";
    else if (r > 120 && b > 120 && g < 100) colorEmoji = "🟣";
    else colorEmoji = "⚪";
  }

  const subject = `🏭 New Shift Posted — ${dateStr}`;
  const bodyText = (shift.notes ? `📝 ${shift.notes}\n\n` : "") +
    `A new production shift has been posted.\n\n` +
    `${colorEmoji} Flavor Set: ${flavorName}\n` +
    `📅 Date: ${dateStr}\n` +
    `⏰ Start Time: ${startTime}\n` +
    `⏱️ Duration: ${duration}h\n` +
    `📦 Cases Produced: ${totalCases}\n` +
    `💧 Waste: ${waste} gal\n` +
    `⚡ Production Rate: ${cph} cases/hr\n` +
    "" +
    `\n— Pace Bars`;

  const emailPromises = recipients.map((emp) =>
    base44.asServiceRole.integrations.Core.SendEmail({
      to: emailByEmpNumber[emp.employee_number],
      subject,
      body: bodyText,
    })
  );

  await Promise.allSettled(emailPromises);
  return Response.json({ ok: true, emails_sent: emailPromises.length });
});