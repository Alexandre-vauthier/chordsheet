import { SessionViewClient } from './session-view-client';

interface SessionCodePageProps {
  params: Promise<{ code: string }>;
}

export default async function SessionCodePage({ params }: SessionCodePageProps) {
  const { code } = await params;
  return <SessionViewClient code={code} />;
}
