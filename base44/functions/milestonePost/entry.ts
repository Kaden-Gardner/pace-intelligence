import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Fires on production shift create/update (scheduled/entity automation). Computes
// year-to-date popsicles and posts a pinned celebratory Post for every popsicle
// milestone newly reached this calendar year (milestones reset each year, matching
// the Dashboard countdown). Idempotent: a token in the body dedupes per year+milestone.

const POP_MILESTONES = [1_000_000, 5_000_000, 10_000_000, 25_000_000, 100_000_000];

function getTotalCases(shift) {
  return (shift.flavorset_cases || 0)
    + (shift.individual_flavor_1_cases || 0)
    + (shift.individual_flavor_2_cases || 0)
    + (shift.individual_flavor_3_cases || 0)
    + (shift.individual_flavor_4_cases || 0);
}

function fmtMilestone(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString()} million`;
  return n.toLocaleString();
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date();
    const year = today.getFullYear();
    const todayStr = today.toISOString().split("T")[0];

    const shifts = await base44.asServiceRole.entities.Shift.list("-shift_date", 1000);
    let yearPops = 0;
    shifts.forEach((s) => {
      if (!s.shift_date || parseInt(s.shift_date.slice(0, 4), 10) !== year) return;
      yearPops += getTotalCases(s) * (s.popsicles_per_case || 144);
    });

    const reached = POP_MILESTONES.filter((m) => yearPops >= m);
    if (reached.length === 0) {
      return Response.json({ ok: true, year, yearPops, posts_created: 0 });
    }

    // Dedupe: scan existing Pace Bars posts for already-posted milestone tokens this year
    const existing = await base44.asServiceRole.entities.Post.filter(
      { author_name: "Pace Bars" },
      "-created_date",
      500
    );
    const postedTokens = new Set();
    existing.forEach((p) => {
      if (!p.body) return;
      const match = p.body.match(/#popmilestone-(\d{4})-(\d+)/);
      if (match && match[1] === String(year)) postedTokens.add(`${match[1]}-${match[2]}`);
    });

    const created = [];
    for (const m of reached) {
      const token = `${year}-${m}`;
      if (postedTokens.has(token)) continue;
      const bodyText =
        `🎉 MILESTONE REACHED! The Pace Bars team just crossed ${fmtMilestone(m)} popsicles produced in ${year}! ` +
        `Incredible work from everyone on the line — every single pop counts. Onward to the next goal! #popmilestone-${year}-${m}`;
      await base44.asServiceRole.entities.Post.create({
        body: bodyText,
        post_date: todayStr,
        is_pinned: true,
        author_name: "Pace Bars",
      });
      created.push(m);
    }

    return Response.json({ ok: true, year, yearPops, posts_created: created.length, milestones: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}