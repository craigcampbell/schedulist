import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Zap, X, AlertTriangle, CheckCircle, ArrowRight, Move } from 'lucide-react';
import { Button } from '../ui/button';

// ─── Layout constants (mirrors view files) ────────────────────────────────────
const PX_PER_MIN  = 2.2;
const SNAP        = 15;
const LABEL_W     = 160;
const MINI_ROW_H  = 48;

const SVC = {
  direct:      { bg: '#EFF6FF', border: '#3B82F6', solid: '#3B82F6', text: '#1D4ED8', label: 'Direct' },
  circle:      { bg: '#FDF2F8', border: '#EC4899', solid: '#EC4899', text: '#9D174D', label: 'Circle' },
  indirect:    { bg: '#F3F4F6', border: '#9CA3AF', solid: '#6B7280', text: '#374151', label: 'Indirect' },
  supervision: { bg: '#F5F3FF', border: '#8B5CF6', solid: '#8B5CF6', text: '#5B21B6', label: 'Supervision' },
  lunch:       { bg: '#ECFDF5', border: '#10B981', solid: '#10B981', text: '#065F46', label: 'Lunch' },
  cleaning:    { bg: '#FFF7ED', border: '#F97316', solid: '#F97316', text: '#C2410C', label: 'Cleaning' },
};
const SVC_DEF = SVC.direct;

// ─── Pure helpers ──────────────────────────────────────────────────────────────
const toMins   = (iso) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
const snapM    = (m)   => Math.round(m / SNAP) * SNAP;
const applyMin = (iso, mins) => {
  const d = new Date(iso);
  const base = new Date(d);
  base.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return base.toISOString();
};

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

function svc(serviceType) { return SVC[serviceType] || SVC_DEF; }

// ─── Conflict detection ───────────────────────────────────────────────────────
export function findConflicts(movedAppt, allAppts) {
  const mS = new Date(movedAppt.startTime).getTime();
  const mE = new Date(movedAppt.endTime).getTime();
  return allAppts.filter(a => {
    if (a.id === movedAppt.id) return false;
    if (['cancelled', 'no-show'].includes(a.status)) return false;
    const aS = new Date(a.startTime).getTime();
    const aE = new Date(a.endTime).getTime();
    if (!(aS < mE && aE > mS)) return false;
    const sameTherapist = a.therapistId && movedAppt.therapistId && a.therapistId === movedAppt.therapistId;
    const samePatient   = a.patientId   && movedAppt.patientId   && a.patientId   === movedAppt.patientId;
    return sameTherapist || samePatient;
  });
}

// ─── Auto-schedule ────────────────────────────────────────────────────────────
export function autoScheduleConflicts(movedAppt, conflicts, allAppts, opStart, opEnd) {
  const dur = (iso1, iso2) => (new Date(iso2) - new Date(iso1)) / 60000;

  // Build a sorted list of occupied slots for each entity on this day
  const occupiedFor = (id, field) =>
    allAppts
      .filter(a => a[field] === id && a.id !== movedAppt.id && !['cancelled','no-show'].includes(a.status))
      .map(a => ({ s: toMins(a.startTime), e: toMins(a.endTime) }))
      .sort((a, b) => a.s - b.s);

  const findSlot = (conflict, durationMins) => {
    const therapistSlots = conflict.therapistId ? occupiedFor(conflict.therapistId, 'therapistId') : [];
    const patientSlots   = conflict.patientId   ? occupiedFor(conflict.patientId,   'patientId')   : [];
    const movedS = toMins(movedAppt.startTime);
    const movedE = toMins(movedAppt.endTime);

    // Add movedAppt as occupied (can't place conflict there)
    const combined = [...therapistSlots, ...patientSlots, { s: movedS, e: movedE }]
      .sort((a, b) => a.s - b.s);

    // Try after the moved appointment first, then before
    const candidates = [];
    // After movedAppt
    let t = snapM(movedE);
    for (let i = 0; i < 48; i++) {
      const slotEnd = t + durationMins;
      if (slotEnd > opEnd) break;
      const blocked = combined.some(o => o.s < slotEnd && o.e > t);
      if (!blocked) { candidates.push(t); break; }
      t = snapM(combined.filter(o => o.e > t).reduce((min, o) => Math.min(min, o.e), t + SNAP));
    }
    // Before movedAppt (from opStart)
    if (!candidates.length) {
      t = snapM(opStart);
      while (t + durationMins <= movedS) {
        const slotEnd = t + durationMins;
        const blocked = combined.some(o => o.s < slotEnd && o.e > t);
        if (!blocked) { candidates.push(t); break; }
        t = snapM(combined.filter(o => o.e > t).reduce((min, o) => Math.min(min, o.e), t + SNAP));
      }
    }
    return candidates[0] ?? null;
  };

  return conflicts.map(conflict => {
    const dMins = dur(conflict.startTime, conflict.endTime);
    const newStart = findSlot(conflict, dMins);
    if (newStart === null) return { ...conflict, autoFailed: true };
    return {
      ...conflict,
      startTime: applyMin(conflict.startTime, newStart),
      endTime:   applyMin(conflict.endTime, newStart + dMins),
      autoMoved: true,
    };
  });
}

