import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Called when a new post is created. Sends email to all active employees who haven't opted out.
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

  const subject = post_title
    ? `📣 New Post: ${post_title}`
    : `📣 New Post from ${author_name || "the team"}`;

  const emailBody =
    `${author_name || "Your team"} just posted an update on Pace Bars.\n\n` +
    (post_title ? `📌 ${post_title}\n\n` : "") +
    `${post_body}\n\n` +
    `— Pace Bars`;

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