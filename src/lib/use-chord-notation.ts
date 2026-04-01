import { useAuth } from '@/lib/auth-context';
import { translateChordName } from '@/lib/chord-data';

export function useChordNotation() {
  const { user } = useAuth();
  const notation = user?.notationPreference ?? 'american';
  return (name: string) => translateChordName(name, notation);
}
