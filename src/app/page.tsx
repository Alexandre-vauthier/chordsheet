export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="font-playfair text-5xl font-bold mb-4">
          Chord<span className="text-[var(--accent)]">Sheet</span>
        </h1>
        <p className="text-[var(--ink-light)] text-lg mb-8 max-w-md">
          Créez, partagez et consultez vos grilles d&apos;accords.
          L&apos;outil collaboratif pour musiciens.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-[var(--ink)] text-[var(--cream)] rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Se connecter
          </a>
          <a
            href="/register"
            className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Créer un compte
          </a>
        </div>
      </div>
    </main>
  );
}
