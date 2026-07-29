'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import type { CommentThread, SheetCommentMessage, UseSheetCommentsResult } from '@/lib/use-sheet-comments';

function LockNote() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-[var(--ink-faint)]">
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" />
      </svg>
      Privé : visible uniquement par toi et l&apos;auteur de la grille.
    </p>
  );
}

function Composer({ onSend, placeholder }: { onSend: (text: string) => Promise<void>; placeholder: string }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await onSend(value);
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-end gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
        rows={2}
        maxLength={2000}
        className="flex-1 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
      />
      <button
        onClick={submit}
        disabled={!text.trim() || sending}
        className="px-4 py-2 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 shrink-0"
      >
        {sending ? '…' : 'Envoyer'}
      </button>
    </div>
  );
}

function MessageBubble({ message, mine }: { message: SheetCommentMessage; mine: boolean }) {
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
          mine
            ? 'bg-[var(--accent)] text-white rounded-br-sm'
            : 'bg-[var(--cell-bg)] border border-[var(--line)] text-[var(--ink)] rounded-bl-sm'
        }`}
      >
        {message.text}
      </div>
      <span className="text-[10px] text-[var(--ink-faint)] mt-0.5 px-1">
        {message.senderName}
        {message.createdAt ? ` · ${message.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}
      </span>
    </div>
  );
}

export function SheetComments({ sheetId, invite = false, state }: { sheetId: string; invite?: boolean; state: UseSheetCommentsResult }) {
  const { user } = useAuth();
  const { isOwner, threads, loading, send, canComment } = state;

  // Auteur sans aucun commentaire : on n'affiche pas la section (rien à lire/gérer).
  // Le visiteur, lui, voit toujours la section pour pouvoir écrire.
  if (isOwner && threads.length === 0) return null;

  return (
    <section id="sheet-comments" className="max-w-4xl mx-auto px-4 sm:px-6 py-8 print:hidden border-t border-[var(--line)] mt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-playfair text-xl font-bold text-[var(--ink)]">Commentaires</h2>
      </div>
      <LockNote />

      {/* Non connecté */}
      {!canComment && (
        <p className="mt-4 text-sm text-[var(--ink-light)]">
          <Link href="/login" className="text-[var(--accent)] hover:underline">Connecte-toi</Link> pour laisser un commentaire privé à l&apos;auteur.
        </p>
      )}

      {/* Rappel duplication (pour les non-auteurs uniquement) */}
      {canComment && !isOwner && (
        <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/20">
          <div className="text-lg shrink-0">📄</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--ink)]">
              Cette grille te convient mais tu veux l&apos;ajuster ? Duplique-la pour créer ta propre version.
            </p>
            <Link
              href={`/sheet/new?forkFrom=${sheetId}`}
              className="inline-block mt-2 px-3 py-1.5 bg-[var(--accent)] hover:bg-[#a83d25] text-white text-xs font-medium rounded-lg transition-colors"
            >
              Dupliquer la grille
            </Link>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-4 h-16 rounded-xl bg-[var(--cell-bg)] border border-[var(--line)] animate-pulse" />
      ) : isOwner ? (
        // Vue auteur : un fil par commentateur
        <div className="mt-4 space-y-5">
          {threads.length === 0 ? (
            <p className="text-sm text-[var(--ink-faint)]">Aucun message pour l&apos;instant. Les personnes qui consultent ta grille peuvent t&apos;écrire ici, en privé.</p>
          ) : (
            threads.map((th) => (
              <OwnerThread key={th.commenterId} thread={th} meId={user!.id} onReply={(text) => send(text, th.commenterId, th.commenterName)} />
            ))
          )}
        </div>
      ) : canComment ? (
        // Vue commentateur : son fil unique
        <div className="mt-4 space-y-3">
          {invite && (
            <div className="p-4 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 space-y-2">
              <p className="text-sm font-semibold text-[var(--ink)]">Cette version ne te convient pas complètement, et c&apos;est ok 👍</p>
              <p className="text-sm text-[var(--ink-light)]">
                Une grille se construit à plusieurs : plutôt qu&apos;une note en passant, aide l&apos;auteur à progresser.
                Dis-lui en deux mots ce qui coince, par exemple : un accord qui sonne faux, une structure à revoir
                (intro, pont, refrain), la tonalité ou le capo, le tempo, un passage manquant… C&apos;est privé, entre toi et lui.
              </p>
              <p className="text-sm text-[var(--ink-light)]">
                Tu peux aussi{' '}
                <Link href={`/sheet/new?forkFrom=${sheetId}`} className="text-[var(--accent)] font-medium hover:underline">créer ta propre version</Link>
                {' '}pour l&apos;adapter exactement à ta main.
              </p>
              <p className="text-xs text-[var(--ink-faint)] pt-0.5">
                Ta note en dessous de 5 sera enregistrée une fois ton commentaire envoyé.
              </p>
            </div>
          )}
          {threads[0]?.messages.length ? (
            <div className="space-y-2">
              {threads[0].messages.map((m) => (
                <MessageBubble key={m.id} message={m} mine={m.senderId === user!.id} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--ink-faint)]">Pose une question ou laisse un mot à l&apos;auteur. Toi seul et l&apos;auteur verrez cet échange.</p>
          )}
          <Composer onSend={(text) => send(text)} placeholder="Ton message à l'auteur…" />
        </div>
      ) : null}
    </section>
  );
}

function OwnerThread({ thread, meId, onReply }: { thread: CommentThread; meId: string; onReply: (text: string) => Promise<void> }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold shrink-0">
          {thread.commenterName.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-semibold text-[var(--ink)] truncate">{thread.commenterName}</span>
      </div>
      <div className="space-y-2 mb-3">
        {thread.messages.map((m) => (
          <MessageBubble key={m.id} message={m} mine={m.senderId === meId} />
        ))}
      </div>
      <Composer onSend={onReply} placeholder={`Répondre à ${thread.commenterName}…`} />
    </div>
  );
}
