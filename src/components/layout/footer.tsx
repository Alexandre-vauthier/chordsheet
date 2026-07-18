import { Link } from '@/i18n/navigation';
export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--line)] bg-[var(--cell-bg)] print:hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--ink-faint)]">
            © {new Date().getFullYear()} ChordSheet — Alexandre Vauthier
          </p>
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            <Link href="/credits" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              Crédits
            </Link>
            <Link href="/about" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              Qui sommes-nous ?
            </Link>
            <Link href="/faq" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              FAQ
            </Link>
            <Link href="/legal/mentions-legales" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              Mentions légales
            </Link>
            <Link href="/legal/cgu" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              CGU
            </Link>
            <Link href="/legal/confidentialite" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              Confidentialité
            </Link>
            <Link href="/legal/cgv" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              CGV
            </Link>
            <a href="mailto:alex.vauthier@gmail.com" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-light)] transition-colors">
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
