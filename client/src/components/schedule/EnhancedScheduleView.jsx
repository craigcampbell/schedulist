import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  Fragment,
} from 'react';
import { format, isSameDay } from 'date-fns';
import { cn } from '../../lib/utils';
import { Search, Undo2, X, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import ConflictModal, { findConflicts } from './ConflictModal';

// ─── Layout constants (match UnifiedScheduleView) ─────────────────────────────
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

const SVC_DEFAULT = { bg: '#EFF6FF', border: '#3B82F6', solid: '#3B82F6', text: '#1D4ED8', label: 'Session' };

const svcOf = (type) => SVC[type] || SVC_DEFAULT;

// ─── Team color palette ────────────────────────────────────────────────────────
const TEAM_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toMins = (iso) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

const snapMin = (m) => Math.round(m / SNAP) * SNAP;

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

// ─── HIPAA name formatter ──────────────────────────────────────────────────────
function hipaaName(patient) {
  if (!patient) return null;
  const first = patient.decryptedFirstName || patient.firstName || '';
  const last  = patient.decryptedLastName  || patient.lastName  || '';
  if (!first && !last) return 'Unknown';
  const lastInitial = last ? `${last[0].toUpperCase()}.` : '';
  return `${first} ${lastInitial}`.trim();
}

function fullName(patient) {
  if (!patient) return null;
  const first = patient.decryptedFirstName || patient.firstName || '';
  const last  = patient.decryptedLastName  || patient.lastName  || '';
  return `${first} ${last}`.trim() || 'Unknown';
}

function patientLabel(patient, hipaa) {
  if (!patient) return null;
  return hipaa ? hipaaName(patient) : fullName(patient);
}

function therapistFullName(t) {
  if (!t) return '';
  return `${t.firstName || ''} ${t.lastName || ''}`.trim();
}

function therapistInitials(t) {
  if (!t) return '?';
  return `${(t.firstName || '')[0] || ''}${(t.lastName || '')[0] || ''}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function EnhancedScheduleView({
  teams            = [],
  appointments     = [],
  therapists       = [],
  patients         = [],
  selectedDate,
  locations        = [],
  selectedLocation = null,
  userRole         = 'therapist',
  onAppointmentClick  = () => {},
  onAppointmentUpdate = () => {},
}) {
  // ── Local appointment state (optimistic updates + drag) ──
  const [localAppts,    setLocalAppts]    = useState(appointments);
  const [history,       setHistory]       = useState([]); // [{id, startTime, endTime}]
  const [drag,          setDrag]          = useState(null);
  const [tooltip,       setTooltip]       = useState(null);
  const [conflictState, setConflictState] = useState(null);
  const trackRef = useRef(null);

  useEffect(() => setLocalAppts(appointments), [appointments]);

  // ── Filter state ──
  const [search,            setSearch]            = useState('');
  const [filterServiceType, setFilterServiceType] = useState('all');
  const [filterTeam,        setFilterTeam]        = useState('all');
  const [hipaaMode,         setHipaaMode]         = useState(false);

  const canDrag = userRole === 'admin' || userRole === 'bcba';

  // ── Today's appointments ──
  const todayAppts = useMemo(() =>
    localAppts.filter(a => a?.startTime && isSameDay(new Date(a.startTime), new Date(selectedDate))),
    [localAppts, selectedDate]
  );

  // ── Apply service type filter ──
  const filteredByService = useMemo(() => {
    if (filterServiceType === 'all') return todayAppts;
    return todayAppts.filter(a => (a.serviceType || '') === filterServiceType);
  }, [todayAppts, filterServiceType]);

  // ── Operating hours ──
  const { opStart, opEnd } = useMemo(() => {
    const loc = locations.find(l => String(l.id) === String(selectedLocation)) || locations[0];
    return {
      opStart: parseHHMM(loc?.workingHoursStart, 7 * 60 + 30),
      opEnd:   parseHHMM(loc?.workingHoursEnd,   17 * 60 + 30),
    };
  }, [locations, selectedLocation]);

  // ── Grid bounds ──
  const { gsMin, geMin } = useMemo(() => {
    if (!filteredByService.length) return { gsMin: opStart, geMin: opEnd };
    const mins = filteredByService.flatMap(a => [toMins(a.startTime), toMins(a.endTime)]);
    return {
      gsMin: Math.min(opStart, Math.min(...mins) - 15),
      geMin: Math.max(opEnd,   Math.max(...mins) + 15),
    };
  }, [filteredByService, opStart, opEnd]);

  const gridW = (geMin - gsMin) * PX_PER_MIN;

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

  // ── Build team → therapist row list ──
  // Each entry: { therapist, teamId, teamName, teamColor, teamLeadBCBA, teamMemberCount, appts }
  const allRows = useMemo(() => {
    // Build a map from therapistId → team info
    const therapistTeamMap = {};
    teams.forEach((team, ti) => {
      const color = team.color || TEAM_COLORS[ti % TEAM_COLORS.length];
      (team.Members || []).forEach(member => {
        therapistTeamMap[member.id] = {
          teamId:          team.id,
          teamName:        team.name,
          teamColor:       color,
          teamLeadBCBA:    team.LeadBCBA,
          teamMemberCount: (team.Members || []).length,
          teamIndex:       ti,
        };
      });
    });

    // Build per-therapist appointment map from filteredByService
    const therapistApptMap = {};
    filteredByService.forEach(a => {
      if (!a.therapistId || !a.therapist) return;
      if (!therapistApptMap[a.therapistId]) {
        therapistApptMap[a.therapistId] = {
          therapist: a.therapist,
          appts:     [],
        };
      }
      therapistApptMap[a.therapistId].appts.push(a);
    });

    // Also include therapists from teams who might have no appointments today
    // (they still show as empty rows) — but only if search/filter don't exclude them.
    // Actually, per spec: only show rows that have appointments *or* that exist in teams.
    // For now: show all team members; rows with no appointments are still displayed.
    const rowsByTherapist = {};

    // Start from teams to preserve ordering
    teams.forEach((team, ti) => {
      const color = team.color || TEAM_COLORS[ti % TEAM_COLORS.length];
      (team.Members || []).forEach(member => {
        if (rowsByTherapist[member.id]) return;
        rowsByTherapist[member.id] = {
          therapist:      member,
          teamId:         team.id,
          teamName:       team.name,
          teamColor:      color,
          teamLeadBCBA:   team.LeadBCBA,
          teamMemberCount:(team.Members || []).length,
          teamIndex:      ti,
          appts:          (therapistApptMap[member.id]?.appts || [])
                            .slice()
                            .sort((a, b) => new Date(a.startTime) - new Date(b.startTime)),
        };
      });
    });

    // Also add therapists from appointments not in any team
    filteredByService.forEach(a => {
      if (!a.therapistId || !a.therapist || rowsByTherapist[a.therapistId]) return;
      rowsByTherapist[a.therapistId] = {
        therapist:      a.therapist,
        teamId:         null,
        teamName:       'No Team',
        teamColor:      '#9CA3AF',
        teamLeadBCBA:   null,
        teamMemberCount:0,
        teamIndex:      999,
        appts:          (therapistApptMap[a.therapistId]?.appts || [])
                          .slice()
                          .sort((a2, b2) => new Date(a2.startTime) - new Date(b2.startTime)),
      };
    });

    // Sort: by teamIndex, then therapist last name
    return Object.values(rowsByTherapist).sort((a, b) => {
      if (a.teamIndex !== b.teamIndex) return a.teamIndex - b.teamIndex;
      return (a.therapist.lastName || '').localeCompare(b.therapist.lastName || '');
    });
  }, [teams, filteredByService]);

  // ── Apply team filter ──
  const rowsAfterTeamFilter = useMemo(() => {
    if (filterTeam === 'all') return allRows;
    return allRows.filter(r => String(r.teamId) === String(filterTeam));
  }, [allRows, filterTeam]);

  // ── Apply search filter (therapist name OR patient name in any appt) ──
  const visibleRows = useMemo(() => {
    if (!search.trim()) return rowsAfterTeamFilter;
    const q = search.trim().toLowerCase();
    return rowsAfterTeamFilter.filter(row => {
      const tName = therapistFullName(row.therapist).toLowerCase();
      if (tName.includes(q)) return true;
      return row.appts.some(a => {
        const p = a.patient;
        if (!p) return false;
        const pFull = fullName(p).toLowerCase();
        const pHipaa = hipaaName(p).toLowerCase();
        return pFull.includes(q) || pHipaa.includes(q);
      });
    });
  }, [rowsAfterTeamFilter, search]);

  // ── Count stats for filter bar ──
  const { visibleTeamCount } = useMemo(() => {
    const teamIds = new Set(visibleRows.map(r => r.teamId));
    return { visibleTeamCount: teamIds.size };
  }, [visibleRows]);

  const isFiltering = search.trim() || filterServiceType !== 'all' || filterTeam !== 'all';

  // ── Appointment layout helper ──
  const layout = useCallback((a) => {
    const s = toMins(a.startTime), e = toMins(a.endTime);
    return {
      x: (s - gsMin) * PX_PER_MIN,
      w: Math.max((e - s) * PX_PER_MIN, 6),
      startMins: s,
      endMins:   e,
    };
  }, [gsMin]);

  const isConsecutive = (a, b) =>
    Math.abs(toMins(b.startTime) - toMins(a.endTime)) <= CONNECT_GAP;

  // ── Drag handlers ──
  const onMouseMove = useCallback((e) => {
    if (!drag) return;
    const dx = e.clientX - drag.mouseX0;
    const dm = snapMin(dx / PX_PER_MIN);

    setLocalAppts(prev => prev.map(a => {
      if (a.id !== drag.id) return a;
      const base = new Date(a.startTime);

      if (drag.type === 'move') {
        const ns  = Math.max(gsMin, drag.s0 + dm);
        const dur = drag.e0 - drag.s0;
        const ne  = ns + dur;
        const d1  = new Date(base); d1.setHours(Math.floor(ns / 60), ns % 60, 0, 0);
        const d2  = new Date(base); d2.setHours(Math.floor(ne / 60), ne % 60, 0, 0);
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
    if (!canDrag) return;
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

  const clearFilters = () => {
    setSearch('');
    setFilterServiceType('all');
    setFilterTeam('all');
  };

  // ── Group rows into team sections for rendering ──
  // Returns: [{teamId, teamName, teamColor, teamLeadBCBA, rows: [...]}]
  const teamSections = useMemo(() => {
    const sections = [];
    const seen = {};
    visibleRows.forEach(row => {
      const key = row.teamId ?? '__none__';
      if (!seen[key]) {
        seen[key] = true;
        sections.push({
          teamId:      row.teamId,
          teamName:    row.teamName,
          teamColor:   row.teamColor,
          teamLeadBCBA:row.teamLeadBCBA,
          rows:        [],
        });
      }
      sections[sections.length - 1].rows.push(row);
    });
    return sections;
  }, [visibleRows]);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 select-none">

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search therapist or patient…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={cn(
                'w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-gray-100 dark:bg-gray-700',
                'border border-transparent focus:border-blue-400 focus:bg-white dark:focus:bg-gray-600',
                'outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'text-gray-900 dark:text-gray-100'
              )}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Service type filter */}
          <select
            value={filterServiceType}
            onChange={e => setFilterServiceType(e.target.value)}
            className={cn(
              'py-2 pl-3 pr-8 text-sm rounded-xl bg-gray-100 dark:bg-gray-700 border border-transparent',
              'focus:border-blue-400 focus:bg-white dark:focus:bg-gray-600 outline-none transition-colors',
              'text-gray-900 dark:text-gray-100 cursor-pointer appearance-none',
              filterServiceType !== 'all' && 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            )}
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
          >
            <option value="all">All Services</option>
            {Object.entries(SVC).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </select>

          {/* Team filter */}
          <select
            value={filterTeam}
            onChange={e => setFilterTeam(e.target.value)}
            className={cn(
              'py-2 pl-3 pr-8 text-sm rounded-xl bg-gray-100 dark:bg-gray-700 border border-transparent',
              'focus:border-blue-400 focus:bg-white dark:focus:bg-gray-600 outline-none transition-colors',
              'text-gray-900 dark:text-gray-100 cursor-pointer appearance-none',
              filterTeam !== 'all' && 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            )}
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
          >
            <option value="all">All Teams</option>
            {teams.map((t, i) => (
              <option key={t.id} value={t.id}>{t.name || `Team ${i + 1}`}</option>
            ))}
          </select>

          {/* HIPAA toggle */}
          <button
            onClick={() => setHipaaMode(v => !v)}
            title={hipaaMode ? 'Showing abbreviated patient names (HIPAA mode)' : 'Click to enable HIPAA mode'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border transition-all',
              hipaaMode
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 border-transparent text-gray-600 dark:text-gray-400 hover:border-gray-300'
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            HIPAA
          </button>

          {/* Results count + clear */}
          {isFiltering && (
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {visibleRows.length} therapist{visibleRows.length !== 1 ? 's' : ''},{' '}
                {visibleTeamCount} team{visibleTeamCount !== 1 ? 's' : ''}
              </span>
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium whitespace-nowrap"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Timeline card ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

        {/* Title + undo */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-base">
              {format(new Date(selectedDate), 'EEEE, MMMM d')} — Full Schedule
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {canDrag ? 'Drag to reschedule · Drag right edge to resize · ' : ''}Click to view details
            </p>
          </div>
          {history.length > 0 && (
            <Button variant="outline" size="sm" onClick={undo} className="flex items-center gap-1.5 text-xs">
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </Button>
          )}
        </div>

        {/* Drag tooltip */}
        {tooltip && (
          <div className="sticky top-0 z-50 flex justify-center pointer-events-none">
            <div className="bg-gray-900/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg mt-1">
              {tooltip.text}
            </div>
          </div>
        )}

        {/* No results */}
        {visibleRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <Search className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-base font-medium">No therapists match your filters</p>
            <button
              onClick={clearFilters}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}

        {visibleRows.length > 0 && (
          <div className="overflow-x-auto" ref={trackRef}>
            <div className="relative" style={{ minWidth: LABEL_W + gridW + 32 }}>

              {/* ── Sticky time header ─────────────────────────────────────── */}
              <div className="flex sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <div
                  style={{ width: LABEL_W, minWidth: LABEL_W, height: 36 }}
                  className="px-4 flex items-center text-xs font-medium text-gray-400 dark:text-gray-500 border-r border-gray-100 dark:border-gray-700 flex-shrink-0"
                >
                  Therapist
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
                    <div key={i} className="absolute top-0 bottom-0 flex flex-col justify-center" style={{ left: m.x }}>
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

              {/* ── Team sections ──────────────────────────────────────────── */}
              {teamSections.map((section) => (
                <Fragment key={section.teamId ?? '__none__'}>

                  {/* Team divider row */}
                  <div
                    className="flex items-center border-b border-gray-100 dark:border-gray-700"
                    style={{ height: 32, background: `${section.teamColor}10` }}
                  >
                    {/* Colored left border strip */}
                    <div
                      style={{ width: 4, alignSelf: 'stretch', background: section.teamColor, flexShrink: 0 }}
                    />
                    <div
                      style={{ width: LABEL_W - 4, minWidth: LABEL_W - 4, flexShrink: 0 }}
                      className="px-3 flex items-center gap-2 border-r border-gray-100 dark:border-gray-700 overflow-hidden"
                    >
                      <span
                        className="text-xs font-bold uppercase tracking-wide truncate"
                        style={{ color: section.teamColor }}
                      >
                        {section.teamName}
                      </span>
                      {section.teamLeadBCBA && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate hidden sm:inline">
                          · {section.teamLeadBCBA.firstName} {section.teamLeadBCBA.lastName}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 flex items-center px-3 gap-2">
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        {section.rows.length} therapist{section.rows.length !== 1 ? 's' : ''}
                      </span>
                      {section.teamLeadBCBA && (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate sm:hidden">
                          · Lead: {section.teamLeadBCBA.firstName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Therapist rows */}
                  {section.rows.map((row, rowIdx) => {
                    const { therapist, appts: rowAppts, teamColor } = row;
                    const initials = therapistInitials(therapist);

                    return (
                      <div
                        key={therapist.id}
                        className={cn(
                          'flex border-b border-gray-50 dark:border-gray-700/40',
                          rowIdx % 2 === 1 && 'bg-gray-50/40 dark:bg-gray-800/60'
                        )}
                        style={{ height: ROW_H }}
                      >
                        {/* Label column */}
                        <div
                          style={{ width: LABEL_W, minWidth: LABEL_W, flexShrink: 0 }}
                          className="px-3 flex items-center gap-2.5 border-r border-gray-100 dark:border-gray-700"
                        >
                          <div
                            className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
                            style={{ background: teamColor }}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">
                              {therapist.firstName} {therapist.lastName}
                            </div>
                            <div className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                              {rowAppts.length} appt{rowAppts.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>

                        {/* Timeline track */}
                        <div className="relative flex-1" style={{ height: ROW_H }}>

                          {/* Out-of-hours hatching */}
                          {gsMin < opStart && (
                            <div
                              className="absolute top-0 bottom-0 pointer-events-none"
                              style={{
                                left: 0,
                                width: (opStart - gsMin) * PX_PER_MIN,
                                background: 'repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 10px)',
                                backgroundColor: 'rgba(0,0,0,0.03)',
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
                                backgroundColor: 'rgba(0,0,0,0.03)',
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

                          {/* Subtle track line */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                            style={{
                              left: 0, right: 0, height: 2,
                              background: teamColor,
                              opacity: 0.15,
                            }}
                          />

                          {/* Appointment blocks */}
                          {rowAppts.map((appt, idx) => {
                            const { x, w } = layout(appt);
                            const prev = rowAppts[idx - 1];
                            const next = rowAppts[idx + 1];
                            const fromPrev   = prev && isConsecutive(prev, appt);
                            const toNext     = next && isConsecutive(appt, next);
                            const isDragging = drag?.id === appt.id;
                            const svc        = svcOf(appt.serviceType);

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

                            // Patient label
                            const pLabel = appt.patient
                              ? patientLabel(appt.patient, hipaaMode)
                              : svc.label;

                            // Service abbreviation for narrow blocks
                            const svcAbbr = (appt.serviceType || 'D')[0].toUpperCase();

                            return (
                              <div
                                key={appt.id}
                                className={cn(
                                  'absolute flex items-center overflow-visible',
                                  isDragging
                                    ? 'cursor-grabbing z-30 shadow-xl'
                                    : canDrag
                                      ? 'cursor-grab z-10 hover:z-20 hover:shadow-md'
                                      : 'cursor-pointer z-10 hover:z-20 hover:shadow-md',
                                )}
                                style={{
                                  top: 9, bottom: 9,
                                  left: x + ml,
                                  width: Math.max(w - ml - mr, 6),
                                  background:   svc.bg,
                                  border:       `2px solid ${svc.border}`,
                                  borderRadius,
                                  opacity: isDragging ? 0.75 : 1,
                                  boxShadow: isDragging
                                    ? `0 8px 24px ${svc.solid}40`
                                    : `0 1px 3px ${svc.solid}20`,
                                  transition: isDragging ? 'none' : 'box-shadow 0.15s, opacity 0.1s',
                                }}
                                onMouseDown={canDrag ? (e) => beginDrag(e, appt, 'move') : undefined}
                                onClick={() => !drag && onAppointmentClick(appt)}
                                title={`${therapistFullName(appt.therapist)} · ${appt.patient ? fullName(appt.patient) : svc.label} · ${fmt12(appt.startTime)} – ${fmt12(appt.endTime)}`}
                              >
                                {/* Service type abbreviation badge */}
                                {w > 28 && (
                                  <div
                                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ml-1.5"
                                    style={{ background: svc.border, color: '#fff' }}
                                  >
                                    {svcAbbr}
                                  </div>
                                )}

                                {/* Label text */}
                                {w > 54 && (
                                  <div
                                    className="flex-1 px-1.5 min-w-0 leading-tight"
                                    style={{ color: svc.text }}
                                  >
                                    <div className="text-[11px] font-semibold truncate">
                                      {pLabel}
                                    </div>
                                    {w > 100 && (
                                      <div className="text-[10px] opacity-60 truncate">
                                        {fmtDur(appt.startTime, appt.endTime)}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Resize handle — admin/bcba only */}
                                {canDrag && (
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center cursor-ew-resize group/rz flex-shrink-0 rounded-r-full"
                                    onMouseDown={(e) => { e.stopPropagation(); beginDrag(e, appt, 'resize'); }}
                                    title="Drag to resize"
                                  >
                                    <div
                                      className="w-0.5 h-4 rounded-full opacity-0 group-hover/rz:opacity-50 transition-opacity"
                                      style={{ background: svc.text }}
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
                </Fragment>
              ))}

              {/* Bottom padding */}
              <div className="h-2" />
            </div>
          </div>
        )}

        {/* Legend */}
        {visibleRows.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-x-5 gap-y-1.5 items-center">
            {/* Service type legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(SVC).map(([key, s]) => (
                <span key={key} className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: s.solid }}
                  />
                  {s.label}
                </span>
              ))}
            </div>
            <div className="ml-auto flex gap-4 text-[11px] text-gray-400 dark:text-gray-500">
              {canDrag && <span>drag to move · drag edge to resize</span>}
              <span>click to view details</span>
              {history.length > 0 && (
                <span
                  className="text-blue-500 cursor-pointer hover:underline"
                  onClick={undo}
                >
                  ↩ undo last change
                </span>
              )}
            </div>
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
