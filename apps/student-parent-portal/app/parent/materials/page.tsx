'use client';

import React from 'react';
import { StudentSharedMaterials } from '@/components/student/student-shared-materials';

export default function ParentMaterialsPage() {
  return <StudentSharedMaterials isParentView={true} />;
}
