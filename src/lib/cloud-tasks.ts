/**
 * Enfilement d'une tâche d'analyse audio dans Cloud Tasks.
 * La tâche appelle le worker Cloud Run (/analyze-async) et tient la requête
 * ouverte pendant tout le traitement (jusqu'à 30 min), avec retries.
 * Réutilise les credentials du compte de service firebase-admin.
 *
 * @google-cloud/tasks est chargé en `require()` paresseux (comme firebase-admin)
 * pour éviter que Next tente de le bundler et plante au chargement du module.
 */
import type { CloudTasksClient } from '@google-cloud/tasks';

let client: CloudTasksClient | null = null;

function getClient(): CloudTasksClient {
  if (!client) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CloudTasksClient: Ctor } = require('@google-cloud/tasks');
    client = new Ctor({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      credentials: {
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? '',
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? '',
      },
    }) as CloudTasksClient;
  }
  return client;
}

export async function enqueueAnalysis(params: {
  jobId: string;
  audioUrl?: string;
  youtubeUrl?: string;
}): Promise<void> {
  const project = process.env.FIREBASE_ADMIN_PROJECT_ID ?? '';
  const location = process.env.CLOUD_TASKS_LOCATION ?? 'europe-west1';
  const queue = process.env.CLOUD_TASKS_QUEUE ?? 'chord-analysis';
  const url = `${process.env.CHORD_DETECTOR_URL}/analyze-async`;

  const form = new URLSearchParams();
  form.set('job_id', params.jobId);
  if (params.audioUrl) form.set('audio_url', params.audioUrl);
  if (params.youtubeUrl) form.set('youtube_url', params.youtubeUrl);

  const cli = getClient();
  const parent = cli.queuePath(project, location, queue);
  await cli.createTask({
    parent,
    task: {
      dispatchDeadline: { seconds: 1800 },
      httpRequest: {
        httpMethod: 'POST',
        url,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-API-Key': process.env.CHORD_DETECTOR_API_KEY ?? '',
        },
        body: Buffer.from(form.toString()),
      },
    },
  });
}
