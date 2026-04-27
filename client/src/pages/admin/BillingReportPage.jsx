import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Download, RefreshCw, CheckCircle, Clock, AlertTriangle,
  XCircle, DollarSign, Activity, Filter, ChevronDown, ChevronUp,
  Edit3, Save, X, FileSpreadsheet, Table2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useModal } from '../../context/modal-context';
import {
  getBillingReport,
  updateSessionBilling,
  batchUpdateBillingStatus,
  downloadBillingExport,
} from '../../api/billing';

// ── Constants ─────────────────────────────────────────────────────────────────
const BILLING_STATUS_CONFIG = {
  unbilled:  { label: 'Unbilled',   color: '#6B7280', bg: '#F3F4F6', icon: Clock },
  ready:     { label: 'Ready',      color: '#2563EB', bg: '#EFF6FF', icon: CheckCircle },
  submitted: { label: 'Submitted',  color: '#D97706', bg: '#FFFBEB', icon: Activity },
  paid:      { label: 'Paid',       color: '#059669', bg: '#ECFDF5', icon: DollarSign },
  denied:    { label: 'Denied',     color: '#DC2626', bg: '#FEF2F2', icon: XCircle },
  void:      { label: 'Void',       color: '#9CA3AF', bg: '#F9FAFB', icon: AlertTriangle },
};

