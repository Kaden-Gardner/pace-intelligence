import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Triggered when a BaseMixingShift record is created.
// Sends a summary email to any admin employees who have opted into shift post notifications.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const shift = body?.data;
  if (!shift) return Response.json({ ok: true });

  const [allEmployees, allUsers, flavorSets, flavors] = await Promise.all([
    base44.asServiceRole.entities.Employee.list(),
    base44.asServiceRole.entities.User.list(),
    base44.asServiceRole.entities.FlavorSet.list(),
    base44.asServiceRole.entities.Flavor.list(),
  ]);

  const emailByEmpNumber = {};
  allUsers.forEach((u) => {
    if (u.employee_number && u.email) emailByEmpNumber[u.employee_number] = u.email;
  });

  const empById = {};
  allEmployees.forEach((e) => { empById[e.id] = e; });

  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });

  const flavorNameById = {};
  flavors.forEach((f) => { flavorNameById[f.id] = f.name; });

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

  // Resolve the individual punch flavors in this flavorset
  const punchFlavors = [fs?.flavor_1, fs?.flavor_2, fs?.flavor_3, fs?.flavor_4]
    .filter(Boolean)
    .map((id) => flavorNameById[id])
    .filter(Boolean);

  const GALLONS_PER_BATCH = 240;
  const batches = shift.batch_size || 0;
  const gallons = batches * GALLONS_PER_BATCH;
  const duration = shift.shift_duration || 0;
  const startTime = shift.shift_time || "N/A";

  // Resolve mixer names
  const mixerIds = [shift.mixer_1, shift.mixer_2, shift.mixer_3].filter(Boolean);
  const mixerNames = mixerIds.map((id) => empById[id]?.name).filter(Boolean);
  const leadName = shift.shift_lead ? empById[shift.shift_lead]?.name : null;

  const whoDidIt = [];
  if (mixerNames.length > 0) whoDidIt.push(`Mixers: ${mixerNames.join(", ")}`);
  if (leadName) whoDidIt.push(`Shift Lead: ${leadName}`);

  const subject = `🧪 New Base Mix Shift Posted — ${dateStr}`;
  const bodyText = (shift.notes ? `📝 ${shift.notes}\n\n` : "") +
    `A new base mixing shift has been posted.\n\n` +
    `${flavorName ? `🟣 Flavor Set: ${flavorName}\n` : ""}` +
    (punchFlavors.length > 0 ? `🥤 Punch Flavors: ${punchFlavors.join(", ")}\n` : "") +
    `📅 Date: ${dateStr}\n` +
    `⏰ Start Time: ${startTime}\n` +
    `⏱️ Duration: ${duration}h\n` +
    `🪣 Batches Mixed: ${batches}\n` +
    `💧 Base Mixed: ${gallons} gallons\n` +
    (whoDidIt.length > 0 ? `👤 ${whoDidIt.join("\n👤 ")}\n` : "") +
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