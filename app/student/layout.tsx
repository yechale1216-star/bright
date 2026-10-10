import React from "react";
import { StudentClientLayout } from "./student-client-layout";
import { createPageMetadata } from "@/lib/seo/metadata-constants";

export const metadata = createPageMetadata({
  title: "Student Portal — Bright Path",
  description: "Bright Path student portal for marks, timetable, attendance, classes, and announcements.",
  path: "/student",
  noIndex: true,
});

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentClientLayout>{children}</StudentClientLayout>;
}
