'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, PlusCircle, ShoppingBag, CheckCircle2, Wallet, AlertTriangle, Video, Music } from 'lucide-react';
import { formatUsdc } from '@/lib/payments/usdc';
import { useListingFee } from '@/hooks/useListingFee';
import { ItemMenu } from '@/components/ui/ItemMenu';

interface Product {
  id: string;
  name: string;
  description?: string;
  priceUsdc: string;
  fileUrl?: string;
  demoUrl?: string;
  demoType?: 'VIDEO' | 'AUDIO';
  isActive: boolean;
  totalSold?: number;
  salesCount?: number;
}

interface StudioProductsResponse {
  products: Product[];
  communityMemberCount: number;
  meetsCommunityRequirement: boolean;
}

export default function StudioStorePage() {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();

  // ── create dialog ────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    priceUsdc: '',
    fileUrl: '',
    demoUrl: '',
    demoType: 'VIDEO' as 'VIDEO' | 'AUDIO',
  });

  const { payFee, step: feeStep, error: feeError, reset: resetFee } = useListingFee();
  const feePaid = feeStep === 'done';
  const feeInProgress = ['switching_chain', 'approving', 'paying', 'confirming'].includes(feeStep);

  const handleOpen = () => {
    resetFee();
    setError('');
    setForm({ name: '', description: '', priceUsdc: '', fileUrl: '', demoUrl: '', demoType: 'VIDEO' });
    setOpen(true);
  };

  const handlePayFee = async () => {
    setError('');
    try { await payFee(); } catch { /* hook sets error */ }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feePaid) return;
    setSaving(true);
    setError('');
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/studio/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to create product');
      }
      queryClient.invalidateQueries({ queryKey: ['studio-products'] });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  // ── edit dialog ──────────────────────────────────────────────────────────────
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    priceUsdc: '',
    fileUrl: '',
    demoUrl: '',
    demoType: 'VIDEO' as 'VIDEO' | 'AUDIO',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  function openEdit(product: Product) {
    setEditProduct(product);
    const displayPrice = (Number(BigInt(product.priceUsdc)) / 1_000_000).toFixed(2);
    setEditForm({
      name: product.name,
      description: product.description ?? '',
      priceUsdc: displayPrice,
      fileUrl: product.fileUrl ?? '',
      demoUrl: product.demoUrl ?? '',
      demoType: product.demoType ?? 'VIDEO',
    });
    setEditError('');
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setEditSaving(true);
    setEditError('');
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/studio/products/${editProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          priceUsdc: editForm.priceUsdc,
          fileUrl: editForm.fileUrl,
          demoUrl: editForm.demoUrl,
          demoType: editForm.demoType,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to save');
      }
      queryClient.invalidateQueries({ queryKey: ['studio-products'] });
      setEditProduct(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setEditSaving(false);
    }
  };

  async function deleteProduct(id: string) {
    try {
      const token = await getAccessToken();
      await fetch(`/api/studio/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      queryClient.invalidateQueries({ queryKey: ['studio-products'] });
    } catch { /* silent */ }
  }

  // ── query ────────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['studio-products'],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch('/api/studio/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { products: [], communityMemberCount: 0, meetsCommunityRequirement: false };
      const raw = await res.json();
      if (Array.isArray(raw)) {
        return { products: raw, communityMemberCount: 0, meetsCommunityRequirement: false };
      }
      return raw as StudioProductsResponse;
    },
  });

  const products = data?.products ?? [];
  const communityMemberCount = data?.communityMemberCount ?? 0;
  const meetsCommunityRequirement = data?.meetsCommunityRequirement ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Digital Store</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Community members: {communityMemberCount} / 5 minimum required to list products
          </p>
        </div>
        <Button variant="cohora" size="sm" onClick={handleOpen} disabled={!meetsCommunityRequirement}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Product
        </Button>
      </div>

      {!meetsCommunityRequirement && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 text-amber-300 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-white">Active Community Requirement (5–10 Members)</p>
            <p className="text-white/[0.70]">
              To list and advertise digital products on Cohora, creators must maintain an active community of at least 5 members (for chats, posts, and product support discussions).
              Your community currently has <strong className="text-amber-300">{communityMemberCount} active members</strong>.
            </p>
            <Link href="/app/studio/communities" className="inline-block pt-1 text-xs font-semibold text-amber-300 underline">
              Manage / Build Your Community →
            </Link>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">No products listed yet.</p>
          {meetsCommunityRequirement && (
            <Button variant="cohora" size="sm" onClick={handleOpen}>Add your first product</Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base truncate">{product.name}</CardTitle>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={product.isActive ? 'default' : 'outline'}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <ItemMenu
                      onEdit={() => openEdit(product)}
                      onDelete={() => deleteProduct(product.id)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                {product.description && <p>{product.description}</p>}
                
                {/* Product demo preview in Studio */}
                {product.demoUrl && (
                  <div className="rounded-lg border border-white/[0.08] bg-black/40 p-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-white/[0.70]">
                      {product.demoType === 'AUDIO' ? <Music className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                      <span>Product Demo ({product.demoType})</span>
                    </div>
                    {product.demoType === 'AUDIO' ? (
                      <audio controls src={product.demoUrl} className="w-full h-8" />
                    ) : (
                      <video controls src={product.demoUrl} className="w-full rounded bg-black aspect-video" />
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-foreground font-semibold text-sm">{formatUsdc(BigInt(product.priceUsdc))}</span>
                  {(product.totalSold !== undefined || product.salesCount !== undefined) && (
                    <span>{(product.totalSold ?? product.salesCount ?? 0)} sold</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create dialog ── */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) { resetFee(); setError(''); } setOpen(v); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Digital Product</DialogTitle></DialogHeader>

          {!feePaid ? (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-3 space-y-3">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Wallet className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Listing a product requires a <strong className="text-foreground">0.10 USDC fee</strong> paid from your wallet before saving.</span>
              </div>
              {feeError && (
                <p className="text-xs text-destructive rounded bg-destructive/[0.10] px-2 py-1.5">
                  {feeError}
                  <button type="button" onClick={resetFee} className="ml-2 underline">Retry</button>
                </p>
              )}
              <Button variant="cohora" size="sm" onClick={handlePayFee} disabled={feeInProgress}>
                {feeInProgress && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {feeStep === 'approving' ? 'Approve 0.10 USDC in wallet...' : feeStep === 'paying' ? 'Confirm 0.10 USDC deduction...' : feeStep === 'confirming' ? 'Confirming on-chain...' : 'Pay 0.10 USDC Listing Fee'}
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 flex items-center gap-2 text-xs text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              0.10 USDC listing fee confirmed.
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Product Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Masterclass E-book" required />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detailed item description" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Price (USDC)</label>
              <Input type="number" step="0.01" min="0.01" value={form.priceUsdc} onChange={(e) => setForm({ ...form, priceUsdc: e.target.value })} placeholder="e.g. 5.00" required />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Product Delivery File URL (optional)</label>
              <Input value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} placeholder="https://... (download file URL after purchase)" />
            </div>

            {/* Product Demo (Video/Audio) section */}
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-3">
              <label className="text-xs font-semibold text-white/80 uppercase tracking-wider block">Product Demo Preview (Video or Audio)</label>
              <div className="flex gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="demoType"
                    checked={form.demoType === 'VIDEO'}
                    onChange={() => setForm({ ...form, demoType: 'VIDEO' })}
                  />
                  <span>Video Demo</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="demoType"
                    checked={form.demoType === 'AUDIO'}
                    onChange={() => setForm({ ...form, demoType: 'AUDIO' })}
                  />
                  <span>Audio Demo</span>
                </label>
              </div>

              <Input
                value={form.demoUrl}
                onChange={(e) => setForm({ ...form, demoUrl: e.target.value })}
                placeholder={form.demoType === 'VIDEO' ? 'https://... (demo video URL)' : 'https://... (demo audio URL)'}
              />

              {form.demoUrl && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Demo Preview:</p>
                  {form.demoType === 'AUDIO' ? (
                    <audio controls src={form.demoUrl} className="w-full h-8" />
                  ) : (
                    <video controls src={form.demoUrl} className="w-full rounded bg-black aspect-video" />
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="cohora" type="submit" disabled={saving || !feePaid}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Product
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={Boolean(editProduct)} onOpenChange={(v) => { if (!v) setEditProduct(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>

          {editError && <p className="text-sm text-destructive">{editError}</p>}

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Product Name</label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Price (USDC)</label>
              <Input type="number" step="0.01" min="0.01" value={editForm.priceUsdc} onChange={(e) => setEditForm({ ...editForm, priceUsdc: e.target.value })} required />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Delivery File URL</label>
              <Input value={editForm.fileUrl} onChange={(e) => setEditForm({ ...editForm, fileUrl: e.target.value })} placeholder="https://..." />
            </div>

            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-3">
              <label className="text-xs font-semibold text-white/80 uppercase tracking-wider block">Product Demo Preview (Video or Audio)</label>
              <div className="flex gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="editDemoType"
                    checked={editForm.demoType === 'VIDEO'}
                    onChange={() => setEditForm({ ...editForm, demoType: 'VIDEO' })}
                  />
                  <span>Video Demo</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="editDemoType"
                    checked={editForm.demoType === 'AUDIO'}
                    onChange={() => setEditForm({ ...editForm, demoType: 'AUDIO' })}
                  />
                  <span>Audio Demo</span>
                </label>
              </div>

              <Input
                value={editForm.demoUrl}
                onChange={(e) => setEditForm({ ...editForm, demoUrl: e.target.value })}
                placeholder="Demo media URL"
              />

              {editForm.demoUrl && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Demo Preview:</p>
                  {editForm.demoType === 'AUDIO' ? (
                    <audio controls src={editForm.demoUrl} className="w-full h-8" />
                  ) : (
                    <video controls src={editForm.demoUrl} className="w-full rounded bg-black aspect-video" />
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditProduct(null)}>Cancel</Button>
              <Button variant="cohora" type="submit" disabled={editSaving}>
                {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
