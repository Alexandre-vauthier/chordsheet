'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/book');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de connexion';
      if (errorMessage.includes('user-not-found') || errorMessage.includes('wrong-password')) {
        setError('Email ou mot de passe incorrect');
      } else if (errorMessage.includes('invalid-email')) {
        setError('Adresse email invalide');
      } else {
        setError('Erreur de connexion. Veuillez réessayer.');
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
          <p className="text-[var(--ink-light)] mt-2">Connectez-vous à votre compte</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-8 shadow-sm border border-[var(--line)]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            className="w-full mt-6"
            size="lg"
            isLoading={loading}
          >
            Se connecter
          </Button>

          <p className="text-center text-sm text-[var(--ink-light)] mt-6">
            Pas encore de compte ?{' '}
            <Link href="/register" className="text-[var(--accent)] hover:underline font-medium">
              Créer un compte
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
