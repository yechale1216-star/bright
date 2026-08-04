"use strict";
/**
 * Subscription Service (Single-School Edition)
 * All SaaS user/student/feature limits are unlimited (-1) in the Single-School Edition.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSchoolLimits = void 0;
const getSchoolLimits = async (_schoolId) => {
    return {
        maxUsers: -1, // Unlimited
        maxStudents: -1, // Unlimited
        maxTeachers: -1, // Unlimited
        features: ['*'], // All features enabled
    };
};
exports.getSchoolLimits = getSchoolLimits;
