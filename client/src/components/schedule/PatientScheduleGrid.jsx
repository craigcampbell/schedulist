import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { format, isSameDay } from 'date-fns';
import { cn } from '../../lib/utils';
import { Undo2, Clock, AlertTriangle, Info } from 'lucide-react';
import { Button } from '../ui/button';
import ConflictModal, { findConflicts } from './ConflictModal';

// ─── Palette (matches UnifiedScheduleView exactly) ────────────────────────────
const PALETTE = [
  { solid: '#3B82F6', light: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8' },
  { solid: '#10B981', light: '#ECFDF5', border: '#6EE7B7', text: '#065F46' },
  { solid: '#F59E0B', light: '#FFFBEB', border: '#FCD34D', text: '#B45309' },
  { solid: '#8B5CF6', light: '#F5F3FF', border: '#C4B5FD', text: '#5B21B6' },
  { solid: '#EC4899', light: '#FDF2F8', border: '#F9A8D4', text: '#9D174D' },
  { solid: '#14B8A6', light: '#F0FDFA', border: '#5EEAD4', text: '#0F766E' },
  { solid: '#F97316', light: '#FFF7ED', border: '#FDBA74', text: '#C2410C' },
  { solid: '#6366F1', light: '#EEF2FF', border: '#A5B4FC', text: '#3730A3' },
];

// ─── Service type colors ───────────────────────────────────────────────────────
const SVC = {
  direct:      { bg: '#EFF6FF', border: '#3B82F6', solid: '#3B82F6', text: '#1D4ED8', label: 'Dir' },
  circle:      { bg: '#FDF2F8', border: '#EC4899', solid: '#EC4899', text: '#9D174D', label: 'Crc' },
  indirect:    { bg: '#F3F4F6', border: '#9CA3AF', solid: '#6B7280', text: '#374151', label: 'Ind' },
  supervision: { bg: '#F5F3FF', border: '#8B5CF6', solid: '#8B5CF6', text: '#5B21B6', label: 'Sup' },
  lunch:       { bg: '#ECFDF5', border: '#10B981', solid: '#10B981', text: '#065F46', label: 'Lnc' },
  cleaning:    { bg: '#FFF7ED', border: '#F97316', solid: '#F97316', text: '#C2410C', label: 'Cln' },
};

// ─── Layout constants (matches UnifiedScheduleView exactly) ───────────────────
const PX_PER_MIN  = 2.2;
const ROW_H       = 58;
const LABEL_W     = 172;
const SNAP        = 15;
const CONNECT_GAP = 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toMins = (iso) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
const snap   = (m)   => Math.round(m / SNAP) * SNAP;

function fmt12(iso) {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  const p = h >= 12 ? 'PM' : 'AM';
  const hd = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hd}:${String(m).padStart(2, '0')} ${p}`;
}

function fmtDur(iso1, iso2) {
  const mins = (new Date(iso2) - new Date(iso1)) / 60000;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), r = mins % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function parseHHMM(str, fallback) {
  if (!str) return fallback;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + (m || 0);
}

function getPatientName(patient) {
  if (!patient) return { first: '?', last: '?' };
  const first = patient.decryptedFirstName || patient.firstName || '?';
  const last  = patient.decryptedLastName  || patient.lastName  || '?';
  return { first, last };
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function PatientScheduleGrid({
  patients         = [],
  appointments     = [],
  therapists       = [],
  selectedDate,
  locations        = [],
  selectedLocation = null,
  onAppointmentClick  = () => {},
  onAppointmentUpdate = () => {},
  onGapClick          = () => {},
  onTherapistAssignment = () => {},
  userRole         = 'bcba',
  canEdit          = false,
  showOnlyUncovered = false,
}) {
  // ── Local optimistic appointment state ──
  const [localAppts,    setLocalAppts]    = useState(appointments);
  const [history,       setHistory]       = useState([]);  // [{id, startTime, endTime}]
  const [drag,          setDrag]          = useState(null);
  const [tooltip,       setTooltip]       = useState(null);
  const [conflictState, setConflictState] = useState(null);
  const trackRef = useRef(null);

  useEffect(() => setLocalAppts(appointments), [appointments]);

  // ── Today filter ──
  const todayAppts = useMemo(() =>
    localAppts.filter(a => a?.startTime && isSameDay(new Date(a.startTime), new Date(selectedDate))),
    [localAppts, selectedDate]
  );

  // ── Operating hours from location ──
  const { opStart, opEnd } = useMemo(() => {
    const loc = locations.find(l => String(l.id) === String(selectedLocation)) || locations[0];
    return {
      opStart: parseHHMM(loc?.workingHoursStart, 7 * 60 + 30),
      opEnd:   parseHHMM(loc?.workingHoursEnd,   17 * 60 + 30),
    };
  }, [locations, selectedLocation]);

  // ── Grid bounds: fixed to op hours, expand if appointments overflow ──
  const { gsMin, geMin } = useMemo(() => {
    if (!todayAppts.length) return { gsMin: opStart, geMin: opEnd };
    const mins = todayAppts.flatMap(a => [toMins(a.startTime), toMins(a.endTime)]);
    return {
      gsMin: Math.min(opStart, Math.min(...mins) - 15),
      geMin: Math.max(opEnd,   Math.max(...mins) + 15),
    };
  }, [todayAppts, opStart, opEnd]);

  const gridW = (geMin - gsMin) * PX_PER_MIN;

  // ── Assign patient colors (sorted by name for stability) ──
  const colorOf = useMemo(() => {
    const m = {};
    [...patients]
      .sort((a, b) => {
        const na = getPatientName(a);
        const nb = getPatientName(b);
        return na.first.localeCompare(nb.first);
      })
      .forEach((p, i) => { m[p.id] = PALETTE[i % PALETTE.length]; });
    return m;
  }, [patients]);

  // ── Build patient rows from today's appointments ──
  const allRows = useMemo(() => {
    // Index appointments by patientId
    const map = {};
    todayAppts.forEach(a => {
      const pid = a.patientId || a.patient?.id;
      if (!pid) return;
      if (!map[pid]) {
        // Prefer the full patient object from the patients prop
        const fullPatient = patients.find(p => String(p.id) === String(pid));
        const apptPatient = a.patient || {};
        map[pid] = {
          patient: fullPatient || apptPatient,
          appts:   [],
        };
      }
      map[pid].appts.push(a);
    });

    return Object.values(map).map(({ patient, appts }) => {
      const sorted = [...appts].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      const color  = colorOf[patient.id] || PALETTE[0];

      // Coverage stats: direct + circle count as "therapy hours"
      const therapyAppts = sorted.filter(a => a.serviceType === 'direct' || a.serviceType === 'circle');
      const hrs = therapyAppts.reduce((s, a) =>
        s + (new Date(a.endTime) - new Date(a.startTime)) / 3.6e6, 0);
      const target = ((patient.requiredWeeklyHours || patient.approvedHours || 0) / 5);
      const pct    = target > 0 ? Math.min(100, (hrs / target) * 100) : null;

      return { patient, appts: sorted, color, hrs, target, pct };
    });
  }, [todayAppts, patients, colorOf]);

  // ── Apply showOnlyUncovered filter ──
  const rows = useMemo(() => {
    if (!showOnlyUncovered) return allRows;
    return allRows.filter(r => r.pct === null || r.pct < 100);
  }, [allRows, showOnlyUncovered]);

  // ── Hour markers ──
  const hourMarks = useMemo(() => {
    const marks = [];
    for (let h = Math.floor(gsMin / 60); h <= Math.ceil(geMin / 60); h++) {
      const x = (h * 60 - gsMin) * PX_PER_MIN;
      const p = h >= 12 ? 'PM' : 'AM';
      const d = h === 0 ? 12 : h > 12 ? h - 12 : h;
      marks.push({ x, label: `${d}${p}`, isHalf: false, isNoon: h === 12 });
      const xh = ((h + 0.5) * 60 - gsMin) * PX_PER_MIN;
      if (xh > 0 && xh < gridW) marks.push({ x: xh, label: '', isHalf: true, isNoon: false });
    }
    return marks;
  }, [gsMin, geMin, gridW]);

  // ── Appointment pixel layout ──
  const layout = useCallback((a) => {
    const s = toMins(a.startTime), e = toMins(a.endTime);
    return {
      x: (s - gsMin) * PX_PER_MIN,
      w: Math.max((e - s) * PX_PER_MIN, 6),
    };
  }, [gsMin]);

  const isConsecutive = (a, b) =>
    Math.abs(toMins(b.startTime) - toMins(a.endTime)) <= CONNECT_GAP;

  // ── Coverage stats header ──
  const stats = useMemo(() => {
    const data = allRows.map(({ patient, hrs, target, pct, color }) => ({
      patient, hrs, target, pct, color,
    }));
    const totalHrs    = data.reduce((s, d) => s + d.hrs, 0);
    const totalTarget = data.reduce((s, d) => s + d.target, 0);
    const overall     = totalTarget > 0 ? Math.min(100, (totalHrs / totalTarget) * 100) : null;
    return { data, totalHrs, totalTarget, overall };
  }, [allRows]);

  // ── Drag handlers ──
  const onMouseMove = useCallback((e) => {
    if (!drag) return;
    const dx = e.clientX - drag.mouseX0;
    const dm = snap(dx / PX_PER_MIN);

    setLocalAppts(prev => prev.map(a => {
      if (a.id !== drag.id) return a;
      const base = new Date(a.startTime);

      if (drag.type === 'move') {
        const ns = Math.max(gsMin, drag.s0 + dm);
        const dur = drag.e0 - drag.s0;
        const ne  = ns + dur;
        const d1  = new Date(base); d1.setHours(Math.floor(ns / 60), ns % 60, 0, 0);
        const d2  = new Date(base); d2.setHours(Math.floor(ne / 60), ne % 60, 0, 0);
        setTooltip({ text: `${fmt12(d1.toISOString())} – ${fmt12(d2.toISOString())}` });
        return { ...a, startTime: d1.toISOString(), endTime: d2.toISOString() };
      } else {
        const ne = Math.max(drag.s0 + SNAP, drag.e0 + dm);
        const d  = new Date(base); d.setHours(Math.floor(ne / 60), ne % 60, 0, 0);
        setTooltip({ text: `End: ${fmt12(d.toISOString())} (${fmtDur(a.startTime, d.toISOString())})` });
        return { ...a, endTime: d.toISOString() };
      }
    }));
  }, [drag, gsMin]);

  const onMouseUp = useCallback(() => {
    if (!drag) return;
    const updated = localAppts.find(a => a.id === drag.id);
    if (updated && (updated.startTime !== drag.origStart || updated.endTime !== drag.origEnd)) {
      const conflicts = findConflicts(updated, localAppts);
      if (conflicts.length > 0) {
        setLocalAppts(prev => prev.map(a =>
          a.id === drag.id ? { ...a, startTime: drag.origStart, endTime: drag.origEnd } : a
        ));
        setConflictState({
          movedAppt: updated,
          conflicts,
          originalTimes: { startTime: drag.origStart, endTime: drag.origEnd },
        });
      } else {
        setHistory(h => [...h.slice(-19), { id: drag.id, startTime: drag.origStart, endTime: drag.origEnd }]);
        onAppointmentUpdate(updated);
      }
    }
    setDrag(null);
    setTooltip(null);
  }, [drag, localAppts, onAppointmentUpdate]);

  useEffect(() => {
    if (!drag) return;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',  onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',  onMouseUp);
    };
  }, [drag, onMouseMove, onMouseUp]);

  const beginDrag = (e, appt, type) => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    setDrag({
      type,
      id:        appt.id,
      mouseX0:   e.clientX,
      s0:        toMins(appt.startTime),
      e0:        toMins(appt.endTime),
      origStart: appt.startTime,
      origEnd:   appt.endTime,
    });
  };

  // ── Undo ──
  const undo = () => {
    if (!history.length) return;
    const last = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    const full = localAppts.find(a => a.id === last.id);
    setLocalAppts(prev => prev.map(a =>
      a.id === last.id ? { ...a, startTime: last.startTime, endTime: last.endTime } : a
    ));
    if (full) onAppointmentUpdate({ ...full, startTime: last.startTime, endTime: last.endTime });
  };

  // ─── Empty state ─────────────────────────────────────────────────────────────
  if (!todayAppts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
        <Clock className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">
          No appointments scheduled for {format(new Date(selectedDate), 'EEEE, MMMM d')}
        </p>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 select-none">

      {/* ── Today's Coverage header ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-base">
              Today's Coverage
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {stats.data.length} patient{stats.data.length !== 1 ? 's' : ''} · {stats.totalHrs.toFixed(1)}h of {stats.totalTarget.toFixed(1)}h daily target
            </p>
          </div>
          {stats.overall !== null && (
            <div className="flex flex-col items-end">
              <span className={cn(
                "text-3xl font-bold tabular-nums",
                stats.overall >= 85 ? "text-emerald-600" :
                stats.overall >= 60 ? "text-amber-500"  : "text-red-500"
              )}>
                {Math.round(stats.overall)}%
              </span>
              <span className="text-xs text-gray-400">overall continuity</span>
            </div>
          )}
        </div>

        {/* Per-patient coverage bars */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
          {stats.data.map(({ patient, hrs, target, pct, color }) => {
            const { first, last } = getPatientName(patient);
            return (
              <div key={patient.id} className="flex items-center gap-2.5 min-w-0">
                {/* Patient avatar */}
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: color.solid }}
                >
                  {first[0]}{last[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-medium truncate text-gray-700 dark:text-gray-300">
                      {first} {last[0]}.
                    </span>
                    <span className="text-xs text-gray-400 ml-1 flex-shrink-0">
                      {hrs.toFixed(1)}h{target ? `/${target.toFixed(1)}h` : ''}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    {pct !== null ? (
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 85 ? '#10B981' : pct >= 60 ? '#F59E0B' : color.solid,
                        }}
                      />
                    ) : (
                      <div
                        className="h-full rounded-full w-full"
                        style={{ background: color.solid, opacity: 0.3 }}
                      />
                    )}
                  </div>
                  {/* Uncovered warning */}
                  {pct !== null && pct < 60 && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <AlertTriangle className="h-2.5 w-2.5 text-red-400 flex-shrink-0" />
                      <span className="text-[10px] text-red-500 truncate">
                        {Math.round(pct)}% covered
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Patient Timeline section ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

        {/* Title + filter notice + undo */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {format(new Date(selectedDate), 'EEEE, MMMM d')} — Patient Timeline
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {canEdit
                ? 'Drag to reschedule · Drag right edge to resize'
                : 'Click an appointment to view details'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showOnlyUncovered && (
              <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-full px-2.5 py-1">
                <Info className="h-3 w-3 flex-shrink-0" />
                <span>Incomplete coverage only</span>
              </div>
            )}
            {history.length > 0 && (
              <Button variant="outline" size="sm" onClick={undo} className="flex items-center gap-1.5 text-xs">
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </Button>
            )}
          </div>
        </div>

        {/* No rows after filter */}
        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
            <p className="text-sm font-medium">All patients have 100% coverage today.</p>
          </div>
        )}

        {/* Drag tooltip */}
        {tooltip && (
          <div className="sticky top-0 z-50 flex justify-center pointer-events-none">
            <div className="bg-gray-900/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg mt-1">
              {tooltip.text}
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto" ref={trackRef}>
            <div className="relative" style={{ minWidth: LABEL_W + gridW + 32 }}>

              {/* ── Time header ──────────────────────────────────────────── */}
              <div className="flex sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                {/* "Patient" label column header */}
                <div
                  style={{ width: LABEL_W, flexShrink: 0, height: 36 }}
                  className="px-4 flex items-center text-xs font-medium text-gray-400 dark:text-gray-500 border-r border-gray-100 dark:border-gray-700"
                >
                  Patient
                </div>
                <div className="relative flex-1" style={{ height: 36 }}>
                  {/* Out-of-hours shading in header */}
                  {gsMin < opStart && (
                    <div
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{ left: 0, width: (opStart - gsMin) * PX_PER_MIN, background: 'rgba(0,0,0,0.04)' }}
                    />
                  )}
                  {geMin > opEnd && (
                    <div
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{ left: (opEnd - gsMin) * PX_PER_MIN, right: 0, background: 'rgba(0,0,0,0.04)' }}
                    />
                  )}
                  {hourMarks.map((m, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 flex flex-col justify-center"
                      style={{ left: m.x }}
                    >
                      {m.isHalf ? (
                        <div className="w-px h-2 bg-gray-200 dark:bg-gray-600 -translate-x-px" />
                      ) : (
                        <span className={cn(
                          "text-[11px] font-medium px-0.5 -translate-x-1/2",
                          m.isNoon ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
                        )}>
                          {m.label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Patient rows ─────────────────────────────────────────── */}
              {rows.map(({ patient, appts, color, hrs, target, pct }, rowIdx) => {
                const { first, last } = getPatientName(patient);
                return (
                  <div
                    key={patient.id}
                    className={cn(
                      "flex border-b border-gray-50 dark:border-gray-700/40",
                      rowIdx % 2 === 1 && "bg-gray-50/40 dark:bg-gray-800/60"
                    )}
                    style={{ height: ROW_H }}
                  >
                    {/* ── Patient label ── */}
                    <div
                      style={{ width: LABEL_W, flexShrink: 0 }}
                      className="px-3 flex items-center gap-2.5 border-r border-gray-100 dark:border-gray-700 shrink-0"
                    >
                      {/* Avatar circle */}
                      <div
                        className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
                        style={{ background: color.solid }}
                      >
                        {first[0]}{last[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">
                          {first} {last}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                          {appts.length} session{appts.length !== 1 ? 's' : ''}
                          {target > 0 && (
                            <span className={cn(
                              "ml-1",
                              pct !== null && pct < 60 ? "text-red-400" :
                              pct !== null && pct < 85 ? "text-amber-400" : "text-emerald-500"
                            )}>
                              · {hrs.toFixed(1)}/{target.toFixed(1)}h
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── Timeline track ── */}
                    <div className="relative flex-1" style={{ height: ROW_H }}>

                      {/* Out-of-hours hatching (before operating window) */}
                      {gsMin < opStart && (
                        <div
                          className="absolute top-0 bottom-0 pointer-events-none"
                          style={{
                            left: 0,
                            width: (opStart - gsMin) * PX_PER_MIN,
                            background: 'repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 10px)',
                            backgroundColor: 'rgba(0,0,0,0.04)',
                          }}
                        />
                      )}
                      {/* Out-of-hours hatching (after operating window) */}
                      {geMin > opEnd && (
                        <div
                          className="absolute top-0 bottom-0 pointer-events-none"
                          style={{
                            left: (opEnd - gsMin) * PX_PER_MIN,
                            right: 0,
                            background: 'repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 10px)',
                            backgroundColor: 'rgba(0,0,0,0.04)',
                          }}
                        />
                      )}

                      {/* Hour grid lines */}
                      {hourMarks.filter(m => !m.isHalf).map((m, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-l border-gray-100 dark:border-gray-700/40"
                          style={{ left: m.x }}
                        />
                      ))}

                      {/* Subway track line */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                        style={{
                          left: 0, right: 0, height: 3,
                          background: color.border,
                          opacity: 0.35,
                        }}
                      />

                      {/* Appointment blocks */}
                      {appts.map((appt, idx) => {
                        const { x, w } = layout(appt);
                        const prev = appts[idx - 1];
                        const next = appts[idx + 1];
                        const fromPrev   = prev && isConsecutive(prev, appt);
                        const toNext     = next && isConsecutive(appt, next);
                        const isDragging = drag?.id === appt.id;

                        // Block color: service-type override or patient palette
                        const svc = SVC[appt.serviceType];
                        const blockColor = svc
                          ? { light: svc.bg, border: svc.border, solid: svc.solid, text: svc.text }
                          : { light: color.light, border: color.border, solid: color.solid, text: color.text };

                        // Therapist initials
                        const th = appt.therapist;
                        const therapistInitials = th
                          ? `${th.firstName?.[0] || ''}${th.lastName?.[0] || ''}`
                          : '?';

                        // Connected-capsule border radius
                        const rOuter = '999px';
                        const rInner = '5px';
                        const borderRadius = [
                          fromPrev ? rInner : rOuter,
                          toNext   ? rInner : rOuter,
                          toNext   ? rInner : rOuter,
                          fromPrev ? rInner : rOuter,
                        ].join(' ');

                        const ml = fromPrev ? 1 : 0;
                        const mr = toNext   ? 1 : 0;

                        return (
                          <div
                            key={appt.id}
                            className={cn(
                              "absolute flex items-center overflow-visible",
                              canEdit && (isDragging
                                ? "cursor-grabbing z-30 shadow-xl"
                                : "cursor-grab z-10 hover:z-20 hover:shadow-md"),
                              !canEdit && "cursor-pointer z-10 hover:z-20 hover:shadow-md"
                            )}
                            style={{
                              top: 9, bottom: 9,
                              left: x + ml,
                              width: Math.max(w - ml - mr, 6),
                              background:   blockColor.light,
                              border:       `2px solid ${blockColor.border}`,
                              borderRadius,
                              opacity: isDragging ? 0.75 : 1,
                              boxShadow: isDragging
                                ? `0 8px 24px ${blockColor.solid}40`
                                : `0 1px 3px ${blockColor.solid}20`,
                              transition: isDragging ? 'none' : 'box-shadow 0.15s, opacity 0.1s',
                            }}
                            onMouseDown={canEdit ? (e) => beginDrag(e, appt, 'move') : undefined}
                            onClick={() => !drag && onAppointmentClick(appt)}
                            title={`${fmt12(appt.startTime)} – ${fmt12(appt.endTime)} · ${appt.serviceType}${th ? ` · ${th.firstName} ${th.lastName}` : ' · unassigned'}`}
                          >
                            {/* Therapist initials badge */}
                            {w > 28 && (
                              <div
                                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ml-1.5"
                                style={{ background: blockColor.border, color: '#fff' }}
                              >
                                {therapistInitials}
                              </div>
                            )}

                            {/* Service type label + duration */}
                            {w > 52 && (
                              <div
                                className="flex-1 px-1.5 min-w-0 leading-tight"
                                style={{ color: blockColor.text }}
                              >
                                <div className="text-[11px] font-semibold truncate">
                                  {svc ? svc.label : therapistInitials}
                                </div>
                                {w > 90 && (
                                  <div className="text-[10px] opacity-70 truncate">
                                    {fmtDur(appt.startTime, appt.endTime)}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Resize handle — only when canEdit */}
                            {canEdit && (
                              <div
                                className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center cursor-ew-resize group/rz flex-shrink-0 rounded-r-full"
                                onMouseDown={(e) => { e.stopPropagation(); beginDrag(e, appt, 'resize'); }}
                                title="Drag to resize"
                              >
                                <div
                                  className="w-0.5 h-4 rounded-full opacity-0 group-hover/rz:opacity-50 transition-opacity"
                                  style={{ background: blockColor.text }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Bottom padding */}
              <div className="h-2" />
            </div>
          </div>
        )}

        {/* Legend */}
        {rows.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500">
            {canEdit && (
              <>
                <span>drag block to move</span>
                <span>drag right edge to resize</span>
              </>
            )}
            <span>click to view details</span>
            {/* Service type key */}
            {Object.entries(SVC).map(([key, s]) => (
              <span key={key} className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm border"
                  style={{ background: s.bg, borderColor: s.border }}
                />
                {s.label}
              </span>
            ))}
            {history.length > 0 && (
              <span
                className="text-blue-500 cursor-pointer hover:underline"
                onClick={undo}
              >
                undo last change
              </span>
            )}
          </div>
        )}
      </div>

      {conflictState && (
        <ConflictModal
          movedAppt={conflictState.movedAppt}
          originalTimes={conflictState.originalTimes}
          conflicts={conflictState.conflicts}
          allTodayAppts={todayAppts}
          opStart={opStart}
          opEnd={opEnd}
          therapists={therapists}
          patients={patients}
          onConfirm={(resolvedAppts) => {
            setLocalAppts(prev => {
              let next = [...prev];
              for (const a of resolvedAppts) next = next.map(x => x.id === a.id ? a : x);
              return next;
            });
            for (const appt of resolvedAppts) onAppointmentUpdate(appt);
            setConflictState(null);
          }}
          onCancel={() => setConflictState(null)}
        />
      )}
    </div>
  );
}