const SERVICE_LABELS = {
  direct:     'Direct (1:1)',
  circle:     'Group',
  supervision:'Supervision',
  indirect:   'Indirect',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().split('T')[0]; }
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function fmt$(n) {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status, onClick, editable }) {
  const cfg = BILLING_STATUS_CONFIG[status] || BILLING_STATUS_CONFIG.unbilled;
  const Icon = cfg.icon;
  return (
    <button
      onClick={onClick}
      disabled={!editable}
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-opacity"
      style={{ background: cfg.bg, color: cfg.color, cursor: editable ? 'pointer' : 'default' }}
    >
      <Icon size={10} />
      {cfg.label}
    </button>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, color = '#3B82F6' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: color + '18' }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function CptBreakdownTable({ rows }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Table2 size={15} className="text-gray-400" />
        <span className="text-sm font-semibold text-gray-700">CPT Code Breakdown</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
          <tr>
            <th className="px-4 py-2 text-left">CPT</th>
            <th className="px-4 py-2 text-left">Description</th>
            <th className="px-4 py-2 text-right">Sessions</th>
            <th className="px-4 py-2 text-right">Units</th>
            <th className="px-4 py-2 text-right">Est. Revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(r => (
            <tr key={r.cptCode} className="hover:bg-gray-50">
              <td className="px-4 py-2.5">
                <span className="font-mono font-semibold text-blue-700">{r.cptCode}</span>
              </td>
              <td className="px-4 py-2.5 text-gray-600 text-xs max-w-xs">{r.description}</td>
              <td className="px-4 py-2.5 text-right font-medium">{r.sessions}</td>
              <td className="px-4 py-2.5 text-right font-medium">{r.units}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-green-700">{fmt$(r.estimated)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InlineStatusEditor({ sessionId, current, onSave, onCancel }) {
  const [val, setVal] = useState(current);
  return (
    <div className="flex items-center gap-1">
      <select
        value={val}
        onChange={e => setVal(e.target.value)}
        className="text-xs border border-blue-300 rounded px-1.5 py-0.5 bg-white"
        autoFocus
      >
        {Object.entries(BILLING_STATUS_CONFIG).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>
      <button onClick={() => onSave(val)} className="p-0.5 text-green-600 hover:text-green-800">
        <Save size={12} />
      </button>
      <button onClick={onCancel} className="p-0.5 text-gray-400 hover:text-gray-600">
        <X size={12} />
      </button>
    </div>
  );
}

function SessionRow({ session, selected, onSelect, onStatusSave, onEditClick, isEditing }) {
  const patientName = session.patient
    ? `${session.patient.firstName} ${session.patient.lastInitial}.`
    : '—';

  return (
    <tr className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${selected ? 'bg-blue-50' : ''}`}>
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="rounded border-gray-300"
        />
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{fmtDate(session.dateOfService)}</td>
      <td className="px-3 py-2.5">
        <div className="font-medium text-sm text-gray-900">{patientName}</div>
        {session.patient?.insuranceProvider && (
          <div className="text-xs text-gray-400">{session.patient.insuranceProvider}</div>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs font-mono text-gray-600">{session.patient?.memberId || '—'}</td>
      <td className="px-3 py-2.5">
        <span className="font-mono font-semibold text-blue-700 text-sm">{session.cptCode || '—'}</span>
        {session.modifiers?.length > 0 && (
          <span className="ml-1 text-xs text-gray-400">{session.modifiers.join(' ')}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs font-mono text-gray-600">{session.diagnosisCode || '—'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-600">{session.placeOfServiceCode || '—'}</td>
      <td className="px-3 py-2.5 text-right text-sm font-semibold text-gray-800">{session.units ?? '—'}</td>
      <td className="px-3 py-2.5 text-right text-sm">{fmt$(session.estimatedAmount)}</td>
      <td className="px-3 py-2.5">
        <div className="text-xs text-gray-700">
          {session.renderingProvider
            ? `${session.renderingProvider.firstName} ${session.renderingProvider.lastName}`
            : '—'}
        </div>
        {session.supervisingBcba && (
          <div className="text-xs text-gray-400">
            Sup: {session.supervisingBcba.firstName} {session.supervisingBcba.lastName}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="text-xs text-gray-600">{fmtTime(session.startTime)}–{fmtTime(session.endTime)}</div>
        <div className="text-xs text-gray-400 capitalize">{SERVICE_LABELS[session.serviceType] || session.serviceType}</div>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-xs text-gray-500">{session.authorizationNumber || '—'}</div>
        {session.claimNumber && <div className="text-xs text-gray-400">Claim: {session.claimNumber}</div>}
      </td>
      <td className="px-3 py-2.5">
        {isEditing ? (
          <InlineStatusEditor
            sessionId={session.id}
            current={session.billingStatus}
            onSave={onStatusSave}
            onCancel={() => onEditClick(null)}
          />
        ) : (
          <StatusBadge
            status={session.billingStatus}
            editable
            onClick={() => onEditClick(session.id)}
          />
        )}
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BillingReportPage() {
  const qc    = useQueryClient();
  const modal = useModal();

  // ── Filter state ──
  const [startDate,      setStartDate]      = useState(firstOfMonth());
  const [endDate,        setEndDate]        = useState(today());
  const [billingStatus,  setBillingStatus]  = useState('all');
  const [serviceType,    setServiceType]    = useState('all');
  const [editingId,      setEditingId]      = useState(null);
  const [selectedIds,    setSelectedIds]    = useState(new Set());
  const [showCptTable,   setShowCptTable]   = useState(true);
  const [exporting,      setExporting]      = useState(null);
  const [sortCol,        setSortCol]        = useState('dateOfService');
  const [sortDir,        setSortDir]        = useState('asc');

  // ── Query ──
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['billing-report', startDate, endDate, billingStatus, serviceType],
    queryFn:  () => getBillingReport({ startDate, endDate, billingStatus, serviceType }),
    staleTime: 60_000,
  });

  const summary  = data?.summary  || {};
  const sessions = data?.sessions || [];

  // ── Sorting ──
  const sorted = useMemo(() => {
    return [...sessions].sort((a, b) => {
      let av, bv;
      switch (sortCol) {
        case 'dateOfService': av = a.dateOfService; bv = b.dateOfService; break;
        case 'patient':       av = a.patient?.firstName ?? ''; bv = b.patient?.firstName ?? ''; break;
        case 'cptCode':       av = a.cptCode ?? ''; bv = b.cptCode ?? ''; break;
        case 'units':         av = a.units ?? 0;   bv = b.units ?? 0;   break;
        case 'amount':        av = a.estimatedAmount ?? 0; bv = b.estimatedAmount ?? 0; break;
        default:              return 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [sessions, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // ── Status update mutation ──
  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => updateSessionBilling(id, { billingStatus: status }),
    onSuccess: () => {
      qc.invalidateQueries(['billing-report']);
      setEditingId(null);
    },
    onError: (err) => modal.alert(err.message, 'Error', 'error'),
  });

  const batchMutation = useMutation({
    mutationFn: ({ ids, status }) => batchUpdateBillingStatus([...ids], status),
    onSuccess: () => {
      qc.invalidateQueries(['billing-report']);
      setSelectedIds(new Set());
    },
    onError: (err) => modal.alert(err.message, 'Error', 'error'),
  });

  // ── Selection helpers ──
  const allSelected = sorted.length > 0 && sorted.every(s => selectedIds.has(s.id));
  const toggleAll   = () => setSelectedIds(allSelected ? new Set() : new Set(sorted.map(s => s.id)));
  const toggleOne   = (id) => setSelectedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  // ── Export ──
  const handleExport = useCallback(async (format) => {
    setExporting(format);
    try {
      await downloadBillingExport(format, { startDate, endDate, billingStatus, serviceType });
    } catch (err) {
      modal.alert(err.message || 'Export failed', 'Export Error', 'error');
    } finally {
      setExporting(null);
    }
  }, [startDate, endDate, billingStatus, serviceType, modal]);

  // ── Batch status change ──
  const handleBatchStatus = async (status) => {
    if (selectedIds.size === 0) return;
    const confirmed = await modal.confirm(
      `Mark ${selectedIds.size} session${selectedIds.size !== 1 ? 's' : ''} as "${BILLING_STATUS_CONFIG[status].label}"?`
    );
    if (confirmed) batchMutation.mutate({ ids: selectedIds, status });
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronDown size={12} className="text-gray-300" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-blue-500" />
      : <ChevronDown size={12} className="text-blue-500" />;
  };

  const thClass = "px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none";

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 py-5 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <FileText size={20} className="text-green-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Billing Report</h1>
              <p className="text-xs text-gray-500">ABA therapy insurance claims &amp; session tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              disabled={!!exporting}
              className="gap-2 text-green-700 border-green-200 hover:bg-green-50"
            >
              {exporting === 'csv' ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              CSV
            </Button>
            <Button
              size="sm"
              onClick={() => handleExport('xlsx')}
              disabled={!!exporting}
              className="gap-2 bg-green-700 hover:bg-green-800 text-white"
            >
              {exporting === 'xlsx' ? <RefreshCw size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              Excel
            </Button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="mt-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Date From</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Date To</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Billing Status</label>
            <select
              value={billingStatus}
              onChange={e => setBillingStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="all">All Statuses</option>
              {Object.entries(BILLING_STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Service Type</label>
            <select
              value={serviceType}
              onChange={e => setServiceType(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="all">All Billable</option>
              <option value="direct">Direct (97153)</option>
              <option value="supervision">Supervision (97155)</option>
              <option value="circle">Group (97154)</option>
              <option value="indirect">Indirect (97156)</option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <Filter size={12} className="text-blue-500" />
              {sessions.length} sessions shown
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={Activity}
            label="Total Sessions"
            value={summary.totalSessions ?? '—'}
            sub="billable service types"
            color="#3B82F6"
          />
          <SummaryCard
            icon={Clock}
            label="Total Units"
            value={summary.totalUnits ?? '—'}
            sub="15-min billing increments"
            color="#8B5CF6"
          />
          <SummaryCard
            icon={DollarSign}
            label="Est. Revenue"
            value={fmt$(summary.totalEstimated)}
            sub="at default CPT rates"
            color="#059669"
          />
          <SummaryCard
            icon={CheckCircle}
            label="Paid"
            value={fmt$(summary.totalPaid)}
            sub={`${summary.statusBreakdown?.paid ?? 0} sessions paid`}
            color="#D97706"
          />
        </div>

        {/* ── Status breakdown pills ── */}
        {summary.statusBreakdown && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.statusBreakdown).map(([status, count]) => {
              const cfg = BILLING_STATUS_CONFIG[status];
              if (!cfg) return null;
              return (
                <div
                  key={status}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  <cfg.icon size={11} />
                  {cfg.label}: {count}
                </div>
              );
            })}
          </div>
        )}

        {/* ── CPT Breakdown ── */}
        {summary.cptBreakdown?.length > 0 && (
          <div>
            <button
              onClick={() => setShowCptTable(v => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2 hover:text-gray-900"
            >
              {showCptTable ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              CPT Code Summary
            </button>
            {showCptTable && <CptBreakdownTable rows={summary.cptBreakdown} />}
          </div>
        )}

        {/* ── Batch Actions ── */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size} selected
            </span>
            <span className="text-xs text-blue-400">Mark all as:</span>
            {['ready','submitted','paid','denied','void'].map(s => (
              <button
                key={s}
                onClick={() => handleBatchStatus(s)}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: BILLING_STATUS_CONFIG[s].bg, color: BILLING_STATUS_CONFIG[s].color }}
              >
                {BILLING_STATUS_CONFIG[s].label}
              </button>
            ))}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs text-blue-500 hover:text-blue-700"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* ── Sessions Table ── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Session Detail</span>
            <span className="text-xs text-gray-400">Click status badge to edit · check rows to batch-update</span>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
              <RefreshCw size={18} className="animate-spin" />
              Loading sessions...
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <AlertTriangle size={24} className="text-red-400" />
              <p>Failed to load billing data</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          )}

          {!isLoading && !isError && sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText size={32} className="mb-3 opacity-40" />
              <p className="font-medium">No billable sessions found</p>
              <p className="text-xs mt-1">Adjust the date range or filters above</p>
            </div>
          )}

          {!isLoading && !isError && sorted.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1200px]">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className={thClass} onClick={() => toggleSort('dateOfService')}>
                      <span className="flex items-center gap-1">DOS <SortIcon col="dateOfService" /></span>
                    </th>
                    <th className={thClass} onClick={() => toggleSort('patient')}>
                      <span className="flex items-center gap-1">Patient <SortIcon col="patient" /></span>
                    </th>
                    <th className={thClass}>Member ID</th>
                    <th className={thClass} onClick={() => toggleSort('cptCode')}>
                      <span className="flex items-center gap-1">CPT / Mod <SortIcon col="cptCode" /></span>
                    </th>
                    <th className={thClass}>ICD-10</th>
                    <th className={thClass}>POS</th>
                    <th className={`${thClass} text-right`} onClick={() => toggleSort('units')}>
                      <span className="flex items-center justify-end gap-1">Units <SortIcon col="units" /></span>
                    </th>
                    <th className={`${thClass} text-right`} onClick={() => toggleSort('amount')}>
                      <span className="flex items-center justify-end gap-1">Est. $ <SortIcon col="amount" /></span>
                    </th>
                    <th className={thClass}>Provider</th>
                    <th className={thClass}>Time / Type</th>
                    <th className={thClass}>Auth / Claim</th>
                    <th className={thClass}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(session => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      selected={selectedIds.has(session.id)}
                      onSelect={() => toggleOne(session.id)}
                      isEditing={editingId === session.id}
                      onEditClick={id => setEditingId(id)}
                      onStatusSave={status =>
                        updateMutation.mutate({ id: session.id, status })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Billing Codes Reference ── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">ABA CPT Code Reference</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">CPT</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">Description</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">Provider</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-500">Default Rate/Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(data?.cptCodes || []).map(c => (
                  <tr key={c.code} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono font-bold text-blue-700">{c.code}</td>
                    <td className="px-4 py-2 text-gray-600">{c.description}</td>
                    <td className="px-4 py-2 text-gray-500 capitalize">{c.providerType}</td>
                    <td className="px-4 py-2 text-right font-semibold text-green-700">{fmt$(c.defaultRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-700">
            <strong>Note:</strong> Default rates shown are estimates only. Actual reimbursement rates vary by payer, state,
            and contract. Always verify with your insurance contracts and use your contracted rates for claims submission.
            Units are 15-minute increments. Modifier HM = paraprofessional, HN = bachelor's, HO = master's/BCBA.
          </div>
        </div>

        {/* ── ICD-10 Reference ── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">Common ABA ICD-10 Diagnosis Codes</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-gray-100">
            {(data?.icd10Codes || []).map(c => (
              <div key={c.code} className="bg-white px-4 py-2.5">
                <span className="font-mono font-bold text-purple-700 text-xs">{c.code}</span>
                <span className="ml-2 text-xs text-gray-600">{c.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
