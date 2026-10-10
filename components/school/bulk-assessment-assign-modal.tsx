'use client';

/**
 * @deprecated
 * This modal has been consolidated into the unified full-page Bulk Assignment workflow:
 * /school/admin/assessments/bulk-assignment
 *
 * All features (stream selection, quick grade selectors, preview with policy toggles,
 * and batch creation/updates) are now centralized in that page.
 */

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SlidersHorizontal, ArrowRight } from 'lucide-react';

export function BulkAssessmentAssignModal({
  open,
  onOpenChange,
  initialSchemeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  [key: string]: any;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="w-5 h-5 text-purple-600" />
            Bulk Assignment Workflow
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground my-2">
          Bulk assessment assignment is now located in the central Assessments module with advanced stream support, quick grade filters, preview diffs, and conflict resolution.
        </p>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Link href={initialSchemeId ? `/school/admin/assessments/bulk-assignment?schemeId=${initialSchemeId}` : '/school/admin/assessments/bulk-assignment'}>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5" onClick={() => onOpenChange(false)}>
              Open Bulk Assignment <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
