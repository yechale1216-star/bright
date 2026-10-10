import prisma from '../config/db';

export interface VehicleInput {
  plateNumber: string;
  model: string;
  capacity?: number;
  driverName: string;
  driverPhone: string;
  status?: string;
}

export interface RouteInput {
  name: string;
  startPoint: string;
  endPoint: string;
  stops?: any;
  vehicleId?: string;
  status?: string;
}

export interface StudentTransportInput {
  studentId: string;
  routeId: string;
  pickupStop?: string;
  dropoffStop?: string;
  status?: string;
}

export class TransportService {
  // ── Vehicles ──────────────────────────────────────────────────────────────

  static async getVehicles() {
    return prisma.transportVehicle.findMany({
      orderBy: { plateNumber: 'asc' },
      include: {
        routes: {
          select: { id: true, name: true, startPoint: true, endPoint: true },
        },
      },
    });
  }

  static async createVehicle(data: VehicleInput) {
    return prisma.transportVehicle.create({
      data: {
        plateNumber: data.plateNumber,
        model: data.model,
        capacity: data.capacity ? Number(data.capacity) : 30,
        driverName: data.driverName,
        driverPhone: data.driverPhone,
        status: data.status || 'ACTIVE',
      },
    });
  }

  static async updateVehicle(id: string, data: Partial<VehicleInput>) {
    return prisma.transportVehicle.update({
      where: { id },
      data: {
        ...data,
        capacity: data.capacity != null ? Number(data.capacity) : undefined,
      },
    });
  }

  static async deleteVehicle(id: string) {
    return prisma.transportVehicle.delete({ where: { id } });
  }

  // ── Routes ────────────────────────────────────────────────────────────────

  static async getRoutes() {
    return prisma.transportRoute.findMany({
      orderBy: { name: 'asc' },
      include: {
        vehicle: true,
        _count: {
          select: { assignments: { where: { status: 'ACTIVE' } } },
        },
      },
    });
  }

  static async getRouteById(id: string) {
    const route = await prisma.transportRoute.findUnique({
      where: { id },
      include: {
        vehicle: true,
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                student_id: true,
                parent_phone: true,
                parent_name: true,
                grade: { select: { name: true } },
                section: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!route) throw new Error('Route not found');
    return route;
  }

  static async createRoute(data: RouteInput) {
    return prisma.transportRoute.create({
      data: {
        name: data.name,
        startPoint: data.startPoint,
        endPoint: data.endPoint,
        stops: data.stops,
        vehicleId: data.vehicleId || undefined,
        status: data.status || 'ACTIVE',
      },
      include: { vehicle: true },
    });
  }

  static async updateRoute(id: string, data: Partial<RouteInput>) {
    return prisma.transportRoute.update({
      where: { id },
      data: {
        name: data.name,
        startPoint: data.startPoint,
        endPoint: data.endPoint,
        stops: data.stops,
        vehicleId: data.vehicleId !== undefined ? data.vehicleId || null : undefined,
        status: data.status,
      },
      include: { vehicle: true },
    });
  }

  static async deleteRoute(id: string) {
    return prisma.transportRoute.delete({ where: { id } });
  }

  // ── Student Assignments ───────────────────────────────────────────────────

  static async assignStudentToRoute(data: StudentTransportInput) {
    let resolvedStudentId = data.studentId;
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { id: data.studentId },
          { student_id: data.studentId },
        ],
      },
      select: { id: true },
    });
    if (student) {
      resolvedStudentId = student.id;
    } else {
      throw new Error(`Student with ID "${data.studentId}" not found`);
    }

    const route = await prisma.transportRoute.findUnique({ where: { id: data.routeId } });
    if (!route) {
      throw new Error(`Transport route not found`);
    }

    return prisma.studentTransportAssignment.upsert({
      where: {
        studentId_routeId: {
          studentId: resolvedStudentId,
          routeId: data.routeId,
        },
      },
      update: {
        pickupStop: data.pickupStop,
        dropoffStop: data.dropoffStop,
        status: data.status || 'ACTIVE',
      },
      create: {
        studentId: resolvedStudentId,
        routeId: data.routeId,
        pickupStop: data.pickupStop,
        dropoffStop: data.dropoffStop,
        status: data.status || 'ACTIVE',
      },
      include: {
        student: { select: { id: true, fullName: true, student_id: true } },
        route: { select: { id: true, name: true } },
      },
    });
  }

  static async removeStudentFromRoute(assignmentId: string) {
    return prisma.studentTransportAssignment.delete({ where: { id: assignmentId } });
  }

  static async getStudentTransport(studentId: string) {
    return prisma.studentTransportAssignment.findMany({
      where: { studentId, status: 'ACTIVE' },
      include: {
        route: {
          include: {
            vehicle: true,
          },
        },
      },
    });
  }

  static async getTransportStats() {
    const [totalVehicles, totalRoutes, assignedStudents] = await Promise.all([
      prisma.transportVehicle.count(),
      prisma.transportRoute.count(),
      prisma.studentTransportAssignment.count({ where: { status: 'ACTIVE' } }),
    ]);

    return { totalVehicles, totalRoutes, assignedStudents };
  }
}
