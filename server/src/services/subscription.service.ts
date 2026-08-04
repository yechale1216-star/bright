/**
 * Subscription Service (Single-School Edition)
 * All SaaS user/student/feature limits are unlimited (-1) in the Single-School Edition.
 */

export interface SchoolLimits {
  maxUsers: number;
  maxStudents: number;
  maxTeachers: number;
  features: string[];
}

export const getSchoolLimits = async (_schoolId: string): Promise<SchoolLimits> => {
  return {
    maxUsers: -1,      // Unlimited
    maxStudents: -1,   // Unlimited
    maxTeachers: -1,   // Unlimited
    features: ['*'],   // All features enabled
  };
};
