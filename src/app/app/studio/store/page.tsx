'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, PlusCircle, ShoppingBag, CheckCircle2, Wallet } from 'lucide-react';
import { formatUsdc } from '@/lib/payments/usdc';
import { useListingFee } from '@/hooks/useListingFee';
import { ItemMenu } from '@/components/ui/ItemMenu';

interface Product {
  id: string;
  name: string;
  description?: string;
  priceUsdc: string;
  isActive: boolean;
  salesCount?: number;
}

export default function StudioStorePage() {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();

  // ── create dialog ────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', priceUsdc: '', fileUrl: '' });

  const { payFee, step: feeStep, error: feeError, reset: resetFee } = useListingFee();
  const feePaid = feeStep === 'done';
  const feeInProgress = feeStep === 'waiting_wallet' || feeStep === 'confirming';

  const handleOpen = () => {
    resetFee();
    setError('');
    setForm({ name: '', description: '', priceUsdc: '', fileUrl: '' });
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
  const [editForm, setEditForm] = useState({ name: '', description: '', priceUsdc: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  function openEdit(product: Product) {
    setEditProduct(product);
    // Convert from raw units back to display value: priceUsdc is stored as BigInt units
    const displayPrice = (Number(BigInt(product.priceUsdc)) / 1_000_000).toFixed(2);
    setEditForm({
      name: product.name,
      description: product.description ?? '',
      priceUsdc: displayPrice,
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

  // ── delete ───────────────────────────────────────────────────────────────────
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
      if (!res.ok) return [];
      return res.json() as Promise<Product[]>;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Digital Store</h2>
        <Button variant="cohora" size="sm" onClick={handleOpen}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Product
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">No products yet.</p>
          <Button variant="cohora" size="sm" onClick={handleOpen}>Add your first product</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((product) => (
            <Card key={product.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base truncate">{product.name}</CardTitle>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={product.isActive ? 'default' : 'outline'}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {/* ⋮ menu */}
                    <ItemMenu
                      onEdit={() => openEdit(product)}
                      onDelete={() => deleteProduct(product.id)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                {product.description && <p>{product.description}</p>}
                <p className="text-foreground font-medium">{formatUsdc(BigInt(product.priceUsdc))}</p>
                {product.salesCount !== undefined && (
                  <p className="text-xs">{product.salesCount} {product.salesCount === 1 ? 'sale' : 'sales'}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create dialog ── */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) { resetFee(); setError(''); } setOpen(v); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>

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
                {feeStep === 'waiting_wallet' ? 'Confirm in wallet...' : feeStep === 'confirming' ? 'Confirming...' : 'Pay 0.10 USDC Listing Fee'}
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 flex items-center gap-2 text-xs text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              0.10 USDC listing fee confirmed.
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Price (USDC)</label>
              <Input type="number" min="0.01" step="0.01" value={form.priceUsdc} onChange={(e) => setForm({ ...form, priceUsdc: e.target.value })} placeholder="e.g. 10.00" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">File URL <span className="text-muted-foreground">(optional)</span></label>
              <Input value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} placeholder="https://..." />
            </div>
            {error && <p className="text-sm text-destructive rounded-md bg-destructive/[0.10] px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-1">
              <Button type="submit" variant="cohora" disabled={!feePaid || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? 'Creating...' : 'Create Product'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editProduct} onOpenChange={(v) => { if (!v) setEditProduct(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit product</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Product name" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Optional description" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Price (USDC)</label>
              <Input type="number" min="0.01" step="0.01" value={editForm.priceUsdc} onChange={(e) => setEditForm({ ...editForm, priceUsdc: e.target.value })} placeholder="e.g. 10.00" required />
            </div>
            {editError && <p className="text-sm text-destructive rounded-md bg-destructive/[0.10] px-3 py-2">{editError}</p>}
            <div className="flex gap-3 pt-1">
              <Button type="submit" variant="cohora" disabled={editSaving}>
                {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editSaving ? 'Saving…' : 'Save changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditProduct(null)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
