// Display helpers for employee names.
// The Employee entity stores first_name + last_name (and a denormalized full
// `name`). Different surfaces show different forms:
//   - Operational views (schedule, shifts, dashboard) → first name only
//   - Money / official contexts (financials, time clock, own account) → full name
export function empFirstName(emp) {
  if (!emp) return "?";
  if (emp.first_name) return emp.first_name;
  return (emp.name || "").trim().split(/\s+/)[0] || "?";
}

export function empFullName(emp) {
  if (!emp) return "?";
  if (emp.first_name || emp.last_name) {
    const full = [emp.first_name, emp.last_name].filter(Boolean).join(" ").trim();
    if (full) return full;
  }
  return emp.name || "?";
}