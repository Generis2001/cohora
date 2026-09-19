'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { upload } from '@vercel/blob/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getUploadErrorMessage } from '@/lib/uploads/errors';
import { Loader2, Camera, ImagePlus, ArrowLeft, AlertTriangle, Trash2 } from 'lucide-react';
import { SubscriptionTierManager } from '@/components/studio/SubscriptionTierManager';
import Image from 'next/image';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function StudioProfilePage() {
  const { getAccessToken, logout } = usePrivy();
  const router = useRouter();
  const queryClient = useQueryClient();
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const [form, setForm] = useState<{ displayName: string; bio: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const currentForm = form ?? { displayName: me?.creator?.displayName ?? '', bio: me?.creator?.bio ?? '' };

  const handleFileUpload = async (
    file: File,
    uploadUrl: string,
    saveUrl: string,
    saveField: string,
    setUploading: (v: boolean) => void,
  ) => {
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const token = await getAccessToken();
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: uploadUrl,
        clientPayload: token ?? '',
      });
      // Save the URL to the DB
      const res = await fetch(saveUrl, {
        method: saveUrl.includes('studio') ? 'PATCH' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [saveField]: blob.url }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to save');
      }
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setSuccess('Image updated.');
    } catch (err) {
      setError(getUploadErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/studio/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(currentForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setSuccess('Profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (deleteConfirmation !== 'DELETE') return;

    setDeleting(true);
    setDeleteError('');

    try {
      const token = await getAccessToken();
      const response = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? 'Unable to delete your account');

      queryClient.clear();
      await logout();
      router.replace('/');
      router.refresh();
      window.setTimeout(() => window.location.assign('/'), 100);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unable to delete your account');
      setDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const avatarUrl = me?.avatarUrl;
  const bannerUrl = me?.creator?.bannerUrl;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/app/studio" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h2 className="text-lg font-semibold">Edit Profile</h2>
      </div>

      {/* Banner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Banner Photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            type="button"
            onClick={() => bannerFileRef.current?.click()}
            disabled={uploadingBanner}
            className="relative group w-full h-32 rounded-lg overflow-hidden border-2 border-dashed border-input hover:border-cohora-400 transition-colors bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {bannerUrl ? (
              <Image src={bannerUrl} alt="Banner" fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                {uploadingBanner ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6 text-muted-foreground group-hover:text-cohora-400 transition-colors" />
                    <span className="text-xs text-muted-foreground">Click to upload banner</span>
                  </>
                )}
              </div>
            )}
            {bannerUrl && (
              <div className="absolute inset-0 bg-black/[0.40] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingBanner ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <ImagePlus className="h-5 w-5 text-white" />}
              </div>
            )}
          </button>
          <p className="text-xs text-muted-foreground">Recommended: 1500×500px. Max 10 MB. JPG, PNG, GIF or WebP.</p>
          <input
            ref={bannerFileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, '/api/upload/banner', '/api/studio/profile', 'bannerUrl', setUploadingBanner);
            }}
          />
        </CardContent>
      </Card>

      {/* Profile picture */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile Picture</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => avatarFileRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative group h-20 w-20 rounded-full overflow-hidden border-2 border-dashed border-input hover:border-cohora-400 transition-colors bg-muted flex-shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                {uploadingAvatar ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Camera className="h-5 w-5 text-muted-foreground group-hover:text-cohora-400 transition-colors" />
                )}
              </div>
            )}
            {avatarUrl && (
              <div className="absolute inset-0 bg-black/[0.40] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
              </div>
            )}
          </button>
          <input
            ref={avatarFileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, '/api/upload/avatar', '/api/auth/me', 'avatarUrl', setUploadingAvatar);
            }}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium">Upload a new photo</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, GIF or WebP — max 5 MB</p>
            <Button type="button" variant="outline" size="sm" onClick={() => avatarFileRef.current?.click()} disabled={uploadingAvatar}>
              {uploadingAvatar ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Uploading...</> : 'Choose file'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <SubscriptionTierManager />

      {/* Creator details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Creator Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Handle</label>
              <div className="flex items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                @{me?.creator?.handle}
              </div>
              <p className="text-xs text-muted-foreground">Handle cannot be changed.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Display Name</label>
              <Input
                value={currentForm.displayName}
                onChange={(e) => setForm({ ...currentForm, displayName: e.target.value })}
                placeholder="Your Name"
                required
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bio <span className="text-muted-foreground">(optional)</span></label>
              <textarea
                value={currentForm.bio}
                onChange={(e) => setForm({ ...currentForm, bio: e.target.value })}
                placeholder="Tell people about yourself..."
                rows={4}
                maxLength={500}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            {error && <p className="text-sm text-destructive rounded-md bg-destructive/[0.10] px-3 py-2">{error}</p>}
            {success && <p className="text-sm text-green-400 rounded-md bg-green-500/10 px-3 py-2">{success}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="cohora" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/app/studio">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/35 bg-destructive/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Delete Cohora account</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Permanently deletes your profile, creator content, purchases, and account data.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            className="shrink-0"
            onClick={() => {
              setDeleteError('');
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteConfirmation('');
            setDeleteError('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your Cohora account?</DialogTitle>
            <DialogDescription>
              This permanently removes your profile, creator content, purchases, and connected Cohora account. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeleteAccount} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="delete-confirmation" className="text-sm font-medium">
                Type <span className="font-mono">DELETE</span> to confirm
              </label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                disabled={deleting}
              />
            </div>
            {deleteError && <p className="rounded-md bg-destructive/[0.10] px-3 py-2 text-sm text-destructive">{deleteError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={deleting || deleteConfirmation !== 'DELETE'}>
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
