import StudentActivatePage from "@/apps/student-parent-portal/app/student/activate/page";
import { createPageMetadata } from "@/lib/seo/metadata-constants";

export const metadata = createPageMetadata({
  title: "Activate Student Account — Bright Path",
  description: "Activate your Bright Path student account using your school-issued Student ID and activation code.",
  path: "/activate",
  noIndex: true,
});

export default StudentActivatePage;
