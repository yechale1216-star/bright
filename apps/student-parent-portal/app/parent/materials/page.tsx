"use client";

import React from "react";
import { StudentSharedMaterials } from "@/components/student/student-shared-materials";

export default function ParentMaterialsPage() {
  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1536px] mx-auto overflow-x-hidden">
      <StudentSharedMaterials isParentView={true} />
    </div>
  );
}