// ─── Mini timeline row ────────────────────────────────────────────────────────
function MiniRow({ label, labelColor, rowAppts, gsMin, geMin, gridW, draggableIds, onDragConflict }) {
  const [localAppts, setLocalAppts] = useState(rowAppts);
  const [drag, setDrag] = useState(null);
  const trackRef = useRef(null);

  useEffect(() => setLocalAppts(rowAppts), [rowAppts]);

  const onMouseMove = useCallback((e) => {
    if (!drag) return;
    const dx = e.clientX - drag.mouseX0;
    const dMins = snapM(dx / PX_PER_MIN);
    const newS = Math.max(gsMin, Math.min(geMin - (drag.e0 - drag.s0), drag.s0 + dMins));
    const dur = drag.e0 - drag.s0;
    setLocalAppts(prev => prev.map(a =>
      a.id === drag.id
        ? { ...a, startTime: applyMin(a.startTime, newS), endTime: applyMin(a.endTime, newS + dur) }
        : a
    ));
  }, [drag, gsMin, geMin]);

  const onMouseUp = useCallback(() => {
    if (!drag) return;
    const updated = localAppts.find(a => a.id === drag.id);
    if (updated) onDragConflict(updated);
    setDrag(null);
  }, [drag, localAppts, onDragConflict]);

  useEffect(() => {
    if (!drag) return;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',  onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',  onMouseUp);
    };
  }, [drag, onMouseMove, onMouseUp]);

  const hourMarks = useMemo(() => {
    const marks = [];
    for (let h = Math.floor(gsMin / 60); h <= Math.ceil(geMin / 60); h++) {
      const x = (h * 60 - gsMin) * PX_PER_MIN;
      if (x < 0 || x > gridW) continue;
      const p = h >= 12 ? 'PM' : 'AM';
      const hd = h === 0 ? 12 : h > 12 ? h - 12 : h;
      marks.push({ x, label: `${hd}${p}` });
    }
    return marks;
  }, [gsMin, geMin, gridW]);

  return (
    <div className="flex" style={{ height: MINI_ROW_H + 20 }}>
      {/* Label */}
      <div
        className="flex-shrink-0 flex items-center px-2 text-xs font-semibold rounded-l"
        style={{ width: LABEL_W, borderLeft: `3px solid ${labelColor}`, background: '#F9FAFB' }}
      >
        <span className="truncate">{label}</span>
      </div>

      {/* Track */}
      <div className="relative flex-1 overflow-hidden" style={{ minWidth: gridW }}>
        {/* Hour ticks */}
        <div className="absolute inset-0 pointer-events-none" style={{ height: 16 }}>
          {hourMarks.map(m => (
            <div key={m.x} className="absolute top-0 flex flex-col items-center" style={{ left: m.x }}>
              <div className="text-[10px] text-gray-400 leading-none">{m.label}</div>
              <div className="w-px bg-gray-200" style={{ height: MINI_ROW_H + 4 }} />
            </div>
          ))}
        </div>
        {/* Appointments */}
        <div ref={trackRef} className="absolute" style={{ top: 16, left: 0, right: 0, height: MINI_ROW_H }}>
          {localAppts.map(appt => {
            const s = svc(appt.serviceType);
            const left = (toMins(appt.startTime) - gsMin) * PX_PER_MIN;
            const width = Math.max(20, (toMins(appt.endTime) - toMins(appt.startTime)) * PX_PER_MIN);
            const isDraggable = draggableIds.has(appt.id);
            const isFixed = !isDraggable;
            return (
              <div
                key={appt.id}
                className="absolute top-1 flex items-center px-2 overflow-hidden select-none rounded-full"
                style={{
                  left,
                  width,
                  height: MINI_ROW_H - 8,
                  background: s.bg,
                  border: `2px solid ${s.border}`,
                  cursor: isDraggable ? 'grab' : 'default',
                  opacity: isFixed ? 0.75 : 1,
                  zIndex: isDraggable ? 10 : 5,
                  boxShadow: isDraggable ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                }}
                onMouseDown={isDraggable ? (e) => {
                  e.preventDefault();
                  setDrag({
                    id: appt.id,
                    mouseX0: e.clientX,
                    s0: toMins(appt.startTime),
                    e0: toMins(appt.endTime),
                  });
                } : undefined}
              >
                {isFixed && (
                  <div className="w-4 h-4 rounded-full flex-shrink-0 mr-1 flex items-center justify-center"
                    style={{ background: '#3B82F6' }}>
                    <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>✦</span>
                  </div>
                )}
                {isDraggable && (
                  <Move size={10} className="flex-shrink-0 mr-1" style={{ color: s.text }} />
                )}
                <span className="truncate text-[10px] font-semibold" style={{ color: s.text }}>
                  {fmt12(appt.startTime)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main ConflictModal ───────────────────────────────────────────────────────
export default function ConflictModal({
  movedAppt,
  originalTimes,
  conflicts,
  allTodayAppts = [],
  opStart = 7 * 60 + 30,
  opEnd   = 17 * 60 + 30,
  therapists = [],
  patients   = [],
  onConfirm,
  onCancel,
}) {
  const [resolvedConflicts, setResolvedConflicts] = useState(conflicts);
  const [autoApplied, setAutoApplied] = useState(false);
  const [confirmingFinal, setConfirmingFinal] = useState(false);
  const backdropRef = useRef(null);

  // Grid bounds: op hours ± any overflow
  const { gsMin, geMin, gridW } = useMemo(() => {
    const allAppts = [movedAppt, ...resolvedConflicts];
    const minStart = allAppts.reduce((m, a) => Math.min(m, toMins(a.startTime)), opStart);
    const maxEnd   = allAppts.reduce((m, a) => Math.max(m, toMins(a.endTime)),   opEnd);
    const gs = Math.max(0, Math.floor(minStart / 30) * 30 - 30);
    const ge = Math.min(24 * 60, Math.ceil(maxEnd / 30) * 30 + 30);
    return { gsMin: gs, geMin: ge, gridW: (ge - gs) * PX_PER_MIN };
  }, [movedAppt, resolvedConflicts, opStart, opEnd]);

  // Group rows by therapist/patient
  const rows = useMemo(() => {
    const rowMap = new Map();
    const allAppts = [movedAppt, ...resolvedConflicts];

    for (const appt of allAppts) {
      const key = `therapist-${appt.therapistId}`;
      if (!rowMap.has(key)) {
        const therapist = therapists.find(t => t.id === appt.therapistId);
        const name = therapist
          ? `${therapist.firstName} ${therapist.lastName}`
          : appt.therapistName || `Therapist ${appt.therapistId?.slice(0,6) || '?'}`;
        rowMap.set(key, { label: name, color: '#3B82F6', appts: [] });
      }
      rowMap.get(key).appts.push(appt);
    }

    // Also include background appointments for context
    for (const appt of allTodayAppts) {
      const key = `therapist-${appt.therapistId}`;
      if (rowMap.has(key) && !rowMap.get(key).appts.find(a => a.id === appt.id)) {
        rowMap.get(key).appts.push(appt);
      }
    }

    return Array.from(rowMap.entries()).map(([, row]) => row);
  }, [movedAppt, resolvedConflicts, allTodayAppts, therapists]);

  const draggableIds = useMemo(() => new Set(resolvedConflicts.map(c => c.id)), [resolvedConflicts]);

  const handleDragConflict = useCallback((updatedAppt) => {
    setResolvedConflicts(prev => prev.map(c => c.id === updatedAppt.id ? updatedAppt : c));
    setAutoApplied(false);
  }, []);

  // Check if any conflicts remain after drag resolution
  const remainingConflicts = useMemo(() => {
    const all = [movedAppt, ...resolvedConflicts, ...allTodayAppts.filter(a => a.id !== movedAppt.id && !resolvedConflicts.find(c => c.id === a.id))];
    return resolvedConflicts.filter(c => findConflicts(c, all.filter(a => a.id !== c.id)).length > 0);
  }, [movedAppt, resolvedConflicts, allTodayAppts]);

  const hasUnresolvedConflicts = remainingConflicts.length > 0;

  const handleAutoSchedule = () => {
    const scheduled = autoScheduleConflicts(movedAppt, conflicts, allTodayAppts, opStart, opEnd);
    setResolvedConflicts(scheduled);
    setAutoApplied(true);
  };

  const handleConfirm = () => {
    if (hasUnresolvedConflicts) {
      setConfirmingFinal(true);
    } else {
      doConfirm();
    }
  };

  const doConfirm = () => {
    const allChanged = [movedAppt, ...resolvedConflicts];
    onConfirm(allChanged);
  };

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) onCancel();
  };

  // ── What needs to change summary ──
  const changeSummary = useMemo(() => {
    const lines = [];
    const therapistName = (id) => {
      const t = therapists.find(t => t.id === id);
      return t ? `${t.firstName} ${t.lastName}` : 'Unknown therapist';
    };
    const patientName = (id) => {
      const p = patients.find(p => p.id === id);
      return p ? `${p.firstName} ${p.lastInitial || ''}` : 'Unknown patient';
    };

    lines.push({
      type: 'move',
      text: `Move ${movedAppt.serviceType || 'appointment'} to ${fmt12(movedAppt.startTime)}–${fmt12(movedAppt.endTime)}`,
    });

    for (const c of resolvedConflicts) {
      const who = c.therapistId ? therapistName(c.therapistId) : patientName(c.patientId);
      const orig = conflicts.find(o => o.id === c.id);
      const wasAt = orig ? `was ${fmt12(orig.startTime)}–${fmt12(orig.endTime)}` : '';
      const nowAt = `now ${fmt12(c.startTime)}–${fmt12(c.endTime)}`;
      lines.push({
        type: c.autoFailed ? 'failed' : 'reschedule',
        text: c.autoFailed
          ? `⚠ Could not reschedule ${who}'s ${c.serviceType || 'appointment'} — no open slot found`
          : `Reschedule ${who}'s ${c.serviceType || 'appointment'} (${wasAt} → ${nowAt})`,
      });
    }

    return lines;
  }, [movedAppt, resolvedConflicts, conflicts, therapists, patients]);

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
    >
      {/* Nested confirm */}
      {confirmingFinal && (
        <div className="absolute inset-0 z-60 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="text-amber-500" size={22} />
              <h3 className="font-semibold text-gray-900">Unresolved conflicts remain</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {remainingConflicts.length} conflict{remainingConflicts.length !== 1 ? 's' : ''} still overlap.
              Are you sure you want to save anyway?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmingFinal(false)}>Go back</Button>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={doConfirm}>
                Save anyway
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main modal */}
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ width: 'min(92vw, 900px)', maxHeight: '88vh', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={18} className="text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Scheduling Conflict</h2>
              <p className="text-xs text-gray-500">
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} · drag to resolve or use Auto Schedule
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close and revert"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-gray-50 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center">
              <span style={{ fontSize: 6, color: '#fff' }}>✦</span>
            </div>
            Moved (fixed)
          </div>
          <div className="flex items-center gap-1.5">
            <Move size={11} className="text-gray-400" />
            Conflicting (drag to resolve)
          </div>
          <div className="ml-auto text-gray-400">
            {hasUnresolvedConflicts
              ? <span className="text-amber-600 font-medium">{remainingConflicts.length} unresolved</span>
              : <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle size={11} /> All resolved</span>
            }
          </div>
        </div>

        {/* Timeline area */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-2">
          {rows.map((row, i) => (
            <MiniRow
              key={i}
              label={row.label}
              labelColor={row.color}
              rowAppts={row.appts}
              gsMin={gsMin}
              geMin={geMin}
              gridW={gridW}
              draggableIds={draggableIds}
              onDragConflict={handleDragConflict}
            />
          ))}
        </div>

        {/* What needs to change */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What needs to change</p>
          <ul className="space-y-1">
            {changeSummary.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {line.type === 'move' && (
                  <ArrowRight size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                )}
                {line.type === 'reschedule' && (
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-400 flex-shrink-0 mt-0.5" />
                )}
                {line.type === 'failed' && (
                  <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                )}
                <span className={
                  line.type === 'failed' ? 'text-red-600' :
                  line.type === 'move'   ? 'text-blue-700 font-medium' :
                  'text-gray-700'
                }>
                  {line.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-200">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-violet-700 border-violet-200 hover:bg-violet-50"
            onClick={handleAutoSchedule}
          >
            <Zap size={14} />
            Auto Schedule
          </Button>

          {autoApplied && (
            <span className="text-xs text-violet-600 font-medium">
              ✓ Auto-scheduled {resolvedConflicts.filter(c => c.autoMoved && !c.autoFailed).length} appointment{resolvedConflicts.filter(c => c.autoMoved && !c.autoFailed).length !== 1 ? 's' : ''}
            </span>
          )}

          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel &amp; Revert
            </Button>
            <Button
              size="sm"
              className={hasUnresolvedConflicts
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
              }
              onClick={handleConfirm}
            >
              {hasUnresolvedConflicts ? 'Save Anyway' : 'Confirm Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
