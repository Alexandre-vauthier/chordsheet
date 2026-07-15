import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { createExportToken } from '@/lib/pdf-export-token';

export const maxDuration = 60;

// Limite de fréquence en mémoire (best-effort, par instance serveur) : évite qu'un compte
// Pro compromis ou un bug ne déclenche des invocations Puppeteer en rafale (coût compute réel).
const BURST_LIMIT = 3;
const BURST_WINDOW_MS = 5 * 60_000;
const burstLog = new Map<string, number[]>();

function isBursting(userId: string): boolean {
  const now = Date.now();
  const timestamps = (burstLog.get(userId) ?? []).filter((t) => now - t < BURST_WINDOW_MS);
  timestamps.push(now);
  burstLog.set(userId, timestamps);
  return timestamps.length > BURST_LIMIT;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  let userId: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    userId = decoded.uid;
  } catch (authErr) {
    console.error('[export/set-pdf] Firebase auth error:', authErr);
    // TODO: message détaillé temporaire pour diagnostiquer la config Admin SDK en prod — à repasser au message générique une fois résolu
    const debugMsg = authErr instanceof Error ? authErr.message : String(authErr);
    return NextResponse.json({ error: `Session invalide, reconnecte-toi. (debug: ${debugMsg})` }, { status: 401 });
  }

  if (isBursting(userId)) {
    return NextResponse.json({ error: 'Trop d\'exports, réessaie dans quelques minutes.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const setId = body?.setId;
  if (!setId || typeof setId !== 'string') {
    return NextResponse.json({ error: 'Set invalide.' }, { status: 400 });
  }

  const db = getAdminDb();

  const setSnap = await db.collection('sets').doc(setId).get();
  if (!setSnap.exists) {
    return NextResponse.json({ error: 'Set introuvable.' }, { status: 404 });
  }
  const setData = setSnap.data()!;

  const userSnap = await db.collection('users').doc(userId).get();
  const isAdmin = userSnap.data()?.role === 'admin';
  const isOwner = setData.ownerId === userId;

  let isGroupMember = false;
  let groupExists = false;
  if (setData.groupId) {
    const groupSnap = await db.collection('groups').doc(setData.groupId).get();
    if (groupSnap.exists) {
      groupExists = true;
      const memberIds: string[] = groupSnap.data()?.memberIds || [];
      isGroupMember = memberIds.includes(userId);
    }
  }

  if (!isOwner && !isGroupMember && !isAdmin) {
    return NextResponse.json({ error: 'Accès refusé à ce set.' }, { status: 403 });
  }

  // Pro : soit l'utilisateur est personnellement Pro, soit le set appartient à un groupe
  // (la création de groupe est déjà réservée aux comptes Pro → licence partagée pour tout le groupe)
  const subSnap = await db.collection('users').doc(userId).collection('private').doc('subscription').get();
  const sub = subSnap.data();
  const isPersonallyPro = sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing');

  if (!isPersonallyPro && !groupExists && !isAdmin) {
    return NextResponse.json({
      error: 'Export PDF multi-grilles réservé aux comptes Pro.',
      upgradeRequired: true,
    }, { status: 403 });
  }

  const token = await createExportToken(setId, userId);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://chordsheet.app';
  const exportUrl = `${baseUrl}/export/set/${setId}?token=${token}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any;
  try {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteer = await import('puppeteer-core');

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.goto(exportUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-export-ready="true"], [data-export-error="true"]', { timeout: 15000 });

    const errorEl = await page.$('[data-export-error="true"]');
    if (errorEl) {
      const message = await page.$eval('[data-export-error="true"]', (el: Element) => el.textContent);
      throw new Error(message || 'Erreur lors de la génération.');
    }

    await page.evaluate(() => document.fonts.ready);
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.emulateMediaType('print');
    const pdfBuffer = await page.pdf({
      format: 'a4',
      printBackground: true,
      margin: { top: '1.5cm', bottom: '1.5cm', left: '1.5cm', right: '1.5cm' },
    });

    const setName = String(setData.name || 'setlist').replace(/[^a-z0-9-_]+/gi, '_');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${setName}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[export/set-pdf] Error:', err);
    const msg = err instanceof Error ? err.message : 'Erreur lors de la génération du PDF.';
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
