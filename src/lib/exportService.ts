import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';
import type { FormStatus } from '../types';

export interface ExportFilters {
  fromDate?: string;
  toDate?: string;
  status?: FormStatus | 'all' | 'not_started';
}

interface RawFormRow {
  id: string;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
  updated_at: string;
  reminders_sent: number;
  step1_data: Record<string, unknown> | null;
  step2_data: Record<string, unknown> | null;
  step3_data: Record<string, unknown> | null;
  step4_data: Record<string, unknown> | null;
  manager_review_date: string | null;
  employee: {
    id: string;
    full_name: string;
    email: string;
    employee_number: string;
    designation: string;
    grade: string;
    manager_name: string;
  };
}

const NAVY = '1A3C5E';
const WHITE = 'FFFFFFFF';

function applyHeaderStyle(ws: XLSX.WorkSheet, range: XLSX.Range) {
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: WHITE }, name: 'Calibri', sz: 11 },
      fill: { fgColor: { rgb: NAVY }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
      border: { bottom: { style: 'thin', color: { rgb: 'CCCCCC' } } },
    };
  }
}

function autoWidth(data: unknown[][]): XLSX.ColInfo[] {
  const colWidths: number[] = [];
  data.forEach((row) => {
    (row as unknown[]).forEach((cell, i) => {
      const len = String(cell ?? '').length;
      colWidths[i] = Math.min(Math.max(colWidths[i] ?? 10, len + 2), 50);
    });
  });
  return colWidths.map((w) => ({ wch: w }));
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function daysPending(submittedAt: string | null, approvedAt: string | null): number | string {
  if (!submittedAt) return '';
  const end = approvedAt ? new Date(approvedAt) : new Date();
  const start = new Date(submittedAt);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

function joinArr(val: unknown): string {
  if (Array.isArray(val)) return val.filter(Boolean).join('; ');
  if (typeof val === 'string') return val;
  return '';
}

function skillNames(rows: unknown[]): string {
  if (!Array.isArray(rows)) return '';
  return rows.map((r: unknown) => safeStr((r as Record<string, unknown>)?.name)).filter(Boolean).join('; ');
}

function skillRatings(rows: unknown[], field: 'employee_rating' | 'manager_rating'): string {
  if (!Array.isArray(rows)) return '';
  return rows.map((r: unknown) => {
    const v = (r as Record<string, unknown>)?.[field];
    return v !== null && v !== undefined ? String(v) : '';
  }).join('; ');
}

export async function exportToExcel(filters: ExportFilters = {}): Promise<void> {
  let query = supabase
    .from('skill_forms')
    .select(
      'id, status, submitted_at, approved_at, updated_at, reminders_sent, step1_data, step2_data, step3_data, step4_data, manager_review_date, users!skill_forms_employee_id_fkey(id, full_name, email, employee_number, designation, grade, manager_id)'
    )
    .order('updated_at', { ascending: false });

  if (filters.fromDate) query = query.gte('submitted_at', filters.fromDate);
  if (filters.toDate)   query = query.lte('submitted_at', filters.toDate + 'T23:59:59');
  if (filters.status && filters.status !== 'all' && filters.status !== 'not_started') {
    query = query.eq('status', filters.status);
  }

  const { data: formsRaw } = await query;

  const allManagerIds = new Set<string>();
  (formsRaw ?? []).forEach((f) => {
    const u = f.users as Record<string, unknown> | null;
    if (u?.manager_id) allManagerIds.add(u.manager_id as string);
  });

  let managersMap: Record<string, string> = {};
  if (allManagerIds.size > 0) {
    const { data: mgrs } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', [...allManagerIds]);
    if (mgrs) managersMap = Object.fromEntries(mgrs.map((m) => [m.id, m.full_name]));
  }

  const forms: RawFormRow[] = (formsRaw ?? []).map((f) => {
    const u = f.users as Record<string, unknown> | null;
    return {
      id: f.id,
      status: f.status,
      submitted_at: f.submitted_at,
      approved_at: f.approved_at ?? null,
      updated_at: f.updated_at,
      reminders_sent: f.reminders_sent ?? 0,
      step1_data: f.step1_data as Record<string, unknown> | null,
      step2_data: f.step2_data as Record<string, unknown> | null,
      step3_data: f.step3_data as Record<string, unknown> | null,
      step4_data: f.step4_data as Record<string, unknown> | null,
      manager_review_date: f.manager_review_date ?? null,
      employee: {
        id: safeStr(u?.id),
        full_name: safeStr(u?.full_name),
        email: safeStr(u?.email),
        employee_number: safeStr(u?.employee_number),
        designation: safeStr(u?.designation),
        grade: safeStr(u?.grade),
        manager_name: u?.manager_id ? (managersMap[u.manager_id as string] || '') : '',
      },
    };
  });

  if (filters.status === 'not_started') {
    const { data: employees } = await supabase
      .from('users')
      .select('id, full_name, email, employee_number, designation, grade, manager_id')
      .eq('role', 'employee');

    const formEmployeeIds = new Set(forms.map((f) => f.employee.id));
    const notStarted: RawFormRow[] = (employees ?? [])
      .filter((e) => !formEmployeeIds.has(e.id))
      .map((e) => ({
        id: '',
        status: 'not_started',
        submitted_at: null,
        approved_at: null,
        updated_at: '',
        reminders_sent: 0,
        step1_data: null,
        step2_data: null,
        step3_data: null,
        step4_data: null,
        manager_review_date: null,
        employee: {
          id: e.id,
          full_name: e.full_name,
          email: e.email,
          employee_number: e.employee_number || '',
          designation: e.designation || '',
          grade: e.grade || '',
          manager_name: e.manager_id ? (managersMap[e.manager_id] || '') : '',
        },
      }));
    forms.push(...notStarted);
  }

  const wb = XLSX.utils.book_new();
  wb.Props = { Title: 'SkillSync Export', Author: 'SkillSync' };

  const sheet1Headers = [
    'Employee Name', 'Email', 'Employee No.', 'Designation', 'Grade',
    'Total Exp (yrs)', 'Relevant Exp (yrs)', 'Haptiq Exp (yrs)', 'Current Project', 'Manager Name',
    'Languages', 'Language Self-Ratings', 'Language Mgr Ratings',
    'Frameworks', 'Framework Self-Ratings', 'Framework Mgr Ratings',
    'Tools', 'Databases', 'Certifications',
    '6-Month Upskilling Plan', 'Manager Expectation Plan',
    'Form Status', 'Submitted Date', 'Approved Date',
  ];

  const sheet1Data: unknown[][] = [sheet1Headers];
  forms.forEach((f) => {
    const s1 = f.step1_data ?? {};
    const s2 = f.step2_data ?? {};
    const s3 = f.step3_data ?? {};
    const s4 = f.step4_data ?? {};
    const langs = (s2.languages as unknown[]) ?? [];
    const fwks  = (s2.frameworks as unknown[]) ?? [];

    sheet1Data.push([
      f.employee.full_name,
      f.employee.email,
      f.employee.employee_number,
      safeStr(s1.designation) || f.employee.designation,
      safeStr(s1.grade) || f.employee.grade,
      safeStr(s1.total_exp),
      safeStr(s1.relevant_exp),
      safeStr(s1.haptiq_exp),
      safeStr(s1.current_project),
      safeStr(s1.manager_name) || f.employee.manager_name,
      skillNames(langs),
      skillRatings(langs, 'employee_rating'),
      skillRatings(langs, 'manager_rating'),
      skillNames(fwks),
      skillRatings(fwks, 'employee_rating'),
      skillRatings(fwks, 'manager_rating'),
      safeStr(s2.tools),
      safeStr(s2.databases),
      joinArr(s3.certifications),
      safeStr(s4.upskilling_plan),
      safeStr(s4.manager_expectation_plan),
      f.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      formatDate(f.submitted_at),
      formatDate(f.approved_at),
    ]);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1['!cols'] = autoWidth(sheet1Data);
  ws1['!freeze'] = { xSplit: 0, ySplit: 1 };
  applyHeaderStyle(ws1, XLSX.utils.decode_range(ws1['!ref'] ?? 'A1'));
  XLSX.utils.book_append_sheet(wb, ws1, 'Skill Data');

  const sheet2Headers = [
    'Employee Name', 'Email', 'Manager Name', 'Form Status',
    'Submitted Date', 'Manager Review Date', 'Days Pending', 'Reminders Sent',
  ];

  const sheet2Data: unknown[][] = [sheet2Headers];
  forms.forEach((f) => {
    sheet2Data.push([
      f.employee.full_name,
      f.employee.email,
      f.employee.manager_name,
      f.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      formatDate(f.submitted_at),
      formatDate(f.manager_review_date),
      daysPending(f.submitted_at, f.approved_at),
      f.reminders_sent,
    ]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = autoWidth(sheet2Data);
  ws2['!freeze'] = { xSplit: 0, ySplit: 1 };
  applyHeaderStyle(ws2, XLSX.utils.decode_range(ws2['!ref'] ?? 'A1'));
  XLSX.utils.book_append_sheet(wb, ws2, 'Submission Tracker');

  const filename = `skillsync-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
