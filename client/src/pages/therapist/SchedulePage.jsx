import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/auth-context';
import { format, addDays, subDays, isSameDay, isToday, startOfWeek } from 'date-fns';
import { MapPin, Clock, ChevronLeft, ChevronRight, X, User, Stethoscope, Coffee, ClipboardList, Shield, Sparkles } from 'lucide-react';
import { getTherapistSchedule } from '../../api/schedule';

// ─── Style map ────────────────────────────────────────────────────────────────
const SERVICE_STYLES = {
  direct:      { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8', pill: '#3B82F6', label: 'Direct Therapy',  icon: Stethoscope },
  circle:      { bg: '#FDF2F8', border: '#EC4899', text: '#9D174D', pill: '#EC4899', label: 'Circle Time',     icon: Sparkles },
  indirect:    { bg: '#F3F4F6', border: '#6B7280', text: '#374151', pill: '#6B7280', label: 'Indirect',        icon: ClipboardList },
  supervision: { bg: '#F5F3FF', border: '#8B5CF6', text: '#5B21B6', pill: '#8B5CF6', label: 'Supervision',     icon: Shield },
  lunch:       { bg: '#ECFDF5', border: '#10B981', text: '#065F46', pill: '#10B981', label: 'Lunch',           icon: Coffee },
  cleaning:    { bg: '#FFF7ED', border: '#F97316', text: '#C2410C', pill: '#F97316', label: 'Cleaning',        icon: ClipboardList },
};
const DEFAULT_STYLE = SERVICE_STYLES.direct;

function styleFor(appt) {
  return SERVICE_STYLES[appt.serviceType] || DEFAULT_STYLE;
}

function fmt12(iso) {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  const p = h >= 12 ? 'pm' : 'am';
  const hd = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hd}${m ? ':' + String(m).padStart(2, '0') : ''}${p}`;
}

function fmtDur(iso1, iso2) {
  const mins = Math.round((new Date(iso2) - new Date(iso1)) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), r = mins % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

// ─── Week strip ───────────────────────────────────────────────────────────────
function WeekStrip({ selectedDate, onSelect, appointmentDates }) {
  const mon = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));

  return (
    <div className="flex gap-1 justify-between px-1">
      {days.map(d => {
        const isSelected = isSameDay(d, selectedDate);
        const todayDay = isToday(d);
        const hasAppts = appointmentDates.some(ad => isSameDay(ad, d));
        return (
          <button
            key={d.toISOString()}
            onClick={() => onSelect(d)}
            className="flex flex-col items-center gap-1 flex-1 py-2 rounded-2xl transition-all"
            style={{
              background: isSelected ? '#3B82F6' : 'transparent',
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: isSelected ? '#BFDBFE' : '#9CA3AF' }}>
              {format(d, 'EEE')}
            </span>
            <span className="text-sm font-bold"
              style={{ color: isSelected ? '#fff' : todayDay ? '#3B82F6' : '#1F2937' }}>
              {format(d, 'd')}
            </span>
            {hasAppts && !isSelected && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            )}
            {(!hasAppts || isSelected) && <span className="w-1.5 h-1.5" />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Appointment card ─────────────────────────────────────────────────────────
function ApptCard({ appt, onTap, isNext }) {
  const s = styleFor(appt);
  const Icon = s.icon;
  const patientName = appt.patient
    ? `${appt.patient.firstName || appt.patient.decryptedFirstName || ''} ${appt.patient.lastName || appt.patient.decryptedLastName || ''}`.trim()
    : null;

  return (
    <button
      onClick={() => onTap(appt)}
      className="w-full text-left rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] transition-transform"
      style={{ border: `2px solid ${s.border}20`, background: s.bg }}
    >
      {/* Accent bar */}
      <div className="h-1 w-full" style={{ background: s.pill }} />

      <div className="px-4 py-3 flex items-start gap-3">
        {/* Icon bubble */}
        <div
          className="mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: s.pill + '22', border: `1.5px solid ${s.pill}44` }}
        >
          <Icon size={18} style={{ color: s.pill }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: s.text }}>
              {s.label}
            </span>
            {isNext && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white">
                NEXT
              </span>
            )}
          </div>

          {patientName && (
            <p className="text-base font-bold text-gray-800 leading-tight mt-0.5 truncate">
              {patientName}
            </p>
          )}

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={12} />
              {fmt12(appt.startTime)} – {fmt12(appt.endTime)}
              <span className="text-gray-400">· {fmtDur(appt.startTime, appt.endTime)}</span>
            </span>
            {appt.location?.name && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin size={12} />
                {appt.location.name}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Detail bottom sheet ──────────────────────────────────────────────────────
function DetailSheet({ appt, onClose }) {
  if (!appt) return null;
  const s = styleFor(appt);
  const Icon = s.icon;
  const patientName = appt.patient
    ? `${appt.patient.firstName || appt.patient.decryptedFirstName || ''} ${appt.patient.lastName || appt.patient.decryptedLastName || ''}`.trim()
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl bg-white shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '85vh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Colored header */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ background: s.bg, borderBottom: `2px solid ${s.border}30` }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: s.pill }}>
            <Icon size={22} color="#fff" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: s.text }}>{s.label}</p>
            {patientName && <p className="text-xl font-bold text-gray-900 leading-tight">{patientName}</p>}
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-black/5">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 120px)' }}>
          <Row icon={<Clock size={16} className="text-blue-500" />} label="Time">
            <p className="font-semibold text-gray-800">{fmt12(appt.startTime)} – {fmt12(appt.endTime)}</p>
            <p className="text-sm text-gray-500">{fmtDur(appt.startTime, appt.endTime)} · {format(new Date(appt.startTime), 'EEEE, MMMM d')}</p>
          </Row>

          {appt.location?.name && (
            <Row icon={<MapPin size={16} className="text-rose-400" />} label="Location">
              <p className="font-semibold text-gray-800">{appt.location.name}</p>
              {appt.location.address && <p className="text-sm text-gray-500">{appt.location.address}</p>}
            </Row>
          )}

          {appt.patient && (
            <Row icon={<User size={16} className="text-purple-400" />} label="Patient">
              <p className="font-semibold text-gray-800">{patientName}</p>
            </Row>
          )}

          <Row icon={<Sparkles size={16} className="text-amber-400" />} label="Status">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: s.pill + '22', color: s.text }}
            >
              {appt.status}
            </span>
          </Row>

          {appt.notes && (
            <Row icon={<ClipboardList size={16} className="text-gray-400" />} label="Notes">
              <p className="text-gray-700 text-sm leading-relaxed">{appt.notes}</p>
            </Row>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, children }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyDay({ date }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center mb-4">
        <Sparkles size={32} className="text-blue-300" />
      </div>
      <p className="text-lg font-bold text-gray-700">Free day!</p>
      <p className="text-sm text-gray-400 mt-1">No sessions on {format(date, 'EEEE, MMM d')}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TherapistSchedulePage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selected, setSelected] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['therapistSchedule'],
    queryFn: () => getTherapistSchedule(14),
  });

  const allAppts = useMemo(() => data?.appointments || [], [data]);

  // Dates that have appointments (for week strip dots)
  const appointmentDates = useMemo(
    () => allAppts.map(a => new Date(a.startTime)),
    [allAppts]
  );

  // Appointments for selected day, sorted
  const dayAppts = useMemo(() =>
    allAppts
      .filter(a => isSameDay(new Date(a.startTime), selectedDate))
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime)),
    [allAppts, selectedDate]
  );

  // Which appointment is "next" (soonest upcoming today)
  const nextApptId = useMemo(() => {
    if (!isToday(selectedDate)) return null;
    const now = Date.now();
    const upcoming = dayAppts.filter(a => new Date(a.startTime) > now);
    return upcoming[0]?.id || null;
  }, [dayAppts, selectedDate]);

  // Stats for today
  const totalHours = useMemo(() => {
    const mins = dayAppts.reduce((s, a) => s + (new Date(a.endTime) - new Date(a.startTime)) / 60000, 0);
    return (mins / 60).toFixed(1);
  }, [dayAppts]);

  const directCount = useMemo(() =>
    dayAppts.filter(a => a.serviceType === 'direct' || a.serviceType === 'circle').length,
    [dayAppts]
  );

  return (
    <div className="min-h-full flex flex-col -m-4 bg-gray-50">

      {/* ── Top header ────────────────────────────────────────────────────── */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm sticky top-0 z-10">
        {/* Greeting + nav */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">My Schedule</p>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              {isToday(selectedDate) ? 'Today' : format(selectedDate, 'MMMM d')}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedDate(d => subDays(d, 7))}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 h-9 rounded-full bg-gray-100 text-xs font-semibold text-gray-600"
            >
              Today
            </button>
            <button
              onClick={() => setSelectedDate(d => addDays(d, 7))}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Week strip */}
        <WeekStrip
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          appointmentDates={appointmentDates}
        />
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 pt-4 pb-24">

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
            <p className="text-sm text-gray-400">Loading your schedule…</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-sm text-red-500">Couldn't load schedule.</p>
            <button onClick={refetch} className="text-sm text-blue-500 underline">Try again</button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Day stats pill */}
            {dayAppts.length > 0 && (
              <div className="flex gap-2 mb-4">
                <StatPill label="Sessions" value={dayAppts.length} color="#3B82F6" />
                <StatPill label="Direct" value={directCount} color="#10B981" />
                <StatPill label="Hours" value={`${totalHours}h`} color="#8B5CF6" />
              </div>
            )}

            {/* Timeline */}
            {dayAppts.length === 0 ? (
              <EmptyDay date={selectedDate} />
            ) : (
              <div className="space-y-3">
                {dayAppts.map((appt, i) => {
                  const prevEnd = i > 0 ? new Date(dayAppts[i - 1].endTime) : null;
                  const gapMins = prevEnd ? Math.round((new Date(appt.startTime) - prevEnd) / 60000) : null;
                  return (
                    <div key={appt.id}>
                      {/* Gap indicator */}
                      {gapMins !== null && gapMins > 0 && (
                        <div className="flex items-center gap-2 py-1.5 px-2">
                          <div className="w-px h-4 bg-gray-200 mx-3" />
                          <span className="text-xs text-gray-400">{gapMins}m gap</span>
                        </div>
                      )}
                      <ApptCard
                        appt={appt}
                        isNext={appt.id === nextApptId}
                        onTap={setSelected}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Detail sheet ──────────────────────────────────────────────────── */}
      <DetailSheet appt={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div className="flex-1 rounded-2xl bg-white shadow-sm px-3 py-2.5 text-center border border-gray-100">
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
    </div>
  );
}
