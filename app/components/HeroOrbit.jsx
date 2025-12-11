export default function HeroOrbit() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-24 top-[-6rem] h-64 w-64 rounded-full bg-violet-600/35 blur-[90px]" />
      <div className="absolute -right-10 top-48 h-64 w-64 rounded-full bg-cyan-400/30 blur-[90px]" />
      <div className="absolute -bottom-10 left-12 h-64 w-64 rounded-full bg-amber-400/25 blur-[90px]" />
      <div className="absolute inset-0 bg-grid-slate bg-[size:46px_46px] opacity-[0.35]" />
    </div>
  );
}
