import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/auth.middleware';
import * as rolesService from '../services/roles.service';

const router = Router();

// GET /api/roles — list all active system roles available to the authenticated school
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    const roles = await rolesService.getSystemRoles(schoolId);
    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
});

// GET /api/roles/:key — get a single role by key within school context
router.get('/:key', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    const role = await rolesService.getRoleByKey(req.params.key, schoolId);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    res.status(200).json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
});

// POST /api/roles — create a new custom role
router.post('/', authorize(['admin', 'school_admin']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId || '';
    const { key, name, description, color, permissions } = req.body;
    const role = await rolesService.createRole(schoolId, { key, name, description, color, permissions });
    res.status(201).json({ success: true, data: role });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Could not create custom role' });
  }
});

// PUT /api/roles/:id — update custom or system role policy (admin/super_admin only)
router.put('/:id', authorize(['admin', 'school_admin']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId || '';
    const { name, description, color, permissions, isActive } = req.body;
    const role = await rolesService.updateRole(req.params.id, schoolId, { name, description, color, permissions, isActive });
    res.status(200).json({ success: true, data: role });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Could not update role' });
  }
});

// DELETE /api/roles/:id — delete custom role belonging to this school
router.delete('/:id', authorize(['admin', 'school_admin']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId || '';
    await rolesService.deleteRole(req.params.id, schoolId);
    res.status(200).json({ success: true, message: 'Role deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Could not delete custom role' });
  }
});

export default router;
