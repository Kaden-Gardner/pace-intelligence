import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Daily cron: checks all employees for today's birthday and creates a pinned birthday post.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const today = new Date();
  const todayMonth = today.getMonth() + 1; // 1-12
  const todayDay = today.getDate();
  const todayStr = today.toISOString().split("T")[0];

  const employees = await base44.asServiceRole.entities.Employee.list();

  const birthdays = employees.filter((e) => {
    if (!e.birthday || e.terminated === true || e.active === false) return false;
    const bDate = new Date(e.birthday);
    return bDate.getMonth() + 1 === todayMonth && bDate.getDate() === todayDay;
  });

  if (birthdays.length === 0) return Response.json({ ok: true, posts_created: 0 });

  const existingPosts = await base44.asServiceRole.entities.Post.filter({ post_date: todayStr, is_birthday: true });
  const existingNames = new Set(existingPosts.map((p) => p.body));

  const created = [];
  for (const emp of birthdays) {
    const ageText = emp.birthday
      ? ` (${today.getFullYear() - new Date(emp.birthday).getFullYear()} today!)`
      : "";
    const bodyText = `🎂 Happy Birthday, ${emp.name}!${ageText} Wishing you a wonderful day from the whole Pace Bars team! 🎉`;
    if (existingNames.has(bodyText)) continue;
    const post = await base44.asServiceRole.entities.Post.create({
      body: bodyText,
      post_date: todayStr,
      is_pinned: true,
      is_birthday: true,
      author_name: "Pace Bars",
    });
    created.push(post);
  }

  return Response.json({ ok: true, posts_created: created.length });
});