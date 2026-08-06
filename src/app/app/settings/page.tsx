'use client';

import { LinkedAccounts } from '@/components/settings/LinkedAccounts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/app/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      <LinkedAccounts />

      <Card>
        <CardHeader>
          <CardTitle>About Connected Accounts</CardTitle>
          <CardDescription>
            Linking your Discord account allows you to:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-cohora-400 mt-0.5">•</span>
              <span>Access exclusive community channels and discussions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cohora-400 mt-0.5">•</span>
              <span>Verify your identity for special perks</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cohora-400 mt-0.5">•</span>
              <span>Enable Discord notifications for platform updates</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cohora-400 mt-0.5">•</span>
              <span>Unlock creator-only features and integrations</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
