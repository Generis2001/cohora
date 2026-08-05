// Client-only — do not import from server components or API routes
import * as nsfwjs from 'nsfwjs';
import { NSFW_THRESHOLD } from '@/lib/nsfw/policy';

// Model path: jsDelivr CDN in production (free, no bandwidth cap, serves from
// GitHub repo), local files in dev. Loading from jsDelivr avoids Vercel static
// bandwidth limits (402 errors) and nsfwjs's default CDN (d1zv2aa70wpiur.cloudfront.net),
// which fails to resolve.
const NSFW_MODEL_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://cdn.jsdelivr.net/gh/Generis2001/cohora@main/public/models/nsfw/'
    : '/models/nsfw/';

let modelPromise: Promise<nsfwjs.NSFWJS> | null = null;

async function loadNsfwModel(): Promise<nsfwjs.NSFWJS> {
  let lastError: unknown;
  // The first load fetches the model + weights; retry once to ride out a
  // transient network hiccup before surfacing the moderation-unavailable error.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await nsfwjs.load(NSFW_MODEL_URL);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function getNsfwModel(): Promise<nsfwjs.NSFWJS> {
  if (!modelPromise) {
    // Reset the cache on failure so a later attempt can retry the load
    // instead of permanently reusing a rejected promise.
    modelPromise = loadNsfwModel().catch((error) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

const VIDEO_FRAME_RATIOS = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95];
const EXPLICIT_THRESHOLD = 0.3;
const SEXY_THRESHOLD = 0.7;

interface ScanResult {
  isNsfw: boolean;
  score: number;
  framesScanned: number;
}

function getRiskScore(predictions: nsfwjs.predictionType[]): number {
  const probability = (className: nsfwjs.predictionType['className']) =>
    predictions.find((prediction) => prediction.className === className)?.probability ?? 0;

  const porn = probability('Porn');
  const hentai = probability('Hentai');
  const sexy = probability('Sexy');
  const explicit = porn + hentai;
  const combined = explicit + sexy;

  return Math.min(
    1,
    Math.max(
      combined,
      (explicit / EXPLICIT_THRESHOLD) * NSFW_THRESHOLD,
      (sexy / SEXY_THRESHOLD) * NSFW_THRESHOLD,
    ),
  );
}

export async function scanImage(
  element: HTMLImageElement | HTMLCanvasElement,
): Promise<ScanResult> {
  const model = await getNsfwModel();
  const predictions = await model.classify(element as HTMLImageElement);
  const score = getRiskScore(predictions);
  return { isNsfw: score >= NSFW_THRESHOLD, score, framesScanned: 1 };
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: 'loadedmetadata' | 'loadeddata' | 'seeked',
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Video moderation timed out while waiting for ${eventName}`));
    }, 10_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener(eventName, handleSuccess);
      video.removeEventListener('error', handleError);
    };

    const handleSuccess = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error('Failed to load video for scanning'));
    };

    video.addEventListener(eventName, handleSuccess, { once: true });
    video.addEventListener('error', handleError, { once: true });
  });
}

async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.01 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

  const seeked = waitForVideoEvent(video, 'seeked');
  video.currentTime = time;
  await seeked;
}

export async function scanVideo(file: File): Promise<ScanResult> {
  const model = await getNsfwModel();
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    const metadataLoaded = waitForVideoEvent(video, 'loadedmetadata');
    video.src = url;
    video.load();
    await metadataLoaded;
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error('Video duration is unavailable for moderation');
    }
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForVideoEvent(video, 'loadeddata');
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 224;
    canvas.height = video.videoHeight || 224;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Video moderation canvas is unavailable');

    let maxScore = 0;
    let framesScanned = 0;

    for (const ratio of VIDEO_FRAME_RATIOS) {
      const time = Math.min(video.duration - 0.001, Math.max(0, video.duration * ratio));
      await seekVideo(video, time);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const predictions = await model.classify(canvas);
      const score = getRiskScore(predictions);
      maxScore = Math.max(maxScore, score);
      framesScanned += 1;

      if (score >= NSFW_THRESHOLD) {
        return { isNsfw: true, score: maxScore, framesScanned };
      }
    }

    return { isNsfw: false, score: maxScore, framesScanned };
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
