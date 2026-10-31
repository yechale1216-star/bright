'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportCardDesignerTab } from '@/components/school/report-card-designer-tab';

export default function ReportCardDesignPage() {
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/school/admin/settings">
          <Button variant="ghost" size="sm" className="gap-2 text-xs font-semibold">
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Button>
        </Link>
      </div>

      <ReportCardDesignerTab />
    </div>
  );
}
