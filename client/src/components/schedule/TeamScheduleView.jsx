import { useState, useMemo, useEffect, useCallback } from 'react';
import { format, isSameDay } from 'date-fns';
import { cn } from '../../lib/utils';
import { Undo2, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import ConflictModal, { findConflicts } from './ConflictModal';

// ─── Layout constants (must match UnifiedScheduleView) ────────────────────────
const PX_PER_MIN  = 2.2;
const ROW_H       = 58;
const LABEL_W     = 200;
const SNAP        = 15;
const CONNECT_GAP = 4;

// ─── Service type palette ──────────────────────────────────────────────────────
const SVC = {
  direct:      { bg: '#EFF6FF', border: '#3B82F6', solid: '#3B82F6', text: '#1D4ED8', label: 'Direct' },
  circle:      { bg: '#FDF2F8', border: '#EC4899', solid: '#EC4899', text: '#9D174D', label: 'Circle' },
  indirect:    { bg: '#F3F4F6', border: '#9CA3AF', solid: '#6B7280', text: '#374151', label: 'Indirect' },
  supervision: { bg: '#F5F3FF', border: '#8B5CF6', solid: '#8B5CF6', text: '#5B21B6', label: 'Supervision' },
  lunch:       { bg: '#ECFDF5', border: '#10B981', solid: '#10B981', text: '#065F46', label: 'Lunch' },
  cleaning:    { bg: '#FFF7ED', border: '#F97316', solid: '#F97316', text: '#C2410C', label: 'Cleaning' },
};

const SVC_DEFAULT = SVC.direct;

// ─── Team fallback colors (when team.color is absent) ─────────────────────────
const TEAM_COLORS = [
  '#3B82F6','#10B981','#F59E0B','#8B5CF6',
  '#EC4899','#14B8A6','#F97316','#6366F1',
];

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

function svcStyle(serviceType) {
  return SVC[serviceType] || SVC_DEFAULT;
}

function teamColor(team, idx) {
  return team.color || TEAM_COLORS[idx % TEAM_COLORS.length];
}

// ─── HourHeader ───────────────────────────────────────────────────────────────
// Shared sticky time ruler used once per team section.
function HourHeader({ gsMin, geMin, opStart, opEnd, gridW }) {
  const hourMarks = useMemo(() => {
    const marks = [];
    for (let h = Math.floor(gsMin / 60); h <= Math.ceil(geMin / 60); h++) {
      const x = (h * 60 - gsMin) * PX_PER_MIN;
      const p = h >= 12 ? 'PM' : 'AM';
      const hd = h === 0 ? 12 : h > 12 ? h - 12 : h;
      marks.push({ x, label: `${hd}${p}`, isHalf: false, isNoon: h === 12 });
      const xh = ((h + 0.5) * 60 - gsMin) * PX_PER_MIN;
      if (xh > 0 && xh < gridW) marks.push({ x: xh, label: '', isHalf: true, isNoon: false });
    }
    return marks;
  }, [gsMin, geMin, gridW]);

  return (
    <div className="flex sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
      {/* Corner label */}
      <div
        style={{ width: LABEL_W, flexShrink: 0, height: 36 }}
        className="px-4 flex items-center text-xs font-medium text-gray-400 dark:text-gray-500 border-r border-gray-100 dark:border-gray-700"
      >
        Therapist
      </div>

      {/* Ruler */}
      <div className="relative flex-1" style={{ height: 36 }}>
        {/* Out-of-hours shading */}
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
                'text-[11px] font-medium px-0.5 -translate-x-1/2',
                m.isNoon ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
              )}>
                {m.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TherapistRow ──────────────────────────────────────────────────────────────
function TherapistRow({
  therapist,
  appts,
  gsMin,
  opStart,
  opEnd,
  geMin,
  drag,
  canEdit,
  beginDrag,
  onAppointmentClick,
  onCellClick,
  team,
  rowIdx,
}) {
  const sorted = useMemo(
    () => [...appts].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)),
    [appts]
  );

  const isConsecutive = (a, b) =>
    Math.abs(toMins(b.startTime) - toMins(a.endTime)) <= CONNECT_GAP;

  const totalHrs = appts.reduce(
    (s, a) => s + (new Date(a.endTime) - new Date(a.startTime)) / 3.6e6, 0
  );

  const initials = `${therapist.firstName?.[0] || ''}${therapist.lastName?.[0] || ''}`.toUpperCase();

  // Hour-grid lines (re-computed from gsMin/geMin)
  const hourXs = useMemo(() => {
    const xs = [];
    for (let h = Math.floor(gsMin / 60); h <= Math.ceil(geMin / 60); h++) {
      xs.push((h * 60 - gsMin) * PX_PER_MIN);
    }
    return xs;
  }, [gsMin, geMin]);

  return (
    <div
      className={cn(
        'flex border-b border-gray-50 dark:border-gray-700/40',
        rowIdx % 2 === 1 && 'bg-gray-50/40 dark:bg-gray-800/60'
      )}
      style={{ height: ROW_H }}
    >
      {/* Label */}
      <div
        style={{ width: LABEL_W, flexShrink: 0 }}
        className="px-3 flex items-center gap-2.5 border-r border-gray-100 dark:border-gray-700 shrink-0"
      >
        <div
          className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
          style={{ background: teamColor(team, 0) }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">
            {therapist.firstName} {therapist.lastName}
          </div>
          <div className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
            {totalHrs.toFixed(1)}h · {appts.length} appt{appts.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Timeline track */}
      <div
        className="relative flex-1"
        style={{ height: ROW_H }}
        onClick={(e) => {
          // Only fire onCellClick when clicking the bare track, not a block
          if (e.target === e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickMins = gsMin + (e.clientX - rect.left) / PX_PER_MIN;
            const snapped = snap(clickMins);
            onCellClick({
              therapistId: therapist.id,
              timeSlot: `${String(Math.floor(snapped / 60)).padStart(2, '0')}:${String(snapped % 60).padStart(2, '0')}`,
              selectedDate: team._selectedDate,
              teamId: team.id,
              leadBcbaId: team.LeadBCBA?.id,
            });
          }
        }}
      >
        {/* Out-of-hours hatching */}
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
        {hourXs.map((x, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-l border-gray-100 dark:border-gray-700/40"
            style={{ left: x }}
          />
        ))}

        {/* Subway track line */}
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            left: 0, right: 0, height: 3,
            background: teamColor(team, 0),
            opacity: 0.2,
          }}
        />

        {/* Appointment blocks */}
        {sorted.map((appt, idx) => {
          const s = toMins(appt.startTime);
          const e = toMins(appt.endTime);
          const x = (s - gsMin) * PX_PER_MIN;
          const w = Math.max((e - s) * PX_PER_MIN, 6);

          const prev = sorted[idx - 1];
          const next = sorted[idx + 1];
          const fromPrev = prev && isConsecutive(prev, appt);
          const toNext   = next && isConsecutive(appt, next);
          const isDragging = drag?.id === appt.id;

          const sty = svcStyle(appt.serviceType);

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

          const patientName = appt.patient?.decryptedFirstName
            || appt.patient?.firstName
            || null;

          const tooltipText = `${fmt12(appt.startTime)} – ${fmt12(appt.endTime)} · ${sty.label}${patientName ? ' · ' + patientName : ''}`;

          return (
            <div
              key={appt.id}
              className={cn(
                'absolute flex items-center overflow-visible',
                isDragging
                  ? 'cursor-grabbing z-30 shadow-xl'
                  : canEdit
                    ? 'cursor-grab z-10 hover:z-20 hover:shadow-md'
                    : 'cursor-pointer z-10 hover:z-20 hover:shadow-md'
              )}
              style={{
                top: 9, bottom: 9,
                left: x + ml,
                width: Math.max(w - ml - mr, 6),
                background:   sty.bg,
                border:       `2px solid ${sty.border}`,
                borderRadius,
                opacity: isDragging ? 0.75 : 1,
                boxShadow: isDragging
                  ? `0 8px 24px ${sty.solid}40`
                  : `0 1px 3px ${sty.solid}20`,
                transition: isDragging ? 'none' : 'box-shadow 0.15s, opacity 0.1s',
              }}
              onMouseDown={canEdit ? (e) => beginDrag(e, appt, 'move') : undefined}
              onClick={(e) => { e.stopPropagation(); if (!drag) onAppointmentClick(appt); }}
              title={tooltipText}
            >
              {/* Service-type abbreviation badge */}
              {w > 32 && (
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ml-1.5"
                  style={{ background: sty.border, color: '#fff' }}
                >
                  {sty.label.slice(0, 3).toUpperCase()}
                </div>
              )}

              {/* Patient name / label */}
              {w > 60 && (
                <div
                  className="flex-1 px-1.5 min-w-0 leading-tight"
                  style={{ color: sty.text }}
                >
                  <div className="text-[11px] font-semibold truncate">
                    {patientName || sty.label}
                  </div>
                  {w > 100 && (
                    <div className="text-[10px] opacity-70 truncate">
                      {fmtDur(appt.startTime, appt.endTime)}
                    </div>
                  )}
                </div>
              )}

              {/* Resize handle (right edge) */}
              {canEdit && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center cursor-ew-resize group/rz flex-shrink-0 rounded-r-full"
                  onMouseDown={(e) => { e.stopPropagation(); beginDrag(e, appt, 'resize'); }}
                  title="Drag to resize"
                >
                  <div
                    className="w-0.5 h-4 rounded-full opacity-0 group-hover/rz:opacity-50 transition-opacity"
                    style={{ background: sty.text }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TeamSection ──────────────────────────────────────────────────────────────
function TeamSection({
  team,
  teamIdx,
  todayAppts,
  gsMin,
  geMin,
  opStart,
  opEnd,
  gridW,
  collapsed,
  onToggle,
  drag,
  canEdit,
  beginDrag,
  onAppointmentClick,
  onCellClick,
  selectedDate,
}) {
  const color = team.color || TEAM_COLORS[teamIdx % TEAM_COLORS.length];

  // Build per-therapist appointment lists
  const memberRows = useMemo(() => {
    const members = team.Members || [];
    return members.map((member) => {
      const appts = todayAppts.filter((a) => a.therapistId === member.id);
      return { therapist: member, appts };
    });
  }, [team.Members, todayAppts]);

  const teamHrs = useMemo(() =>
    memberRows.reduce(
      (s, { appts }) =>
        s + appts.reduce((ss, a) => ss + (new Date(a.endTime) - new Date(a.startTime)) / 3.6e6, 0),
      0
    ),
    [memberRows]
  );

  const teamApptCount = useMemo(
    () => memberRows.reduce((s, { appts }) => s + appts.length, 0),
    [memberRows]
  );

  // Pass selectedDate down through team object so TherapistRow can use it
  const teamWithDate = useMemo(() => ({ ...team, _selectedDate: selectedDate }), [team, selectedDate]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

      {/* ── Team header ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
        onClick={onToggle}
      >
        {/* Color dot */}
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">
              {team.name || `Team ${teamIdx + 1}`}
            </span>
            {team.LeadBCBA && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Lead: {team.LeadBCBA.firstName} {team.LeadBCBA.lastName}
              </span>
            )}
          </div>
        </div>

        {/* Stats chips */}
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          <span>{(team.Members || []).length} therapist{(team.Members || []).length !== 1 ? 's' : ''}</span>
          <span>{teamApptCount} appt{teamApptCount !== 1 ? 's' : ''}</span>
          <span>{teamHrs.toFixed(1)}h</span>
        </div>

        {/* Chevron */}
        {collapsed
          ? <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
          : <ChevronDown  className="h-4 w-4 text-gray-400 flex-shrink-0" />
        }
      </div>

      {/* ── Timeline body ────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <div className="relative" style={{ minWidth: LABEL_W + gridW + 32 }}>

            {/* Time ruler */}
            <HourHeader
              gsMin={gsMin}
              geMin={geMin}
              opStart={opStart}
              opEnd={opEnd}
              gridW={gridW}
            />

            {/* Therapist rows */}
            {memberRows.length === 0 ? (
              <div className="flex items-center justify-center h-14 text-xs text-gray-400 dark:text-gray-500">
                No therapists in this team
              </div>
            ) : (
              memberRows.map(({ therapist, appts }, rowIdx) => (
                <TherapistRow
                  key={therapist.id}
                  therapist={therapist}
                  appts={appts}
                  gsMin={gsMin}
                  opStart={opStart}
                  opEnd={opEnd}
                  geMin={geMin}
                  drag={drag}
                  canEdit={canEdit}
                  beginDrag={beginDrag}
                  onAppointmentClick={onAppointmentClick}
                  onCellClick={onCellClick}
                  team={teamWithDate}
                  rowIdx={rowIdx}
                />
              ))
            )}

            <div className="h-2" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function TeamScheduleView({
  teams            = [],
  appointments     = [],
  therapists       = [],
  patients         = [],
  selectedDate,
  locations        = [],
  selectedLocation = null,
  userRole         = 'therapist',
  canEdit          = false,
  onAppointmentClick  = () => {},
  onCellClick         = () => {},
  onAppointmentUpdate = () => {},
}) {
  const [localAppts,    setLocalAppts]    = useState(appointments);
  const [history,       setHistory]       = useState([]);
  const [drag,          setDrag]          = useState(null);
  const [tooltip,       setTooltip]       = useState(null);
  const [conflictState, setConflictState] = useState(null);
  // Collapsed state keyed by team.id; default all expanded
  const [collapsed,  setCollapsed]  = useState(() => {
    if (teams.length > 3) {
      // Collapse all but the first when there are many teams
      return teams.slice(1).reduce((acc, t) => ({ ...acc, [t.id]: true }), {});
    }
    return {};
  });

  useEffect(() => { setLocalAppts(appointments); }, [appointments]);

  // ── Today filter ──
  const todayAppts = useMemo(() =>
    localAppts.filter(
      (a) => a?.startTime && isSameDay(new Date(a.startTime), new Date(selectedDate))
    ),
    [localAppts, selectedDate]
  );

  // ── Operating hours from selected location ──
  const { opStart, opEnd } = useMemo(() => {
    const loc = locations.find((l) => String(l.id) === String(selectedLocation)) || locations[0];
    return {
      opStart: parseHHMM(loc?.workingHoursStart, 7 * 60 + 30),
      opEnd:   parseHHMM(loc?.workingHoursEnd,   17 * 60 + 30),
    };
  }, [locations, selectedLocation]);

  // ── Grid bounds: expand to contain any out-of-hours appointments ──
  const { gsMin, geMin } = useMemo(() => {
    if (!todayAppts.length) return { gsMin: opStart, geMin: opEnd };
    const mins = todayAppts.flatMap((a) => [toMins(a.startTime), toMins(a.endTime)]);
    return {
      gsMin: Math.min(opStart, Math.min(...mins) - 15),
      geMin: Math.max(opEnd,   Math.max(...mins) + 15),
    };
  }, [todayAppts, opStart, opEnd]);

  const gridW = (geMin - gsMin) * PX_PER_MIN;

  // ── Drag handlers ──
  const onMouseMove = useCallback((e) => {
    if (!drag) return;
    const dx = e.clientX - drag.mouseX0;
    const dm = snap(dx / PX_PER_MIN);

    setLocalAppts((prev) => prev.map((a) => {
      if (a.id !== drag.id) return a;
      const base = new Date(a.startTime);

      if (drag.type === 'move') {
        const ns = Math.max(gsMin, drag.s0 + dm);
        const dur = drag.e0 - drag.s0;
        const ne = ns + dur;
        const d1 = new Date(base); d1.setHours(Math.floor(ns / 60), ns % 60, 0, 0);
        const d2 = new Date(base); d2.setHours(Math.floor(ne / 60), ne % 60, 0, 0);
        setTooltip({ text: `${fmt12(d1.toISOString())} – ${fmt12(d2.toISOString())}` });
        return { ...a, startTime: d1.toISOString(), endTime: d2.toISOString() };
      } else {
        const ne = Math.max(drag.s0 + SNAP, drag.e0 + dm);
        const d2 = new Date(base); d2.setHours(Math.floor(ne / 60), ne % 60, 0, 0);
        setTooltip({ text: `End: ${fmt12(d2.toISOString())} (${fmtDur(a.startTime, d2.toISOString())})` });
        return { ...a, endTime: d2.toISOString() };
      }
    }));
  }, [drag, gsMin]);

  const onMouseUp = useCallback(() => {
    if (!drag) return;
    const updated = localAppts.find((a) => a.id === drag.id);
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
        setHistory((h) => [...h.slice(-19), { id: drag.id, startTime: drag.origStart, endTime: drag.origEnd }]);
        onAppointmentUpdate(updated);
      }
    }
    setDrag(null);
    setTooltip(null);
  }, [drag, localAppts, onAppointmentUpdate]);

  useEffect(() => {
    if (!drag) return;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
  }, [drag, onMouseMove, onMouseUp]);

  const beginDrag = useCallback((e, appt, type) => {
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
  }, [canEdit]);

  // ── Undo ──
  const undo = useCallback(() => {
    if (!history.length) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setLocalAppts((prev) =>
      prev.map((a) => a.id === last.id ? { ...a, startTime: last.startTime, endTime: last.endTime } : a)
    );
    const full = localAppts.find((a) => a.id === last.id);
    if (full) onAppointmentUpdate({ ...full, startTime: last.startTime, endTime: last.endTime });
  }, [history, localAppts, onAppointmentUpdate]);

  const toggleCollapsed = useCallback((teamId) => {
    setCollapsed((prev) => ({ ...prev, [teamId]: !prev[teamId] }));
  }, []);

  // ── Stats bar ──
  const totalAppts = todayAppts.length;
  const totalHrs = todayAppts.reduce(
    (s, a) => s + (new Date(a.endTime) - new Date(a.startTime)) / 3.6e6, 0
  );

  // ── Empty state ──
  if (teams.length === 0 && todayAppts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-500">
        <Users className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">No teams or appointments for {format(new Date(selectedDate), 'EEEE, MMMM d')}</p>
        <p className="text-sm mt-1 opacity-70">Create teams and add appointments to see the schedule here.</p>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 select-none">

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
            {format(new Date(selectedDate), 'EEEE, MMMM d')} — Team Schedule
          </h3>
          {canEdit && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Drag to reschedule · Drag right edge to resize
            </p>
          )}
        </div>

        <div className="flex items-center gap-5">
          <div className="text-center">
            <div className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{teams.length}</div>
            <div className="text-[11px] text-gray-400">team{teams.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{totalAppts}</div>
            <div className="text-[11px] text-gray-400">appointment{totalAppts !== 1 ? 's' : ''}</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{totalHrs.toFixed(1)}h</div>
            <div className="text-[11px] text-gray-400">total hours</div>
          </div>
          {history.length > 0 && (
            <Button variant="outline" size="sm" onClick={undo} className="flex items-center gap-1.5 text-xs">
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </Button>
          )}
        </div>
      </div>

      {/* ── Drag tooltip (floats near top of viewport) ─────────────────────── */}
      {tooltip && (
        <div className="sticky top-2 z-50 flex justify-center pointer-events-none">
          <div className="bg-gray-900/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
            {tooltip.text}
          </div>
        </div>
      )}

      {/* ── Team sections ────────────────────────────────────────────────────── */}
      {teams.map((team, teamIdx) => (
        <TeamSection
          key={team.id}
          team={team}
          teamIdx={teamIdx}
          todayAppts={todayAppts}
          gsMin={gsMin}
          geMin={geMin}
          opStart={opStart}
          opEnd={opEnd}
          gridW={gridW}
          collapsed={!!collapsed[team.id]}
          onToggle={() => toggleCollapsed(team.id)}
          drag={drag}
          canEdit={canEdit}
          beginDrag={beginDrag}
          onAppointmentClick={onAppointmentClick}
          onCellClick={onCellClick}
          selectedDate={selectedDate}
        />
      ))}

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500 px-1 pb-2">
        {Object.values(SVC).map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.solid }} />
            {s.label}
          </span>
        ))}
        {canEdit && (
          <>
            <span className="ml-4">⟵ drag block to move</span>
            <span>drag ▕ right edge to resize</span>
          </>
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
