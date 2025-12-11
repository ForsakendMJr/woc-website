export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          © {new Date().getFullYear()} World of Communities. Crafted for
          chaotic Discord universes.
        </p>
        <div className="flex flex-wrap gap-4">
          <span className="text-slate-500/80">
            Dashboard: <span className="text-violet-400">Coming soon</span>
          </span>
          <span className="text-slate-500/80">
            Powered by Next.js & Vercel
          </span>
        </div>
      </div>
    </footer>
  );
}
