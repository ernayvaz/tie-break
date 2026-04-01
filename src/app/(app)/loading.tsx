export default function AppLoading() {
  return (
    <div
      className="min-h-[50vh] animate-pulse space-y-3 sm:space-y-5"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="rounded-[2rem] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(236,239,244,0.76))] p-6 shadow-[0_28px_75px_rgba(46,52,64,0.08)] sm:p-8">
        <div className="h-3 w-28 rounded-full bg-nord-polarLighter/35" />
        <div className="mt-4 h-10 w-56 rounded-full bg-nord-polarLighter/30" />
        <div className="mt-4 h-3 w-full max-w-2xl rounded-full bg-nord-polarLighter/25" />
        <div className="mt-2 h-3 w-full max-w-xl rounded-full bg-nord-polarLighter/20" />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="h-[20rem] rounded-[2rem] border border-white/50 bg-white/80 shadow-[0_18px_42px_rgba(46,52,64,0.06)]" />
        <div className="h-[20rem] rounded-[2rem] border border-white/50 bg-white/75 shadow-[0_18px_42px_rgba(46,52,64,0.06)]" />
      </div>
    </div>
  );
}
