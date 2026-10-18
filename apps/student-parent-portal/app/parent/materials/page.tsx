"use client";

import React from "react";
import { StudentSharedMaterials } from "@/components/student/student-shared-materials";

export default function ParentMaterialsPage() {
  return (
    <div className="w-full max-w-6xl mx-auto overflow-x-hidden">
      <StudentSharedMaterials isParentView={true} />
    </div>
  );
}
