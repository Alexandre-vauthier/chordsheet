import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Remplace next/link et next/navigation dans tout le code applicatif : ces
// wrappers préfixent/dépréfixent automatiquement la locale (ex. usePathname()
// renvoie "/explore" même sur /en/explore — le code de routing existant
// (ex. la liste des routes publiques dans (main)/layout.tsx) reste inchangé).
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
