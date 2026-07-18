'use client';

import { useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useRouter } from '@/i18n/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (!acceptedTerms) {
      setError('Vous devez accepter les CGU et CGV pour créer un compte');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, displayName);
      localStorage.setItem('chordsheet_show_welcome', '1');
      router.push('/explore');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la création du compte';
      if (errorMessage.includes('email-already-in-use')) {
        setError('Cette adresse email est déjà utilisée');
      } else if (errorMessage.includes('invalid-email')) {
        setError('Adresse email invalide');
      } else if (errorMessage.includes('weak-password')) {
        setError('Le mot de passe est trop faible');
      } else {
        setError('Erreur lors de la création du compte. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="font-playfair text-3xl font-bold">
              Chord<span className="text-[var(--accent)]">Sheet</span>
            </h1>
          </Link>
          <p className="text-[var(--ink-light)] mt-2">Créez votre compte musicien</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--cell-bg)] rounded-xl p-8 shadow-sm border border-[var(--line)]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <Input
              type="text"
              label="Nom d'artiste"
              placeholder="Votre nom ou pseudo"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
            />

            <Input
              type="email"
              label="Email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              type="password"
              label="Mot de passe"
              placeholder="Au moins 6 caractères"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
            />

            <Input
              type="password"
              label="Confirmer le mot de passe"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <label className="flex items-start gap-2 mt-5 text-sm text-[var(--ink-light)] cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 cursor-pointer accent-[var(--accent)]"
              required
            />
            <span>
              J&apos;accepte les{' '}
              <Link href="/legal/cgu" target="_blank" className="text-[var(--accent)] hover:underline">
                CGU
              </Link>{' '}
              et les{' '}
              <Link href="/legal/cgv" target="_blank" className="text-[var(--accent)] hover:underline">
                CGV
              </Link>
            </span>
          </label>

          <Button
            type="submit"
            className="w-full mt-4"
            size="lg"
            isLoading={loading}
            disabled={!acceptedTerms}
          >
            Créer mon compte
          </Button>

          <p className="text-center text-sm text-[var(--ink-light)] mt-6">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-[var(--accent)] hover:underline font-medium">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
