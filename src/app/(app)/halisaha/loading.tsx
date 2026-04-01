export default function HalisahaLoading() {
  return (
    <div
      className="flex min-h-full flex-1"
      role="status"
      aria-live="polite"
      aria-label="Opening Halisaha mode"
    >
      <section className="flex min-h-full flex-1 animate-pulse flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.012),rgba(255,255,255,0.006))] px-3.5 py-3.5 text-white shadow-[0_22px_58px_rgba(0,0,0,0.24)] sm:rounded-[1.8rem] sm:px-4 sm:py-3.5">
        <div className="flex flex-wrap items-stretch gap-2">
          <div className="h-[2.5rem] w-[3.6rem] rounded-[1rem] border border-white/12 bg-white/[0.045]" />
          <div className="h-[2.5rem] w-[14rem] rounded-[1rem] border border-white/12 bg-white/[0.045]" />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="h-3 w-32 rounded-full bg-white/12" />
            <div className="mt-4 h-10 w-[75%] rounded-full bg-white/10" />
            <div className="mt-2 h-10 w-[58%] rounded-full bg-white/10" />
            <div className="mt-5 h-3 w-[70%] rounded-full bg-white/10" />
            <div className="mt-2 h-3 w-[46%] rounded-full bg-white/8" />
          </div>

          <div className="min-h-[24rem] rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(45,45,45,0.9),rgba(12,12,12,0.96))]" />
        </div>
      </section>
    </div>
  );
}
