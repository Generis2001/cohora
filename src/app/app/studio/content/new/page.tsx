'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useQuery } from '@tanstack/react-query';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Wallet, CheckCircle2, AlertTriangle, Upload, X, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useListingFee } from '@/hooks/useListingFee';
import {
  getUploadErrorMessage,
  MODERATION_UNAVAILABLE_MESSAGE,
  PROHIBITED_CONTENT_MESSAGE,
} from '@/lib/uploads/errors';

const ACCEPT: Record<string, string> = {
  VIDEO: 'video/mp4,video/mov,video/webm,video/x-matroska',
  AUDIO: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/flac',
  IMAGE_GALLERY: 'image/jpeg,image/png,image/gif,image/webp',
  FILE: '.pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv',
};

const TYPE_LABEL: Record<string, string> = {
  VIDEO: 'Video',
  AUDIO: 'Audio',
  IMAGE_GALLERY: 'Image',
  FILE: 'File',
};

// Play a short buzzing rejection tone via Web Audio API
function playNsfwSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch {
    // AudioContext not available — silent fallback
  }
}

export default function NewContentPage() {
  const router = useRouter();
  const { getAccessToken } = usePrivy();
  const { payFee, step: feeStep, error: feeError, reset: resetFee } = useListingFee();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'ARTICLE',
    isPremium: false,
    priceUsdc: '',
  });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [nsfwBlocked, setNsfwBlocked] = useState(false);
  const [nsfwScore, setNsfwScore] = useState<number | null>(null);
  const [moderationFrameCount, setModerationFrameCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Pre-warm the NSFW model so it's ready when the user picks a file
  useEffect(() => {
    import('@/lib/nsfw/scanner').then((m) => m.getNsfwModel()).catch(() => {});
  }, []);

  if (meLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (me && !me.creator) {
    router.replace('/app/studio');
    return null;
  }

  const feePaid = feeStep === 'done';
  const feeInProgress = ['switching_chain', 'approving', 'paying', 'confirming'].includes(feeStep);
  const needsUpload = form.type !== 'ARTICLE';

  const handleTypeChange = (type: string) => {
    setForm((f) => ({ ...f, type }));
    setMediaFile(null);
    setMediaUrl(null);
    setNsfwBlocked(false);
    setNsfwScore(null);
    setModerationFrameCount(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 32 * 1024 * 1024) {
      setError('File must be under 32 MB.');
      return;
    }
    setMediaFile(file);
    setMediaUrl(null);
    setNsfwBlocked(false);
    setNsfwScore(null);
    setModerationFrameCount(null);
    setError('');

    // NSFW scan for image and video types
    const canScan = form.type === 'IMAGE_GALLERY' || form.type === 'VIDEO';
    if (canScan) {
      setScanning(true);
      try {
        const { scanImage, scanVideo } = await import('@/lib/nsfw/scanner');
        let result;

        if (form.type === 'IMAGE_GALLERY') {
          const img = document.createElement('img');
          const url = URL.createObjectURL(file);
          await new Promise<void>((res, rej) => {
            img.onload = () => { URL.revokeObjectURL(url); res(); };
            img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Image load failed')); };
            img.src = url;
          });
          result = await scanImage(img);
        } else {
          result = await scanVideo(file);
        }

        setNsfwScore(result.score);
        setModerationFrameCount(result.framesScanned);

        if (result.isNsfw) {
          playNsfwSound();
          setNsfwBlocked(true);
          setError(PROHIBITED_CONTENT_MESSAGE);
          setMediaFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          setScanning(false);
          return;
        }
      } catch {
        setError(MODERATION_UNAVAILABLE_MESSAGE);
        setMediaFile(null);
        setNsfwScore(null);
        setModerationFrameCount(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      } finally {
        setScanning(false);
      }
    }

    // Upload directly from browser to Vercel Blob (bypasses serverless body limit)
    setUploading(true);
    try {
      const token = await getAccessToken();
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const kind = /^(mp4|mov|webm|mkv)$/.test(ext) ? 'video'
        : /^(mp3|wav|ogg|m4a|flac)$/.test(ext) ? 'audio'
        : /^(jpg|jpeg|png|gif|webp)$/.test(ext) ? 'image'
        : 'file';
      const blob = await upload(`content/${kind}/${Date.now()}.${ext}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload/media',
        clientPayload: token ?? '',
        multipart: true,
      });
      setMediaUrl(blob.url);
    } catch (err) {
      setError(getUploadErrorMessage(err));
      setMediaFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handlePayFee = async () => {
    setError('');
    try { await payFee(); } catch { /* error set in hook */ }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feePaid) return;
    if (needsUpload && !mediaUrl) {
      setError('Please upload a file before publishing.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/studio/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          type: form.type,
          isPremium: form.isPremium,
          priceUsdc: form.priceUsdc || undefined,
          mediaUrl: mediaUrl || undefined,
          nsfwScore: nsfwScore ?? undefined,
          moderationFrameCount: moderationFrameCount ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create content');
      }
      router.push('/app/studio/content');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/app/studio/content" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h2 className="text-lg font-semibold">New Content</h2>
      </div>

      {/* Static NSFW warning */}
      <div className="rounded-lg border border-destructive/[0.40] bg-destructive/[0.05] px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <p className="text-sm text-destructive font-medium">NSFW and prohibited content cannot be uploaded on Cohora.</p>
      </div>

      {/* Dynamic NSFW blocked banner */}
      {nsfwBlocked && (
        <div className="rounded-lg border border-destructive bg-destructive/[0.10] px-4 py-3 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-destructive">Content blocked by automatic moderation</p>
            <p className="text-sm text-destructive/[0.80]">
              This file was detected as NSFW or sexually explicit content and cannot be uploaded. This content is prohibited by Cohora&apos;s community standards.
            </p>
          </div>
        </div>
      )}

      {/* Listing fee step */}
      {!feePaid ? (
        <div className="rounded-lg border border-cohora-600/30 bg-cohora-600/5 px-4 py-3 space-y-3">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4 mt-0.5 shrink-0 text-cohora-400" />
            <span>Publishing requires a <strong className="text-foreground">0.10 USDC listing fee</strong> paid from your wallet.</span>
          </div>
          {feeError && (
            <p className="text-sm text-destructive rounded-md bg-destructive/[0.10] px-3 py-2">
              {feeError}
              <button type="button" onClick={resetFee} className="ml-2 underline">Retry</button>
            </p>
          )}
          <Button variant="cohora" size="sm" onClick={handlePayFee} disabled={feeInProgress}>
            {feeInProgress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {feeStep === 'approving' ? 'Approve 0.10 USDC in wallet...' : feeStep === 'paying' ? 'Confirm 0.10 USDC deduction...' : feeStep === 'confirming' ? 'Confirming on-chain...' : 'Pay 0.10 USDC Listing Fee'}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 flex items-center gap-3 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          0.10 USDC listing fee confirmed. Fill in your content details and publish.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePublish} className="space-y-4">

            {/* Type selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Content Type</label>
              <div className="grid grid-cols-5 gap-2">
                {['ARTICLE', 'VIDEO', 'AUDIO', 'IMAGE_GALLERY', 'FILE'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={`rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
                      form.type === t
                        ? 'border-cohora-600 bg-cohora-600/10 text-cohora-400'
                        : 'border-border text-muted-foreground hover:border-cohora-600/40'
                    }`}
                  >
                    {t === 'ARTICLE' ? 'Article' : t === 'IMAGE_GALLERY' ? 'Image' : TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Enter a title"
                required
              />
            </div>

            {/* Description / body */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {form.type === 'ARTICLE' ? 'Body' : 'Description'}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={form.type === 'ARTICLE' ? 'Write your article...' : 'Optional description...'}
                rows={form.type === 'ARTICLE' ? 8 : 3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* File upload for non-article types */}
            {needsUpload && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Upload {TYPE_LABEL[form.type]} <span className="text-muted-foreground">(max 32 MB)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT[form.type]}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {!mediaFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-lg border-2 border-dashed border-border hover:border-cohora-600/40 px-4 py-8 flex flex-col items-center gap-2 text-muted-foreground transition-colors"
                  >
                    <Upload className="h-6 w-6" />
                    <span className="text-sm">Click to select {TYPE_LABEL[form.type].toLowerCase()}</span>
                    <span className="text-xs">Max 32 MB</span>
                  </button>
                ) : (
                  <div className="rounded-lg border border-border px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {scanning || uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-cohora-400 shrink-0" />
                      ) : mediaUrl ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm truncate">{mediaFile.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {scanning && <span className="text-xs text-muted-foreground">Scanning...</span>}
                      {uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
                      {mediaUrl && <span className="text-xs text-green-500">Uploaded</span>}
                      <button
                        type="button"
                        onClick={() => { setMediaFile(null); setMediaUrl(null); setNsfwBlocked(false); setNsfwScore(null); setModerationFrameCount(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Premium / price */}
            <div className="flex items-center gap-3">
              <input
                id="isPremium"
                type="checkbox"
                checked={form.isPremium}
                onChange={(e) => setForm({ ...form, isPremium: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="isPremium" className="text-sm font-medium cursor-pointer">
                Premium content (unlocks after three paid 30-day access periods)
              </label>
            </div>

            {!form.isPremium && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Price in USDC <span className="text-muted-foreground">(leave blank for free)</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.priceUsdc}
                  onChange={(e) => setForm({ ...form, priceUsdc: e.target.value })}
                  placeholder="e.g. 5.00"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive rounded-md bg-destructive/[0.10] px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                variant="cohora"
                disabled={!feePaid || saving || uploading || scanning || (needsUpload && !mediaUrl)}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? 'Publishing...' : 'Publish'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/app/studio/content">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
