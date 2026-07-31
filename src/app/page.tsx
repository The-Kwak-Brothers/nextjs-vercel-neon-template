export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
        Next Neon CI Template
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Dual-mode preview pipeline
      </h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-300">
        Prove migrate → seed → API with an items table. Set{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
          DEPLOY_TARGET=cloud|selfhosted
        </code>{" "}
        — never both deploy paths at once.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-50">
          What does this template verify?
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-zinc-600 dark:text-zinc-300">
          <li>
            Health:{" "}
            <a className="underline" href="/api/health">
              /api/health
            </a>
          </li>
          <li>
            Items CRUD smoke:{" "}
            <a className="underline" href="/api/items">
              /api/items
            </a>
          </li>
          <li>
            OpenAPI:{" "}
            <a className="underline" href="/api/openapi">
              /api/openapi
            </a>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-50">
          How do cloud and selfhosted differ?
        </h2>
        <p className="text-zinc-600 dark:text-zinc-300">
          Cloud uses Neon branches and CI-owned{" "}
          <code className="text-sm">vercel deploy --prebuilt</code>. Selfhosted
          uses plain Postgres databases per PR and Docker Compose — not Neon
          OSS.
        </p>
      </section>
    </main>
  );
}
