import { useEffect, useState, useRef } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Check,
  X,
  AlertCircle,
  Download,
  ChevronRight,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { Skeleton } from '../components/ui/Skeleton';
import { supabase } from '../lib/supabaseClient';
import { exportEmpSettings } from '../lib/exportService';

interface GradeRow {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

interface DesignationRow {
  id: string;
  grade_id: string;
  name: string;
  is_active: boolean;
}

export default function EmpSettingsPage() {
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [designations, setDesignations] = useState<DesignationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Designation search (right pane)
  const [desigSearch, setDesigSearch] = useState('');

  // Add designation
  const [newDesigName, setNewDesigName] = useState('');
  const [addingDesig, setAddingDesig] = useState(false);
  const [addDesigError, setAddDesigError] = useState<string | null>(null);

  // Edit designation
  const [editDesigId, setEditDesigId] = useState<string | null>(null);
  const [editDesigName, setEditDesigName] = useState('');
  const [editDesigError, setEditDesigError] = useState<string | null>(null);
  const [savingDesigId, setSavingDesigId] = useState<string | null>(null);

  const desigInputRef = useRef<HTMLInputElement>(null);
  const editDesigInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const [gradesRes, desigRes] = await Promise.all([
        supabase.from('settings_grades').select('id, name, sort_order, is_active').order('sort_order'),
        supabase.from('settings_designations').select('id, grade_id, name, is_active').order('name'),
      ]);
      const g = (gradesRes.data ?? []) as GradeRow[];
      setGrades(g);
      setDesignations((desigRes.data ?? []) as DesignationRow[]);
      if (g.length > 0) setSelectedGradeId(g[0].id);
      setLoading(false);
    }
    load();
  }, []);

  const selectedGrade = grades.find((g) => g.id === selectedGradeId);
  const gradeDesignations = designations
    .filter((d) => d.grade_id === selectedGradeId)
    .filter((d) => !desigSearch || d.name.toLowerCase().includes(desigSearch.toLowerCase()));

  function selectGrade(id: string) {
    setSelectedGradeId(id);
    setEditDesigId(null);
    setNewDesigName('');
    setDesigSearch('');
    setAddDesigError(null);
  }

  async function handleToggleGrade(grade: GradeRow) {
    await supabase.from('settings_grades').update({ is_active: !grade.is_active }).eq('id', grade.id);
    setGrades((prev) => prev.map((g) => g.id === grade.id ? { ...g, is_active: !g.is_active } : g));
  }

  async function handleAddDesignation() {
    const trimmed = newDesigName.trim();
    if (!trimmed) { setAddDesigError('Name is required.'); return; }
    const existing = designations.filter((d) => d.grade_id === selectedGradeId);
    if (existing.some((d) => d.name.toLowerCase() === trimmed.toLowerCase())) {
      setAddDesigError('This designation already exists for this grade.');
      return;
    }
    setAddingDesig(true);
    setAddDesigError(null);
    const { data, error: err } = await supabase
      .from('settings_designations')
      .insert({ grade_id: selectedGradeId, name: trimmed })
      .select('id, grade_id, name, is_active')
      .single();
    if (err) {
      setAddDesigError(err.message);
    } else {
      setDesignations((prev) => [...prev, data as DesignationRow].sort((a, b) => a.name.localeCompare(b.name)));
      setNewDesigName('');
      desigInputRef.current?.focus();
    }
    setAddingDesig(false);
  }

  async function handleToggleDesignation(d: DesignationRow) {
    setSavingDesigId(d.id);
    await supabase.from('settings_designations').update({ is_active: !d.is_active }).eq('id', d.id);
    setDesignations((prev) => prev.map((item) => item.id === d.id ? { ...item, is_active: !item.is_active } : item));
    setSavingDesigId(null);
  }

  function startEditDesig(d: DesignationRow) {
    setEditDesigId(d.id);
    setEditDesigName(d.name);
    setEditDesigError(null);
    setTimeout(() => editDesigInputRef.current?.focus(), 50);
  }

  async function handleSaveEditDesig(d: DesignationRow) {
    const trimmed = editDesigName.trim();
    if (!trimmed) { setEditDesigError('Name is required.'); return; }
    const siblings = designations.filter((x) => x.grade_id === selectedGradeId && x.id !== d.id);
    if (siblings.some((x) => x.name.toLowerCase() === trimmed.toLowerCase())) {
      setEditDesigError('This name already exists for this grade.');
      return;
    }
    setSavingDesigId(d.id);
    const { error: err } = await supabase.from('settings_designations').update({ name: trimmed }).eq('id', d.id);
    if (err) { setEditDesigError(err.message); setSavingDesigId(null); return; }
    setDesignations((prev) =>
      prev.map((x) => x.id === d.id ? { ...x, name: trimmed } : x).sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditDesigId(null);
    setSavingDesigId(null);
  }

  async function handleExport() {
    setExporting(true);
    try { await exportEmpSettings(); } catch (err) { console.error(err); } finally { setExporting(false); }
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-2xl text-gray-900">Employee Settings</h1>
            <p className="text-sm text-gray-400 font-body mt-0.5">
              Manage grades and their designations shown on the employee skill form.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold font-heading transition-all active:scale-[0.98] disabled:opacity-50 shrink-0"
          >
            <Download size={15} />
            Download
          </button>
        </div>

        {/* Two-column panel */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-[220px_1fr] divide-x divide-gray-100" style={{ minHeight: 540 }}>

              {/* ── Left: Grades list ── */}
              <div className="flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                  <p className="text-[11px] font-semibold font-heading text-gray-400 uppercase tracking-wide">
                    Grades ({grades.length})
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                  {grades.map((grade) => {
                    const isSelected = grade.id === selectedGradeId;
                    const count = designations.filter((d) => d.grade_id === grade.id && d.is_active).length;
                    return (
                      <button
                        key={grade.id}
                        onClick={() => selectGrade(grade.id)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors group ${
                          isSelected
                            ? 'bg-primary-50 border-r-2 border-r-primary-500'
                            : 'hover:bg-gray-50/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold font-heading truncate ${isSelected ? 'text-primary-700' : 'text-gray-700'}`}>
                            {grade.name}
                          </p>
                          <p className="text-[10px] text-gray-400 font-body">{count} designation{count !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!grade.is_active && (
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" title="Inactive grade" />
                          )}
                          <ChevronRight size={12} className={`${isSelected ? 'text-primary-400' : 'text-gray-300 group-hover:text-gray-400'}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Right: Designations for selected grade ── */}
              <div className="flex flex-col">
                {!selectedGrade ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-400 font-body">
                    Select a grade to manage its designations.
                  </div>
                ) : (
                  <>
                    {/* Grade header + toggle */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/60 gap-3 flex-wrap">
                      <div>
                        <p className="font-heading font-bold text-sm text-gray-800">{selectedGrade.name}</p>
                        <p className="text-[11px] text-gray-400 font-body">
                          {designations.filter((d) => d.grade_id === selectedGrade.id && d.is_active).length} active designations
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleGrade(selectedGrade)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-heading border transition-colors ${
                          selectedGrade.is_active
                            ? 'border-orange-200 text-orange-600 hover:bg-orange-50'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {selectedGrade.is_active
                          ? <><ToggleRight size={13} />Deactivate Grade</>
                          : <><ToggleLeft size={13} />Activate Grade</>
                        }
                      </button>
                    </div>

                    {/* Search + Add */}
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/30 space-y-2">
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                          type="text"
                          value={desigSearch}
                          onChange={(e) => setDesigSearch(e.target.value)}
                          placeholder="Search designations…"
                          className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm font-body text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-colors bg-white"
                        />
                        {desigSearch && (
                          <button onClick={() => setDesigSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          ref={desigInputRef}
                          type="text"
                          value={newDesigName}
                          onChange={(e) => { setNewDesigName(e.target.value); setAddDesigError(null); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddDesignation(); }}
                          placeholder="Add new designation…"
                          className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-body text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-colors bg-white"
                        />
                        <button
                          onClick={handleAddDesignation}
                          disabled={addingDesig || !newDesigName.trim()}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-semibold font-heading transition-colors shrink-0"
                        >
                          <Plus size={13} />Add
                        </button>
                      </div>
                      {addDesigError && (
                        <p className="flex items-center gap-1.5 text-xs text-red-500 font-body">
                          <AlertCircle size={12} />{addDesigError}
                        </p>
                      )}
                    </div>

                    {/* Designation list */}
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                      {gradeDesignations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <GraduationCap size={24} className="text-gray-200 mb-2" />
                          <p className="text-sm text-gray-400 font-body">
                            {desigSearch ? 'No designations match your search.' : 'No designations yet. Add one above.'}
                          </p>
                        </div>
                      ) : (
                        gradeDesignations.map((d) => {
                          const isEditing = editDesigId === d.id;
                          const isSaving = savingDesigId === d.id;
                          return (
                            <div
                              key={d.id}
                              className={`flex items-center gap-2 px-5 py-2.5 transition-colors ${!d.is_active ? 'bg-gray-50/60' : 'hover:bg-gray-50/30'}`}
                            >
                              {isEditing ? (
                                <>
                                  <div className="flex-1 min-w-0">
                                    <input
                                      ref={editDesigInputRef}
                                      type="text"
                                      value={editDesigName}
                                      onChange={(e) => { setEditDesigName(e.target.value); setEditDesigError(null); }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEditDesig(d);
                                        if (e.key === 'Escape') setEditDesigId(null);
                                      }}
                                      className="w-full px-3 py-1.5 rounded-lg border border-primary-300 text-sm font-body text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-100"
                                    />
                                    {editDesigError && (
                                      <p className="flex items-center gap-1 text-[11px] text-red-500 font-body mt-1">
                                        <AlertCircle size={10} />{editDesigError}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleSaveEditDesig(d)}
                                    disabled={isSaving}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold font-heading transition-colors shrink-0"
                                  >
                                    <Check size={11} />Save
                                  </button>
                                  <button
                                    onClick={() => setEditDesigId(null)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 text-xs font-semibold font-heading transition-colors shrink-0"
                                  >
                                    <X size={11} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className={`flex-1 min-w-0 text-sm font-body truncate ${d.is_active ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                                    {d.name}
                                  </span>
                                  <button
                                    onClick={() => startEditDesig(d)}
                                    className="p-1 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-colors shrink-0"
                                    title="Edit"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleToggleDesignation(d)}
                                    disabled={isSaving}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold font-heading border transition-colors shrink-0 disabled:opacity-50 ${
                                      d.is_active
                                        ? 'border-orange-200 text-orange-600 hover:bg-orange-50'
                                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                    }`}
                                  >
                                    {d.is_active ? <><ToggleRight size={12} />Deactivate</> : <><ToggleLeft size={12} />Activate</>}
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
