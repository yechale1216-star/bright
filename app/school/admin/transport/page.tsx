'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Bus,
  Plus,
  Search,
  Trash2,
  Edit2,
  Users,
  MapPin,
  Clock,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  Navigation,
} from 'lucide-react';
import {
  transportClientService,
  TransportVehicle,
  TransportRoute,
  StudentTransportAssignment,
  TransportStats,
  RouteStop,
} from '@/lib/facilities-service';
import { notifications } from '@/lib/utils/notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function AdminTransportPage() {
  const [activeTab, setActiveTab] = useState<'routes' | 'vehicles' | 'roster'>('routes');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<TransportStats>({
    totalVehicles: 0,
    totalRoutes: 0,
    assignedStudents: 0,
  });

  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [selectedRouteDetail, setSelectedRouteDetail] = useState<TransportRoute | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Vehicle Modal
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<TransportVehicle | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    plateNumber: '',
    model: '',
    capacity: 30,
    driverName: '',
    driverPhone: '',
    status: 'ACTIVE',
  });

  // Route Modal
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);
  const [routeForm, setRouteForm] = useState({
    name: '',
    startPoint: '',
    endPoint: '',
    vehicleId: '',
    status: 'ACTIVE',
  });
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [newStopName, setNewStopName] = useState('');
  const [newStopTime, setNewStopTime] = useState('');

  // Assign Student Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    studentId: '',
    routeId: '',
    pickupStop: '',
    dropoffStop: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, routesData, vehiclesData] = await Promise.all([
        transportClientService.getStats().catch(() => ({ totalVehicles: 0, totalRoutes: 0, assignedStudents: 0 })),
        transportClientService.getRoutes(),
        transportClientService.getVehicles(),
      ]);
      setStats(statsData);
      setRoutes(routesData);
      setVehicles(vehiclesData);
    } catch {
      notifications.error('Error', 'Failed to load transport data');
    } finally {
      setLoading(false);
    }
  };

  const loadRouteDetail = async (routeId: string) => {
    try {
      const detail = await transportClientService.getRouteById(routeId);
      setSelectedRouteDetail(detail);
    } catch {
      notifications.error('Error', 'Failed to load route detail');
    }
  };

  // Vehicle Actions
  const handleSaveVehicle = async () => {
    if (!vehicleForm.plateNumber || !vehicleForm.model || !vehicleForm.driverName || !vehicleForm.driverPhone) {
      notifications.error('Validation Error', 'Please complete all required fields');
      return;
    }
    try {
      if (editingVehicle) {
        await transportClientService.updateVehicle(editingVehicle.id, {
          ...vehicleForm,
          capacity: Number(vehicleForm.capacity),
        });
        notifications.success('Success', 'Vehicle updated successfully');
      } else {
        await transportClientService.createVehicle({
          ...vehicleForm,
          capacity: Number(vehicleForm.capacity),
        });
        notifications.success('Success', 'Vehicle added to fleet');
      }
      setVehicleModalOpen(false);
      setEditingVehicle(null);
      resetVehicleForm();
      loadData();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to save vehicle');
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!confirm('Are you sure you want to remove this vehicle?')) return;
    try {
      await transportClientService.deleteVehicle(id);
      notifications.success('Success', 'Vehicle removed');
      loadData();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to delete vehicle');
    }
  };

  const openEditVehicle = (v: TransportVehicle) => {
    setEditingVehicle(v);
    setVehicleForm({
      plateNumber: v.plateNumber,
      model: v.model,
      capacity: v.capacity,
      driverName: v.driverName,
      driverPhone: v.driverPhone,
      status: v.status,
    });
    setVehicleModalOpen(true);
  };

  const resetVehicleForm = () => {
    setVehicleForm({
      plateNumber: '',
      model: '',
      capacity: 30,
      driverName: '',
      driverPhone: '',
      status: 'ACTIVE',
    });
  };

  // Route Actions
  const openCreateRoute = () => {
    setEditingRoute(null);
    setRouteForm({ name: '', startPoint: '', endPoint: '', vehicleId: '', status: 'ACTIVE' });
    setRouteStops([]);
    setRouteModalOpen(true);
  };

  const openEditRoute = (r: TransportRoute) => {
    setEditingRoute(r);
    setRouteForm({
      name: r.name,
      startPoint: r.startPoint,
      endPoint: r.endPoint,
      vehicleId: r.vehicleId || '',
      status: r.status,
    });
    setRouteStops(Array.isArray(r.stops) ? r.stops : []);
    setRouteModalOpen(true);
  };

  const addStopToRoute = () => {
    if (!newStopName) return;
    setRouteStops([
      ...routeStops,
      { name: newStopName, time: newStopTime || undefined, order: routeStops.length + 1 },
    ]);
    setNewStopName('');
    setNewStopTime('');
  };

  const removeStop = (index: number) => {
    setRouteStops(routeStops.filter((_, i) => i !== index));
  };

  const handleSaveRoute = async () => {
    if (!routeForm.name || !routeForm.startPoint || !routeForm.endPoint) {
      notifications.error('Validation Error', 'Route Name, Start Point, and End Point are required');
      return;
    }
    try {
      if (editingRoute) {
        await transportClientService.updateRoute(editingRoute.id, {
          ...routeForm,
          stops: routeStops,
        });
        notifications.success('Success', 'Route updated successfully');
      } else {
        await transportClientService.createRoute({
          ...routeForm,
          stops: routeStops,
        });
        notifications.success('Success', 'Route created successfully');
      }
      setRouteModalOpen(false);
      setEditingRoute(null);
      loadData();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to save route');
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (!confirm('Are you sure you want to delete this route?')) return;
    try {
      await transportClientService.deleteRoute(id);
      notifications.success('Success', 'Route deleted');
      loadData();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to delete route');
    }
  };

  // Student Assignment
  const handleAssignStudent = async () => {
    if (!assignForm.studentId || !assignForm.routeId) {
      notifications.error('Validation Error', 'Student ID and Route selection are required');
      return;
    }
    try {
      await transportClientService.assignStudent(assignForm);
      notifications.success('Success', 'Student assigned to route');
      setAssignModalOpen(false);
      if (selectedRouteDetail) loadRouteDetail(selectedRouteDetail.id);
      loadData();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to assign student');
    }
  };

  const handleRemoveStudent = async (assignmentId: string) => {
    if (!confirm('Remove student from this transport route?')) return;
    try {
      await transportClientService.removeStudent(assignmentId);
      notifications.success('Success', 'Student removed from route');
      if (selectedRouteDetail) loadRouteDetail(selectedRouteDetail.id);
      loadData();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to remove student');
    }
  };

  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin', 'transport_manager']}>
      <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Bus className="w-7 h-7" />
            </div>
            Transport & Fleet Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage school buses, routes, driver contacts, and student transport rosters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'routes' && (
            <Button onClick={openCreateRoute} className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-md gap-2">
              <Plus className="w-4 h-4" /> Add Route
            </Button>
          )}
          {activeTab === 'vehicles' && (
            <Button
              onClick={() => {
                setEditingVehicle(null);
                resetVehicleForm();
                setVehicleModalOpen(true);
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-md gap-2"
            >
              <Plus className="w-4 h-4" /> Add Vehicle
            </Button>
          )}
          {activeTab === 'roster' && (
            <Button
              onClick={() => {
                setAssignForm({ studentId: '', routeId: routes[0]?.id || '', pickupStop: '', dropoffStop: '' });
                setAssignModalOpen(true);
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-md gap-2"
            >
              <Plus className="w-4 h-4" /> Assign Student
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Fleet Vehicles</p>
            <p className="text-xl font-bold text-foreground">{stats.totalVehicles}</p>
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Active Routes</p>
            <p className="text-xl font-bold text-foreground">{stats.totalRoutes}</p>
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Assigned Students</p>
            <p className="text-xl font-bold text-foreground">{stats.assignedStudents}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/70 gap-2">
        <button
          onClick={() => setActiveTab('routes')}
          className={`pb-3 px-4 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'routes'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Navigation className="w-4 h-4" /> Routes & Stops ({routes.length})
        </button>
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`pb-3 px-4 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'vehicles'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bus className="w-4 h-4" /> Fleet Vehicles ({vehicles.length})
        </button>
        <button
          onClick={() => setActiveTab('roster')}
          className={`pb-3 px-4 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'roster'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4" /> Student Roster
        </button>
      </div>

      {/* Tab 1: Routes */}
      {activeTab === 'routes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routes.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-card border border-border/70 rounded-2xl text-muted-foreground">
              <Navigation className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-semibold">No transport routes created yet</p>
              <p className="text-xs mt-1">Click "Add Route" above to configure your first bus route.</p>
            </div>
          ) : (
            routes.map((route) => (
              <div
                key={route.id}
                className="bg-card border border-border/80 rounded-2xl p-5 hover:border-amber-500/40 transition-all flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      {route.status}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {route._count?.assignments ?? 0} Students
                    </span>
                  </div>

                  <h3 className="font-bold text-foreground text-base mb-1">{route.name}</h3>

                  <div className="space-y-1.5 my-3 text-xs bg-secondary/30 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-medium text-foreground">{route.startPoint}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="font-medium text-foreground">{route.endPoint}</span>
                    </div>
                    {route.vehicle && (
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          <Bus className="w-3.5 h-3.5 text-amber-500" /> {route.vehicle.plateNumber}
                        </span>
                        <span>{route.vehicle.driverName}</span>
                      </div>
                    )}
                  </div>

                  {Array.isArray(route.stops) && route.stops.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase mb-1">
                        Stops ({route.stops.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {route.stops.map((s, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] bg-secondary/50 text-foreground px-2 py-0.5 rounded-md"
                          >
                            {s.name} {s.time && `(${s.time})`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      loadRouteDetail(route.id);
                      setActiveTab('roster');
                    }}
                    className="flex-1 text-xs rounded-xl"
                  >
                    <Users className="w-3.5 h-3.5 mr-1" /> View Roster
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditRoute(route)}
                    className="p-2 text-muted-foreground hover:text-amber-500 rounded-xl"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteRoute(route.id)}
                    className="p-2 text-muted-foreground hover:text-rose-500 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Vehicles */}
      {activeTab === 'vehicles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-card border border-border/70 rounded-2xl text-muted-foreground">
              <Bus className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-semibold">No vehicles registered</p>
              <p className="text-xs mt-1">Register a school bus or van by clicking "Add Vehicle".</p>
            </div>
          ) : (
            vehicles.map((v) => (
              <div
                key={v.id}
                className="bg-card border border-border/80 rounded-2xl p-5 hover:border-amber-500/40 transition-all flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-extrabold text-foreground text-lg tracking-tight">
                      {v.plateNumber}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                        v.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-amber-500/10 text-amber-500'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground font-medium mb-3">{v.model}</p>

                  <div className="space-y-2 text-xs bg-secondary/30 rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className="font-bold text-foreground">{v.capacity} Passengers</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Driver</span>
                      <span className="font-semibold text-foreground">{v.driverName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Phone</span>
                      <a href={`tel:${v.driverPhone}`} className="text-amber-500 font-semibold hover:underline flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {v.driverPhone}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditVehicle(v)}
                    className="flex-1 text-xs text-muted-foreground hover:text-amber-500 rounded-xl"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteVehicle(v.id)}
                    className="p-2 text-muted-foreground hover:text-rose-500 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Student Roster */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card border border-border/80 rounded-2xl p-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Select Route:</Label>
              <select
                value={selectedRouteDetail?.id || ''}
                onChange={(e) => loadRouteDetail(e.target.value)}
                className="bg-card border border-border rounded-xl text-sm px-3 py-1.5 text-foreground w-full sm:w-64"
              >
                <option value="">Choose Route</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            {selectedRouteDetail && (
              <span className="text-xs font-bold bg-amber-500/10 text-amber-500 px-3 py-1 rounded-xl">
                {selectedRouteDetail.assignments?.length || 0} Registered Students
              </span>
            )}
          </div>

          <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase border-b border-border/60">
                  <tr>
                    <th className="p-3.5 pl-5">Student</th>
                    <th className="p-3.5">Grade / Section</th>
                    <th className="p-3.5">Pickup Stop</th>
                    <th className="p-3.5">Dropoff Stop</th>
                    <th className="p-3.5">Parent Contact</th>
                    <th className="p-3.5 text-right pr-5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {!selectedRouteDetail ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                        Please select a route above to view assigned passengers
                      </td>
                    </tr>
                  ) : selectedRouteDetail.assignments?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                        No students assigned to this route yet
                      </td>
                    </tr>
                  ) : (
                    selectedRouteDetail.assignments?.map((a) => (
                      <tr key={a.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-3.5 pl-5 font-semibold text-foreground">
                          {a.student?.fullName}
                          <span className="block text-xs font-normal text-muted-foreground">ID: {a.student?.student_id}</span>
                        </td>
                        <td className="p-3.5 text-xs text-muted-foreground">
                          {a.student?.grade?.name} {a.student?.section?.name ? `· ${a.student?.section?.name}` : ''}
                        </td>
                        <td className="p-3.5 text-xs font-medium text-foreground">{a.pickupStop || 'Start Point'}</td>
                        <td className="p-3.5 text-xs font-medium text-foreground">{a.dropoffStop || 'School'}</td>
                        <td className="p-3.5 text-xs text-muted-foreground">
                          {a.student?.parent_phone && (
                            <a href={`tel:${a.student.parent_phone}`} className="text-amber-500 hover:underline">
                              {a.student.parent_phone}
                            </a>
                          )}
                        </td>
                        <td className="p-3.5 text-right pr-5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveStudent(a.id)}
                            className="p-2 text-muted-foreground hover:text-rose-500 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Modal */}
      <Dialog open={vehicleModalOpen} onOpenChange={setVehicleModalOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle to Fleet'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Plate Number *</Label>
              <Input
                value={vehicleForm.plateNumber}
                onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value })}
                placeholder="e.g. 3-B12345"
                className="rounded-xl mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Model / Type *</Label>
                <Input
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                  placeholder="e.g. Toyota Coaster"
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Capacity (seats)</Label>
                <Input
                  type="number"
                  min="1"
                  value={vehicleForm.capacity}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: Number(e.target.value) })}
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Driver Name *</Label>
                <Input
                  value={vehicleForm.driverName}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, driverName: e.target.value })}
                  placeholder="Driver Full Name"
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Driver Phone *</Label>
                <Input
                  value={vehicleForm.driverPhone}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, driverPhone: e.target.value })}
                  placeholder="0911..."
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <select
                value={vehicleForm.status}
                onChange={(e) => setVehicleForm({ ...vehicleForm, status: e.target.value })}
                className="w-full mt-1 bg-card border border-border rounded-xl text-sm px-3 py-2 text-foreground"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVehicleModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveVehicle} className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl">
              <Save className="w-4 h-4 mr-1" /> {editingVehicle ? 'Update Vehicle' : 'Save Vehicle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route Modal */}
      <Dialog open={routeModalOpen} onOpenChange={setRouteModalOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingRoute ? 'Edit Route' : 'Create Transport Route'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Route Name *</Label>
              <Input
                value={routeForm.name}
                onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                placeholder="e.g. Route 1 - Bole & Kazanchis"
                className="rounded-xl mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Start Point *</Label>
                <Input
                  value={routeForm.startPoint}
                  onChange={(e) => setRouteForm({ ...routeForm, startPoint: e.target.value })}
                  placeholder="e.g. Bole Medhanialem"
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">End Point *</Label>
                <Input
                  value={routeForm.endPoint}
                  onChange={(e) => setRouteForm({ ...routeForm, endPoint: e.target.value })}
                  placeholder="e.g. Addis Hiwot Campus"
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Assign Vehicle</Label>
              <select
                value={routeForm.vehicleId}
                onChange={(e) => setRouteForm({ ...routeForm, vehicleId: e.target.value })}
                className="w-full mt-1 bg-card border border-border rounded-xl text-sm px-3 py-2 text-foreground"
              >
                <option value="">No Vehicle Assigned</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} ({v.model} - {v.driverName})
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Stops */}
            <div className="pt-2 border-t border-border">
              <Label className="text-xs text-muted-foreground block mb-2">Intermediate Stops</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Stop name (e.g. Atlas Hotel)"
                  value={newStopName}
                  onChange={(e) => setNewStopName(e.target.value)}
                  className="flex-1 rounded-xl text-xs"
                />
                <Input
                  placeholder="Time (07:15 AM)"
                  value={newStopTime}
                  onChange={(e) => setNewStopTime(e.target.value)}
                  className="w-28 rounded-xl text-xs"
                />
                <Button size="sm" type="button" onClick={addStopToRoute} className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs">
                  Add
                </Button>
              </div>

              {routeStops.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {routeStops.map((stop, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-secondary/40 px-3 py-1.5 rounded-xl text-xs">
                      <span>{idx + 1}. {stop.name} {stop.time && `(${stop.time})`}</span>
                      <button type="button" onClick={() => removeStop(idx)} className="text-rose-500 hover:text-rose-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRouteModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRoute} className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl">
              <Save className="w-4 h-4 mr-1" /> {editingRoute ? 'Update Route' : 'Create Route'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Student Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Assign Student to Bus Route</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Student UUID or ID *</Label>
              <Input
                value={assignForm.studentId}
                onChange={(e) => setAssignForm({ ...assignForm, studentId: e.target.value })}
                placeholder="Enter Student UUID"
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Select Route *</Label>
              <select
                value={assignForm.routeId}
                onChange={(e) => setAssignForm({ ...assignForm, routeId: e.target.value })}
                className="w-full mt-1 bg-card border border-border rounded-xl text-sm px-3 py-2 text-foreground"
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Pickup Stop</Label>
                <Input
                  value={assignForm.pickupStop}
                  onChange={(e) => setAssignForm({ ...assignForm, pickupStop: e.target.value })}
                  placeholder="e.g. Atlas Stop"
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dropoff Stop</Label>
                <Input
                  value={assignForm.dropoffStop}
                  onChange={(e) => setAssignForm({ ...assignForm, dropoffStop: e.target.value })}
                  placeholder="e.g. School Gate"
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignStudent} className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AuthGuard>
  );
}
