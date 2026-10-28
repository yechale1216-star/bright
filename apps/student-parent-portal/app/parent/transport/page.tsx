'use client';

import React, { useState, useEffect } from 'react';
import {
  Bus,
  MapPin,
  Clock,
  Phone,
  User,
  ShieldCheck,
  Navigation,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import {
  transportClientService,
  StudentTransportAssignment,
} from '@/lib/facilities-service';
import { Button } from '@/components/ui/button';

export default function ParentTransportPage() {
  const [assignments, setAssignments] = useState<StudentTransportAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState('');

  useEffect(() => {
    const sid = localStorage.getItem('parent_selected_student_id') || '';
    setStudentId(sid);
    if (sid) loadTransport(sid);

    const handleStudentChange = () => {
      const newSid = localStorage.getItem('parent_selected_student_id') || '';
      setStudentId(newSid);
      if (newSid) loadTransport(newSid);
    };

    window.addEventListener('studentChanged', handleStudentChange);
    return () => window.removeEventListener('studentChanged', handleStudentChange);
  }, []);

  const loadTransport = async (sid: string) => {
    setLoading(true);
    try {
      const data = await transportClientService.getStudentTransport(sid);
      setAssignments(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Bus className="w-7 h-7" />
            </div>
            School Transport & Bus
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Assigned school bus route, stops schedule, and driver contact.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !studentId ? (
        <div className="text-center py-16 bg-card border border-border/70 rounded-2xl text-muted-foreground">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 text-amber-500 opacity-60" />
          <p className="font-semibold text-foreground">No Student Selected</p>
          <p className="text-xs mt-1">Please select a student from the top bar to view transport details.</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/70 rounded-2xl text-muted-foreground">
          <Bus className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="font-semibold text-foreground">No Bus Route Assigned</p>
          <p className="text-xs mt-1">
            This student is currently not registered on a school bus route. Contact the school administration to enroll in transport services.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {assignments.map((assignment) => {
            const route = assignment.route;
            const vehicle = route?.vehicle;
            const stops = Array.isArray(route?.stops) ? route.stops : [];

            return (
              <div
                key={assignment.id}
                className="bg-card border border-border/80 rounded-3xl p-6 shadow-sm space-y-5"
              >
                {/* Route Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-2">
                      <ShieldCheck className="w-3.5 h-3.5" /> Assigned Route
                    </span>
                    <h2 className="text-xl font-extrabold text-foreground">{route?.name}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-500">
                      Active
                    </span>
                  </div>
                </div>

                {/* Pickup & Dropoff Stops */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60">
                    <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1.5">
                      <MapPin className="w-4 h-4 text-emerald-500" /> Designated Pickup Stop
                    </span>
                    <p className="text-base font-bold text-foreground">
                      {assignment.pickupStop || route?.startPoint || 'Primary Start Point'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60">
                    <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1.5">
                      <MapPin className="w-4 h-4 text-rose-500" /> Designated Dropoff Stop
                    </span>
                    <p className="text-base font-bold text-foreground">
                      {assignment.dropoffStop || route?.endPoint || 'School Campus'}
                    </p>
                  </div>
                </div>

                {/* Vehicle & Driver Card */}
                {vehicle && (
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/5 to-amber-500/10 border border-amber-500/20">
                    <h3 className="text-xs font-extrabold text-amber-500 uppercase tracking-wider mb-3">
                      Bus & Driver Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">Vehicle Plate</span>
                        <span className="text-base font-extrabold text-foreground">{vehicle.plateNumber}</span>
                        <span className="text-xs text-muted-foreground block">{vehicle.model}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">Driver Name</span>
                        <span className="text-base font-bold text-foreground">{vehicle.driverName}</span>
                      </div>
                      <div className="flex items-center sm:justify-end">
                        <a
                          href={`tel:${vehicle.driverPhone}`}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition-all active:scale-95"
                        >
                          <Phone className="w-4 h-4" /> Call Driver ({vehicle.driverPhone})
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Route Stops Timeline */}
                {stops.length > 0 && (
                  <div>
                    <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-500" /> Route Stops & Schedule
                    </h3>
                    <div className="space-y-2 relative pl-4 border-l-2 border-border ml-2">
                      {stops.map((stop: any, idx: number) => (
                        <div key={idx} className="relative flex items-center justify-between py-1">
                          <div className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-background" />
                          <span className="text-sm font-semibold text-foreground">{stop.name}</span>
                          {stop.time && (
                            <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                              {stop.time}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
