import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Runs daily — creates a rich shift post for today's production shift.
// No email notifications are sent.

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const [shifts, employees, flavorSets, flavors] = await Promise.all([
    base44.asServiceRole.entities.ScheduledShift.filter({ shift_date: todayStr }),
    base44.asServiceRole.entities.Employee.list(),
    base44.asServiceRole.entities.FlavorSet.list(),
    base44.asServiceRole.entities.Flavor.list(),
  ]);

  if (shifts.length === 0) {
    return Response.json({ ok: true, skipped: true, reason: "No shifts today" });
  }

  const empMap = {};
  employees.forEach((e) => { empMap[e.id] = e; });
  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });
  const flavorMap = {};
  flavors.forEach((f) => { flavorMap[f.id] = f; });

  // Avoid duplicates
  const existingPosts = await base44.asServiceRole.entities.Post.filter({ post_date: todayStr });
  const alreadyExists = existingPosts.some((p) => p.title && p.title.startsWith("__SHIFT_POST__"));
  if (alreadyExists) {
    return Response.json({ ok: true, skipped: true, reason: "Shift post already exists" });
  }

  function getAge(emp) {
    if (!emp.birthday) return null;
    const bDate = new Date(emp.birthday);
    const ref = new Date(todayStr + "T12:00:00");
    let age = ref.getFullYear() - bDate.getFullYear();
    if (ref < new Date(ref.getFullYear(), bDate.getMonth(), bDate.getDate())) age--;
    return age;
  }

  const created = [];

  for (const shift of shifts) {
    const fs = fsMap[shift.flavorset_id];

    const flavorNames = [];
    if (fs) {
      for (const key of ["flavor_1", "flavor_2", "flavor_3", "flavor_4"]) {
        if (fs[key] && flavorMap[fs[key]]) flavorNames.push(flavorMap[fs[key]].name);
      }
    }

    const workingEmps = (shift.assigned_employees || [])
      .map((id) => empMap[id]).filter(Boolean)
      .map((emp) => ({ id: emp.id, name: emp.name, age: getAge(emp) }));

    const mixerEmp = shift.mixer_employee && empMap[shift.mixer_employee]
      ? { id: empMap[shift.mixer_employee].id, name: empMap[shift.mixer_employee].name, age: getAge(empMap[shift.mixer_employee]) }
      : null;

    const shiftData = {
      flavorset_name: fs?.name || null,
      flavorset_color: fs?.color || null,
      flavor_names: flavorNames,
      working_employees: workingEmps,
      mixer: mixerEmp,
      shift_time: shift.shift_time,
      special_order: shift.special_order || false,
      special_order_name: shift.special_order_name || null,
      notes: shift.notes || null,
    };

    const titleDate = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

    const post = await base44.asServiceRole.entities.Post.create({
      title: `__SHIFT_POST__${titleDate}`,
      body: JSON.stringify(shiftData),
      post_date: todayStr,
      is_pinned: false,
      is_birthday: false,
      author_name: "Pace Bars",
    });

    created.push(post.id);
  }

  return Response.json({ ok: true, posts_created: created.length });
});