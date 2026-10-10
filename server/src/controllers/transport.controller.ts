import { Request, Response } from 'express';
import { TransportService } from '../services/transport.service';

export class TransportController {
  // ── Vehicles ──────────────────────────────────────────────────────────────

  static async getVehicles(req: Request, res: Response): Promise<void> {
    try {
      const vehicles = await TransportService.getVehicles();
      res.json({ success: true, data: vehicles });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch vehicles' });
    }
  }

  static async createVehicle(req: Request, res: Response): Promise<void> {
    try {
      const vehicle = await TransportService.createVehicle(req.body);
      res.status(201).json({ success: true, data: vehicle });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to create vehicle' });
    }
  }

  static async updateVehicle(req: Request, res: Response): Promise<void> {
    try {
      const vehicle = await TransportService.updateVehicle(req.params.id, req.body);
      res.json({ success: true, data: vehicle });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to update vehicle' });
    }
  }

  static async deleteVehicle(req: Request, res: Response): Promise<void> {
    try {
      await TransportService.deleteVehicle(req.params.id);
      res.json({ success: true, message: 'Vehicle deleted' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to delete vehicle' });
    }
  }

  // ── Routes ────────────────────────────────────────────────────────────────

  static async getRoutes(req: Request, res: Response): Promise<void> {
    try {
      const routes = await TransportService.getRoutes();
      res.json({ success: true, data: routes });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch routes' });
    }
  }

  static async getRouteById(req: Request, res: Response): Promise<void> {
    try {
      const route = await TransportService.getRouteById(req.params.id);
      res.json({ success: true, data: route });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message || 'Route not found' });
    }
  }

  static async createRoute(req: Request, res: Response): Promise<void> {
    try {
      const route = await TransportService.createRoute(req.body);
      res.status(201).json({ success: true, data: route });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to create route' });
    }
  }

  static async updateRoute(req: Request, res: Response): Promise<void> {
    try {
      const route = await TransportService.updateRoute(req.params.id, req.body);
      res.json({ success: true, data: route });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to update route' });
    }
  }

  static async deleteRoute(req: Request, res: Response): Promise<void> {
    try {
      await TransportService.deleteRoute(req.params.id);
      res.json({ success: true, message: 'Route deleted' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to delete route' });
    }
  }

  // ── Student Assignments ───────────────────────────────────────────────────

  static async assignStudent(req: Request, res: Response): Promise<void> {
    try {
      const assignment = await TransportService.assignStudentToRoute(req.body);
      res.status(201).json({ success: true, data: assignment });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to assign student to route' });
    }
  }

  static async removeStudent(req: Request, res: Response): Promise<void> {
    try {
      await TransportService.removeStudentFromRoute(req.params.assignmentId);
      res.json({ success: true, message: 'Student removed from route' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to remove student from route' });
    }
  }

  static async getStudentTransport(req: Request, res: Response): Promise<void> {
    try {
      const routes = await TransportService.getStudentTransport(req.params.studentId);
      res.json({ success: true, data: routes });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch student transport' });
    }
  }

  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await TransportService.getTransportStats();
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch transport stats' });
    }
  }
}
