import { Router, Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/auth.middleware';
import * as schoolService from '../services/school.service';

const router = Router();

const STRUCTURE_ADMINS = ['admin', 'school_admin', 'super_admin', 'academic_head', 'registrar'];
const CURRICULUM_ADMINS = ['admin', 'school_admin', 'super_admin', 'academic_head'];
const EXECUTIVE_ADMINS = ['admin', 'school_admin', 'super_admin'];

// ─── Grades ─────────────────────────────────────────────────────────────────
const getGradesHandler = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const grades = await schoolService.getGrades();
    res.status(200).json({ success: true, data: grades });
  } catch (error) { next(error); }
};
router.get('/me/grades', getGradesHandler);
router.get('/grades', getGradesHandler); // alias for frontend compatibility

router.post('/me/grades', authorize(STRUCTURE_ADMINS), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const grade = await schoolService.createGrade(req.body);
    res.status(201).json({ success: true, data: grade });
  } catch (error) { next(error); }
});

router.put('/me/grades/:id', authorize(STRUCTURE_ADMINS), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const grade = await schoolService.updateGrade(req.params.id, req.body);
    res.status(200).json({ success: true, data: grade });
  } catch (error) { next(error); }
});

router.delete('/me/grades/:id', authorize(STRUCTURE_ADMINS), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await schoolService.deleteGrade(req.params.id);
    res.status(200).json({ success: true, message: 'Grade deleted successfully' });
  } catch (error) { next(error); }
});

// ─── Sections ───────────────────────────────────────────────────────────────
const getSectionsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { gradeId } = req.query as { gradeId?: string };
    const sections = await schoolService.getSections(gradeId);
    res.status(200).json({ success: true, data: sections });
  } catch (error) { next(error); }
};
router.get('/me/sections', getSectionsHandler);
router.get('/sections', getSectionsHandler); // alias for frontend compatibility

router.post('/me/sections', authorize(STRUCTURE_ADMINS), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const section = await schoolService.createSection(req.body);
    res.status(201).json({ success: true, data: section });
  } catch (error) { next(error); }
});

router.put('/me/sections/:id', authorize(STRUCTURE_ADMINS), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const section = await schoolService.updateSection(req.params.id, req.body);
    res.status(200).json({ success: true, data: section });
  } catch (error) { next(error); }
});

router.delete('/me/sections/:id', authorize(STRUCTURE_ADMINS), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await schoolService.deleteSection(req.params.id);
    res.status(200).json({ success: true, message: 'Section deleted successfully' });
  } catch (error) { next(error); }
});

// ─── Streams ────────────────────────────────────────────────────────────────
router.get('/me/streams', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const streams = await schoolService.getStreams();
    res.status(200).json({ success: true, data: streams });
  } catch (error) { next(error); }
});

router.post('/me/streams', authorize(STRUCTURE_ADMINS), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const stream = await schoolService.createStream(req.body);
    res.status(201).json({ success: true, data: stream });
  } catch (error) { next(error); }
});

router.put('/me/streams/:id', authorize(STRUCTURE_ADMINS), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const stream = await schoolService.updateStream(req.params.id, req.body);
    res.status(200).json({ success: true, data: stream });
  } catch (error) { next(error); }
});

router.delete('/me/streams/:id', authorize(STRUCTURE_ADMINS), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await schoolService.deleteStream(req.params.id);
    res.status(200).json({ success: true, message: 'Stream deleted successfully' });
  } catch (error) { next(error); }
});

// ─── Subjects ───────────────────────────────────────────────────────────────
const getSubjectsHandler = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subjects = await schoolService.getSubjects();
    res.status(200).json({ success: true, data: subjects });
  } catch (error) { next(error); }
};
router.get('/me/subjects', getSubjectsHandler);
router.get('/subjects', getSubjectsHandler); // alias for frontend compatibility

router.post('/me/subjects', authorize(CURRICULUM_ADMINS), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subject = await schoolService.createSubject(req.body);
    res.status(201).json({ success: true, data: subject });
  } catch (error) { next(error); }
});

router.put('/me/subjects/:id', authorize(CURRICULUM_ADMINS), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subject = await schoolService.updateSubject(req.params.id, req.body);
    res.status(200).json({ success: true, data: subject });
  } catch (error) { next(error); }
});

router.delete('/me/subjects/:id', authorize(CURRICULUM_ADMINS), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await schoolService.deleteSubject(req.params.id);
    res.status(200).json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) { next(error); }
});

// Create or upsert school
router.post('/', authorize(EXECUTIVE_ADMINS), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const school = await schoolService.createSchool(req.body);
    res.status(200).json({ success: true, data: school });
  } catch (error) { next(error); }
});

// Update school by ID
router.put('/:id', authorize(EXECUTIVE_ADMINS), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const school = await schoolService.updateSchool(req.params.id, req.body);
    res.status(200).json({ success: true, data: school });
  } catch (error) { next(error); }
});

// Get school by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    let school;
    if (id.startsWith('SCH-')) {
      school = await schoolService.getSchoolByCustomId(id);
    } else {
      school = await schoolService.getSchoolById(id);
    }
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });
    res.status(200).json({ success: true, data: school });
  } catch (error) { next(error); }
});

export default router;

