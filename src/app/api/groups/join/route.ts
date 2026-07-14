import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  let userId: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    userId = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Session invalide, reconnecte-toi.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const token = body?.token;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 });
  }

  const db = getAdminDb();
  const inviteRef = db.collection('groupInvites').doc(token);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupId: string = await db.runTransaction(async (tx: any) => {
      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) throw new Error('Lien invalide ou expiré');

      const invite = inviteSnap.data()!;
      const expiresAt = invite.expiresAt?.toDate ? invite.expiresAt.toDate() : new Date(invite.expiresAt);
      if (expiresAt < new Date()) throw new Error('Lien expiré');
      if (invite.maxUses != null && (invite.useCount ?? 0) >= invite.maxUses) {
        throw new Error('Lien épuisé');
      }

      const groupRef = db.collection('groups').doc(invite.groupId);
      const groupSnap = await tx.get(groupRef);
      if (!groupSnap.exists) throw new Error('Groupe introuvable');

      const groupData = groupSnap.data()!;
      const memberIds: string[] = groupData.memberIds || [];

      if (memberIds.includes(userId)) {
        return groupSnap.id;
      }

      tx.update(groupRef, {
        memberIds: [...memberIds, userId],
        [`roles.${userId}`]: 'member',
        updatedAt: new Date(),
      });
      tx.update(inviteRef, { useCount: (invite.useCount ?? 0) + 1 });

      return groupSnap.id;
    });

    return NextResponse.json({ groupId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la tentative de rejoindre le groupe.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
