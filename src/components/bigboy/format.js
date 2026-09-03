export function fmt$(n) { return n == null || isNaN(n) ? "—" : `$${Number(n).toFixed(2)}`; }
export function fmtInt(n) { return n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString(); }
export function fmtNum(n, d = 1) { return n == null || isNaN(n) ? "—" : Number(n).toFixed(d); }
export function fmtPct(n, d = 1) { return n == null || isNaN(n) ? "—" : `${Number(n).toFixed(d)}%`; }