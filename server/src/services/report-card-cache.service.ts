/**
 * High-Performance Multi-Tenant Report Card Cache Service
 * 
 * Provides memory-efficient caching for calculated comprehensive report cards,
 * batch reports, readiness overviews, and static grading/policy metadata.
 * 
 * Strict isolation by tenant (schoolId), student, academic year, term, and role.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  tags: string[];
}

export class ReportCardCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private maxEntries = 1200;

  // Default TTLs (in milliseconds)
  public static readonly TTL_SINGLE_CARD = 5 * 60 * 1000;    // 5 minutes
  public static readonly TTL_BATCH_CARDS = 5 * 60 * 1000;    // 5 minutes
  public static readonly TTL_READINESS   = 3 * 60 * 1000;    // 3 minutes
  public static readonly TTL_METADATA    = 15 * 60 * 1000;   // 15 minutes

  /**
   * Builds an isolated key for an individual student report card
   */
  public getSingleCardKey(params: {
    schoolId?: string;
    studentId: string;
    academicYearId?: string;
    academicTermId?: string;
    role?: string;
  }): string {
    const sId = params.schoolId || 'default';
    const year = params.academicYearId || 'current';
    const term = params.academicTermId || 'annual';
    const role = (params.role === 'student' || params.role === 'parent') ? 'public' : 'admin';
    return `rc:single:${sId}:${params.studentId}:${year}:${term}:${role}`;
  }

  /**
   * Builds an isolated key for a class section batch report card
   */
  public getBatchKey(params: {
    schoolId?: string;
    gradeId: string;
    sectionId: string;
    academicYearId?: string;
    academicTermId?: string;
  }): string {
    const sId = params.schoolId || 'default';
    const year = params.academicYearId || 'current';
    const term = params.academicTermId || 'annual';
    return `rc:batch:${sId}:${params.gradeId}:${params.sectionId}:${year}:${term}`;
  }

  /**
   * Builds an isolated key for class readiness overview
   */
  public getReadinessKey(params: {
    schoolId?: string;
    gradeId: string;
    sectionId: string;
    academicYearId: string;
    academicTermId?: string;
  }): string {
    const sId = params.schoolId || 'default';
    const term = params.academicTermId || 'all';
    return `rc:readiness:${sId}:${params.gradeId}:${params.sectionId}:${params.academicYearId}:${term}`;
  }

  /**
   * Builds an isolated key for reusable metadata
   */
  public getMetadataKey(schoolId: string | undefined, type: string): string {
    const sId = schoolId || 'default';
    return `rc:meta:${sId}:${type}`;
  }

  /**
   * Retrieve item from cache if not expired
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store item in cache with TTL and optional invalidation tags
   */
  public set<T>(key: string, data: T, ttlMs: number = ReportCardCacheService.TTL_SINGLE_CARD, tags: string[] = []): void {
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest(100);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      tags,
    });
  }

  /**
   * Invalidate a specific cache key
   */
  public invalidateKey(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all report card cache entries for a specific student
   */
  public invalidateStudent(studentId: string, schoolId?: string): void {
    const sId = schoolId || '';
    for (const [key, entry] of this.cache.entries()) {
      const matchesKey = key.includes(`:${studentId}:`);
      const matchesTag = entry.tags.includes(`student:${studentId}`);
      const matchesSchool = !sId || key.includes(`:${sId}:`);
      if ((matchesKey || matchesTag) && matchesSchool) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate section batch, readiness, and individual card caches
   */
  public invalidateSection(params: {
    gradeId?: string;
    sectionId?: string;
    academicYearId?: string;
    academicTermId?: string;
    schoolId?: string;
  }): void {
    const { gradeId, sectionId, academicYearId, academicTermId, schoolId } = params;
    for (const [key, entry] of this.cache.entries()) {
      if (schoolId && !key.includes(`:${schoolId}:`)) continue;

      let shouldDelete = false;

      if (sectionId && (key.includes(`:${sectionId}:`) || entry.tags.includes(`section:${sectionId}`))) {
        shouldDelete = true;
      }
      if (gradeId && (key.includes(`:${gradeId}:`) || entry.tags.includes(`grade:${gradeId}`))) {
        shouldDelete = true;
      }
      if (academicYearId && key.includes(`:${academicYearId}:`)) {
        shouldDelete = true;
      }
      if (academicTermId && key.includes(`:${academicTermId}:`)) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate metadata (e.g. when grading scales or school settings change)
   */
  public invalidateMetadata(schoolId?: string, type?: string): void {
    const prefix = type ? `rc:meta:${schoolId || ''}:${type}` : `rc:meta:${schoolId || ''}`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate everything for a school, or globally
   */
  public invalidateAll(schoolId?: string): void {
    if (!schoolId) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(`:${schoolId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clean expired entries or prune oldest
   */
  private evictOldest(count: number): void {
    const now = Date.now();
    let removed = 0;

    // First purge expired
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
        if (removed >= count) return;
      }
    }

    // If still need space, remove earliest inserted
    if (removed < count) {
      for (const key of this.cache.keys()) {
        this.cache.delete(key);
        removed++;
        if (removed >= count) break;
      }
    }
  }
}

export const reportCardCache = new ReportCardCacheService();

