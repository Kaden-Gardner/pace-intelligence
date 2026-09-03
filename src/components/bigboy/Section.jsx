export default function Section({ title, subtitle, children }) {
  return (
    <section className="mb-10">
      <h2 className="font-heading font-semibold text-lg mb-1">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>}
      {children}
    </section>
  );
}