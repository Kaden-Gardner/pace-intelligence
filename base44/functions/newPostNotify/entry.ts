import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Called when a new post is created (manual or automated shift post).
// Sends email to all active employees who haven't opted out.
// Shift posts (title starts with __SHIFT_POST__) are formatted nicely from the JSON body.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { post_body, post_title, author_name } = body;

  if (!post_body) return Response.json({ ok: true });

  const [allEmployees, allUsers] = await Promise.all([
    base44.asServiceRole.entities.Employee.list(),
    base44.asServiceRole.entities.User.list(),
  ]);

  const emailByEmpNumber = {};
  allUsers.forEach((u) => {
    if (u.employee_number && u.email) emailByEmpNumber[u.employee_number] = u.email;
  });

  // Send to all active employees who have not opted out of post notifications
  const recipients = allEmployees.filter((e) =>
    e.active !== false &&
    e.terminated !== true &&
    !e.opt_out_post_notifications &&
    e.employee_number &&
    emailByEmpNumber[e.employee_number]
  );

  if (recipients.length === 0) return Response.json({ ok: true, emails_sent: 0 });

  const isShiftPost = post_title && post_title.startsWith("__SHIFT_POST__");
  let subject, emailBody;

  if (isShiftPost) {
    let data = {};
    try { data = JSON.parse(post_body); } catch {}
    const dateLabel = post_title.replace("__SHIFT_POST__", "");
    const flavorList = data.flavor_names && data.flavor_names.length > 0
      ? data.flavor_names.join(", ")
      : "N/A";
    const workingList = data.working_employees && data.working_employees.length > 0
      ? data.working_employees.map((e) => e.name).join(", ")
      : "See app";

    subject = `📅 Upcoming Shift — ${dateLabel}`;
    emailBody =
      `Here's what's coming up for your shift at Pace Bars.\n\n` +
      `📅 Date: ${dateLabel}\n` +
      (data.shift_time ? `⏰ Start Time: ${data.shift_time}\n` : "") +
      (data.flavorset_name ? `🎨 Flavor Set: ${data.flavorset_name}\n` : "") +
      `🍦 Flavors: ${flavorList}\n` +
      (data.mixer ? `🥄 Mixer: ${data.mixer.name}\n` : "") +
      `👥 Working: ${workingList}\n` +
      (data.special_order && data.special_order_name ? `⭐ Special Order: ${data.special_order_name}\n` : "") +
      (data.notes ? `📝 Notes: ${data.notes}\n` : "") +
      `\nCheck the app for full details.\n\n— Pace Bars`;
  } else {
    subject = post_title ? `📣 New Post: ${post_title}` : `📣 New Post from ${author_name || "the team"}`;
    emailBody =
      `${author_name || "Your team"} just posted an update on Pace Bars.\n\n` +
      (post_title ? `📌 ${post_title}\n\n` : "") +
      `${post_body}\n\n` +
      `— Pace Bars`;
  }

  const emailPromises = recipients.map((emp) =>
    base44.asServiceRole.integrations.Core.SendEmail({
      to: emailByEmpNumber[emp.employee_number],
      subject,
      body: emailBody,
    })
  );

  await Promise.allSettled(emailPromises);
  return Response.json({ ok: true, emails_sent: emailPromises.length });
});