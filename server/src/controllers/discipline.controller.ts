import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { DisciplineService } from '../services/discipline.service';

export class DisciplineController {
  static async getCategories(req: AuthenticatedRequest, res: Response) {
    try {
      const schoolId = req.user!.schoolId;
      const categories = await DisciplineService.getCategories(schoolId);
      return res.json({ success: true, data: categories });
    } catch (error: any) {
      console.error('[DisciplineController] getCategories error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to fetch categories' });
    }
  }

  static async createCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const schoolId = req.user!.schoolId;
      const { name, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }
      const category = await DisciplineService.createCategory(schoolId, name, description);
      return res.status(201).json({ success: true, data: category });
    } catch (error: any) {
      console.error('[DisciplineController] createCategory error:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to create category' });
    }
  }

  static async deleteCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      await DisciplineService.deleteCategory(schoolId, id);
      return res.json({ success: true, message: 'Category deleted' });
    } catch (error: any) {
      console.error('[DisciplineController] deleteCategory error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to delete category' });
    }
  }

  static async getActionsConfig(req: AuthenticatedRequest, res: Response) {
    try {
      const schoolId = req.user!.schoolId;
      const actions = await DisciplineService.getActionsConfig(schoolId);
      return res.json({ success: true, data: actions });
    } catch (error: any) {
      console.error('[DisciplineController] getActionsConfig error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to fetch actions' });
    }
  }

  static async createActionConfig(req: AuthenticatedRequest, res: Response) {
    try {
      const schoolId = req.user!.schoolId;
      const { name, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Action name is required' });
      }
      const action = await DisciplineService.createActionConfig(schoolId, name, description);
      return res.status(201).json({ success: true, data: action });
    } catch (error: any) {
      console.error('[DisciplineController] createActionConfig error:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to create action' });
    }
  }

  static async deleteActionConfig(req: AuthenticatedRequest, res: Response) {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      await DisciplineService.deleteActionConfig(schoolId, id);
      return res.json({ success: true, message: 'Action configuration deleted' });
    } catch (error: any) {
      console.error('[DisciplineController] deleteActionConfig error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to delete action' });
    }
  }

  static async getIncidents(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const result = await DisciplineService.getIncidents(user, req.query as any);
      return res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('[DisciplineController] getIncidents error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to fetch incidents' });
    }
  }

  static async getIncidentById(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const incident = await DisciplineService.getIncidentById(user, id);
      return res.json({ success: true, data: incident });
    } catch (error: any) {
      console.error('[DisciplineController] getIncidentById error:', error);
      const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message || 'Failed to fetch incident' });
    }
  }

  static async getStudentProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { studentId } = req.params;
      const profile = await DisciplineService.getStudentDisciplineProfile(user, studentId, req.query as any);
      return res.json({ success: true, data: profile });
    } catch (error: any) {
      console.error('[DisciplineController] getStudentProfile error:', error);
      const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message || 'Failed to fetch student discipline profile' });
    }
  }

  static async createIncident(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const incident = await DisciplineService.createIncident(user as any, req.body);
      return res.status(201).json({ success: true, data: incident });
    } catch (error: any) {
      console.error('[DisciplineController] createIncident error:', error);
      const status = error.message?.includes('Forbidden') ? 403 : 400;
      return res.status(status).json({ success: false, message: error.message || 'Failed to create incident' });
    }
  }

  static async updateIncident(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const updated = await DisciplineService.updateIncident(user as any, id, req.body);
      return res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error('[DisciplineController] updateIncident error:', error);
      const status = error.message?.includes('Forbidden') ? 403 : 400;
      return res.status(status).json({ success: false, message: error.message || 'Failed to update incident' });
    }
  }

  static async assignOfficer(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { officerId, notes } = req.body;
      if (!officerId) {
        return res.status(400).json({ success: false, message: 'Officer ID is required for assignment' });
      }
      const updated = await DisciplineService.assignOfficer(user as any, id, officerId, notes);
      return res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error('[DisciplineController] assignOfficer error:', error);
      const status = error.message?.includes('Forbidden') ? 403 : 400;
      return res.status(status).json({ success: false, message: error.message || 'Failed to assign officer' });
    }
  }

  static async updateInvestigation(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const updated = await DisciplineService.updateInvestigation(user as any, id, req.body);
      return res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error('[DisciplineController] updateInvestigation error:', error);
      const status = error.message?.includes('Forbidden') ? 403 : 400;
      return res.status(status).json({ success: false, message: error.message || 'Failed to update investigation' });
    }
  }

  static async updateAction(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const updated = await DisciplineService.updateAction(user as any, id, req.body);
      return res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error('[DisciplineController] updateAction error:', error);
      const status = error.message?.includes('Forbidden') ? 403 : 400;
      return res.status(status).json({ success: false, message: error.message || 'Failed to update action plan' });
    }
  }

  static async deleteIncident(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;
      await DisciplineService.deleteIncident(user, id);
      return res.json({ success: true, message: 'Incident deleted successfully' });
    } catch (error: any) {
      console.error('[DisciplineController] deleteIncident error:', error);
      const status = error.message?.includes('Forbidden') ? 403 : 400;
      return res.status(status).json({ success: false, message: error.message || 'Failed to delete incident' });
    }
  }

  static async acknowledgeIncident(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { notes } = req.body;
      const updated = await DisciplineService.acknowledgeIncident(user, id, notes);
      return res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error('[DisciplineController] acknowledgeIncident error:', error);
      const status = error.message?.includes('Forbidden') ? 403 : 400;
      return res.status(status).json({ success: false, message: error.message || 'Failed to acknowledge incident' });
    }
  }

  static async addFollowUp(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const followUp = await DisciplineService.addFollowUp(user as any, id, req.body);
      return res.json({ success: true, data: followUp });
    } catch (error: any) {
      console.error('[DisciplineController] addFollowUp error:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to add follow-up' });
    }
  }

  static async getAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const analytics = await DisciplineService.getAnalytics(user);
      return res.json({ success: true, data: analytics });
    } catch (error: any) {
      console.error('[DisciplineController] getAnalytics error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to fetch analytics' });
    }
  }
}
