export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-card max-w-md space-y-4 p-8 text-center">
        <div className="section-title">Preparing Demo State</div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Loading NIRA workspace</h1>
        <p className="text-sm leading-6 text-muted">
          Building the patient and doctor experience with dummy clinical data.
        </p>
        <div className="mx-auto h-2 w-full overflow-hidden rounded-full bg-slate-900/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-tide" />
        </div>
      </div>
    </div>
  );
}
