import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Runs every 30 minutes. Creates a shift post ~10-12 hours before each scheduled shift starts,
// then triggers newPostNotify so all active employees get an email notification.
// All shift times are in Mountain Time (America/Denver). UTC offset is detected dynamically.

function getMountainOffsetMs() {
  const now = new Date();
  const denverStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(now);
  const [datePart, timePart] = denverStr.split(", ");
  const [mo, dy, yr] = datePart.split("/");
  const denverLocal = new Date(`${yr}-${mo}-${dy}T${timePart}Z`);
  return now.getTime() - denverLocal.getTime();
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const now = new Date();
  const offsetMs = getMountainOffsetMs();
  const nowMountain = new Date(now.getTime() - offsetMs);

  const [shifts, employees, flavorSets, flavors, recentPosts] = await Promise.all([
    base44.asServiceRole.entities.ScheduledShift.list("shift_date", 200),
    base44.asServiceRole.entities.Employee.list(),
    base44.asServiceRole.entities.FlavorSet.list(),
    base44.asServiceRole.entities.Flavor.list(),
    base44.asServiceRole.entities.Post.list("-post_date", 100),
  ]);

  // Dedup: collect shift IDs that already have a post
  const postedShiftIds = new Set();
  for (const p of recentPosts) {
    if (p.title && p.title.startsWith("__SHIFT_POST__")) {
      try {
        const data = JSON.parse(p.body);
        if (data.shift_id) postedShiftIds.add(data.shift_id);
      } catch {}
    }
  }

  const empMap = {};
  employees.forEach((e) => { empMap[e.id] = e; });
  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });
  const flavorMap = {};
  flavors.forEach((f) => { flavorMap[f.id] = f; });

  function getAge(emp, refDate) {
    if (!emp.birthday) return null;
    const bDate = new Date(emp.birthday);
    let age = refDate.getFullYear() - bDate.getFullYear();
    if (refDate < new Date(refDate.getFullYear(), bDate.getMonth(), bDate.getDate())) age--;
    return age;
  }

  const created = [];

  for (const shift of shifts) {
    if (!shift.shift_time) continue;
    if (postedShiftIds.has(shift.id)) continue;

    // Shift start time in Mountain Time → UTC
    const shiftStartMs = new Date(`${shift.shift_date}T${shift.shift_time}:00`).getTime() + offsetMs;
    const hoursUntil = (shiftStartMs - now.getTime()) / 3600000;

    // Only post when 10-12 hours before shift start
    if (hoursUntil < 10 || hoursUntil > 12) continue;

    const refDate = new Date(shift.shift_date + "T12:00:00");
    const fs = fsMap[shift.flavorset_id];

    const flavorNames = [];
    const flavorColors = [];
    if (fs) {
      for (const key of ["flavor_1", "flavor_2", "flavor_3", "flavor_4"]) {
        if (fs[key] && flavorMap[fs[key]]) {
          flavorNames.push(flavorMap[fs[key]].name);
          flavorColors.push(flavorMap[fs[key]].color || null);
        }
      }
    }

    const posMap = {};
    (shift.position_assignments || []).forEach((a) => { posMap[a.employee_id] = a.position; });

    const workingEmps = (shift.assigned_employees || [])
      .map((id) => empMap[id]).filter(Boolean)
      .map((emp) => ({ id: emp.id, name: emp.name, age: getAge(emp, refDate), position: posMap[emp.id] || null }));

    const mixerEmp = shift.mixer_employee && empMap[shift.mixer_employee]
      ? { id: empMap[shift.mixer_employee].id, name: empMap[shift.mixer_employee].name, age: getAge(empMap[shift.mixer_employee], refDate) }
      : null;

    const shiftData = {
      shift_id: shift.id,
      flavorset_name: fs?.name || null,
      flavorset_color: fs?.color || null,
      flavor_names: flavorNames,
      flavor_colors: flavorColors,
      working_employees: workingEmps,
      mixer: mixerEmp,
      shift_time: shift.shift_time,
      special_order: shift.special_order || false,
      special_order_name: shift.special_order_name || null,
      notes: shift.notes || null,
    };

    const titleDate = refDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const postDateStr = nowMountain.toISOString().split("T")[0];

    const post = await base44.asServiceRole.entities.Post.create({
      title: `__SHIFT_POST__${titleDate}`,
      body: JSON.stringify(shiftData),
      post_date: postDateStr,
      is_pinned: false,
      is_birthday: false,
      author_name: "Pace Bars",
    });

    // Send notification email to all active employees
    await base44.asServiceRole.functions.invoke("newPostNotify", {
      post_id: post.id,
      post_body: post.body,
      post_title: post.title,
      author_name: post.author_name,
    });

    created.push(post.id);
  }

  return Response.json({ ok: true, posts_created: created.length, checked_shifts: shifts.length });
});