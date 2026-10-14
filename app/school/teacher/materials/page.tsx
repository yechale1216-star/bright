'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { learningMaterialClientService, type LearningMaterial } from '@/lib/homework-service';
import { db } from '@/lib/db/database';
import { notifications } from '@/lib/utils/notifications';
import { TeacherSharedMaterials } from '@/components/school/teacher-shared-materials';
import { Spinner } from '@/components/ui/spinner';

export default function TeacherMaterialsPage() {
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [academicYearName, setAcademicYearName] = useState<string>('');

  const loadInitialData = useCallback(async () => {
    try {
      const res = await db.getTeacherPortalClasses();
      if (res) {
        setTeacherAssignments(res.assignments || []);
        if (res.currentYear?.name) {
          setAcademicYearName(res.currentYear.name);
        }
      }
    } catch (e: any) {
      console.error('Failed to load assignments for materials:', e);
    }
  }, []);

  const loadMaterials = useCallback(async () => {
    try {
      setLoading(true);
      const data = await learningMaterialClientService.getAll();
      setMaterials(data || []);
    } catch (e: any) {
      notifications.error('Error', 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
    loadMaterials();
  }, [loadInitialData, loadMaterials]);

  const availableClasses = useMemo(() => {
    return teacherAssignments
      .filter((a) => a.gradeId && (a.subjectId || a.subjectRef?.id))
      .map((a) => ({
        gradeId: a.gradeId,
        gradeName: a.grade?.name || 'Grade',
        sectionId: a.sectionId,
        sectionName: a.section?.name,
        subjectId: a.subjectRef?.id || a.subjectId,
        subjectName: a.subjectRef?.name || a.subject || 'Subject',
      }));
  }, [teacherAssignments]);

  if (loading && materials.length === 0) {
    return (
      <div className="p-16 text-center">
        <Spinner className="w-8 h-8 text-purple-600 mx-auto" />
        <p className="text-xs text-muted-foreground mt-3 font-medium">Loading Shared Educational Materials...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TeacherSharedMaterials
        materials={materials}
        onRefresh={loadMaterials}
        availableClasses={availableClasses}
        classContext={{
          academicYearName,
        }}
      />
    </div>
  );
}
