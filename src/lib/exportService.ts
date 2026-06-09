import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { db } from './db';
import type { FormStatus } from '../types';

// Haptiq Brand Colors
const HAPTIQ_NAVY = '#1A3C5E';
const HAPTIQ_TEAL = '#00A9CE';
const HAPTIQ_LIGHT_BG = '#F0F7FA';
const HAPTIQ_DARK_GRAY = '#374151';
const HAPTIQ_MEDIUM_GRAY = '#6B7280';
const HAPTIQ_LIGHT_GRAY = '#E5E7EB';

export interface ExportFilters {
  fromDate?: string;
  toDate?: string;
  status?: FormStatus | 'all' | 'not_started';
}

interface SkillItem {
  category: 'language' | 'framework';
  name: string;
  employee_rating: number | null;
  manager_rating: number | null;
  manager_comment?: string | null;
}

interface SkillItemWithDelta extends SkillItem {
  prev_employee_rating: number | null;
  prev_manager_rating: number | null;
  is_new: boolean;
}

interface PrevSnapshot {
  cycle_name: string;
  approved_at: string;
  skills: SkillItem[];
  certifications: string[];
  tools: string;
  databases: string;
  total_exp: number | null;
  relevant_exp: number | null;
  haptiq_exp: number | null;
  current_project: string | null;
  upskilling_plan: string | null;
}

interface FormRecord {
  id: string;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
  updated_at: string;
  reminders_sent: number;
  manager_review_date: string | null;
  total_exp: number | null;
  relevant_exp: number | null;
  haptiq_exp: number | null;
  current_project: string | null;
  tools: string | null;
  databases: string | null;
  certifications: string[] | null;
  upskilling_plan: string | null;
  manager_expectation_plan: string | null;
  employee: {
    id: string;
    full_name: string;
    email: string;
    employee_number: string;
    designation: string;
    grade: string;
    manager_name: string;
  };
  skills: SkillItem[];
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

function formatDateLong(iso: string | null): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function daysPending(submittedAt: string | null, approvedAt: string | null): number | string {
  if (!submittedAt) return '';
  const end = approvedAt ? new Date(approvedAt) : new Date();
  const start = new Date(submittedAt);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

function safeStr(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function drawHaptiqHeader(doc: jsPDF, pageWidth: number): number {
  const headerHeight = 35;

  // Navy header background
  doc.setFillColor(26, 60, 94);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Teal accent line
  doc.setFillColor(0, 169, 206);
  doc.rect(0, headerHeight - 2, pageWidth, 2, 'F');

  // HAPTIQ logo text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('HAPTIQ', 15, 18);

  // Small teal underline under logo
  doc.setFillColor(0, 169, 206);
  doc.rect(15, 20, 40, 1.5, 'F');

  // SkillSync subtitle
  doc.setFontSize(9);
  doc.setTextColor(0, 169, 206);
  doc.text('SKILLSYNC', 15, 27);

  return headerHeight;
}

function drawSectionHeader(doc: jsPDF, title: string, y: number, pageWidth: number): number {
  const padding = 10;
  const headerHeight = 10;

  // Navy background for section header
  doc.setFillColor(26, 60, 94);
  doc.roundedRect(padding - 2, y, pageWidth - 2 * padding + 4, headerHeight, 2, 2, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, padding + 2, y + 6.5);

  return y + headerHeight + 5;
}

function drawInfoRow(doc: jsPDF, label: string, value: string, y: number, x1: number, x2: number): number {
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x1, y);

  doc.setTextColor(26, 60, 94);
  doc.setFont('helvetica', 'bold');
  doc.text(value || '-', x2, y);

  return y + 6;
}

function ratingDeltaText(current: number | null, prev: number | null): { text: string; color: [number, number, number] } {
  if (prev === null || current === null) return { text: '', color: [107, 114, 128] };
  const diff = current - prev;
  if (diff > 0) return { text: `+${diff}`, color: [5, 150, 105] };   // emerald
  if (diff < 0) return { text: `${diff}`, color: [220, 38, 38] };    // red
  return { text: '=', color: [107, 114, 128] };
}

function drawSkillTable(
  doc: jsPDF,
  title: string,
  skills: SkillItemWithDelta[],
  startY: number,
  pageWidth: number,
  pageHeight: number,
  hasPrev: boolean
): number {
  if (skills.length === 0) return startY;

  let y = startY;
  const padding = 10;
  const rowHeight = 8;

  // Column layout changes when we have previous cycle data
  const cols = hasPrev
    ? [0.28, 0.14, 0.08, 0.14, 0.08, 0.28]  // Skill, Self, Δ, Mgr, Δ, Comment
    : [0.35, 0.2, 0.2, 0.25];               // Skill, Self, Manager, Comment
  const widths = cols.map((c) => (pageWidth - 2 * padding) * c);

  const estimatedHeight = 14 + skills.length * rowHeight;
  if (y + estimatedHeight > pageHeight - 20) {
    doc.addPage();
    y = drawHaptiqHeader(doc, pageWidth) + 10;
  }

  y = drawSectionHeader(doc, title, y, pageWidth);

  // Table header
  doc.setFillColor(240, 247, 250);
  doc.rect(padding, y, pageWidth - 2 * padding, rowHeight, 'F');
  doc.setTextColor(26, 60, 94);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');

  let x = padding + 2;
  doc.text('Skill', x, y + 5);
  x += widths[0];
  doc.text('Self Rating', x, y + 5);
  x += widths[1];
  if (hasPrev) {
    doc.text('Chg', x, y + 5);
    x += widths[2];
  }
  doc.text('Mgr Rating', x, y + 5);
  x += widths[hasPrev ? 3 : 1];
  if (hasPrev) {
    doc.text('Chg', x, y + 5);
    x += widths[4];
  }
  doc.text('Comment', x, y + 5);

  y += rowHeight;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(55, 65, 81);

  skills.forEach((skill, idx) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = drawHaptiqHeader(doc, pageWidth) + 10;
    }

    // New skill highlight
    if (skill.is_new && hasPrev) {
      doc.setFillColor(240, 253, 244); // very light emerald
    } else if (idx % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(250, 252, 254);
    }
    doc.rect(padding, y, pageWidth - 2 * padding, rowHeight, 'F');

    doc.setDrawColor(229, 231, 235);
    doc.line(padding, y, padding + pageWidth - 2 * padding, y);

    x = padding + 2;

    // Skill name — with NEW badge if new
    doc.setTextColor(26, 60, 94);
    const nameStr = skill.name.substring(0, hasPrev ? 20 : 25);
    doc.text(nameStr, x, y + 5);
    if (skill.is_new && hasPrev) {
      const nameWidth = doc.getTextWidth(nameStr);
      doc.setFontSize(6);
      doc.setFillColor(5, 150, 105);
      doc.roundedRect(x + nameWidth + 1, y + 1, 8, 3.5, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('NEW', x + nameWidth + 1.5, y + 4);
      doc.setFontSize(7.5);
    }
    x += widths[0];

    // Self rating
    doc.setTextColor(55, 65, 81);
    const selfText = skill.employee_rating !== null ? `${skill.employee_rating}/5` : '-';
    const prevSelfText = (!skill.is_new && skill.prev_employee_rating !== null) ? ` (${skill.prev_employee_rating})` : '';
    doc.text(selfText + prevSelfText, x, y + 5);
    x += widths[1];

    // Self delta
    if (hasPrev) {
      if (!skill.is_new) {
        const delta = ratingDeltaText(skill.employee_rating, skill.prev_employee_rating);
        if (delta.text) {
          doc.setTextColor(...delta.color);
          doc.setFont('helvetica', 'bold');
          doc.text(delta.text, x, y + 5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(55, 65, 81);
        }
      }
      x += widths[2];
    }

    // Manager rating
    doc.setTextColor(55, 65, 81);
    const mgrText = skill.manager_rating !== null ? `${skill.manager_rating}/5` : '-';
    const prevMgrText = (!skill.is_new && skill.prev_manager_rating !== null) ? ` (${skill.prev_manager_rating})` : '';
    doc.text(mgrText + prevMgrText, x, y + 5);
    x += widths[hasPrev ? 3 : 1];

    // Manager delta
    if (hasPrev) {
      if (!skill.is_new) {
        const delta = ratingDeltaText(skill.manager_rating, skill.prev_manager_rating);
        if (delta.text) {
          doc.setTextColor(...delta.color);
          doc.setFont('helvetica', 'bold');
          doc.text(delta.text, x, y + 5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(55, 65, 81);
        }
      }
      x += widths[4];
    }

    // Comment
    const comment = (skill.manager_comment || '-').substring(0, hasPrev ? 25 : 30);
    doc.text(comment, x, y + 5);

    y += rowHeight;
  });

  doc.setDrawColor(229, 231, 235);
  doc.line(padding, y, padding + pageWidth - 2 * padding, y);

  return y + 8;
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let currentLine = '';

  const words = text.split(' ');
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = doc.getTextWidth(testLine);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [text];
}

function extractSnapshotSkills(snapshot: Record<string, unknown>): SkillItem[] {
  const items = snapshot.skill_items as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(items)) return [];
  return items.map((i) => ({
    category: (i.category as 'language' | 'framework') ?? 'language',
    name: (i.name as string) ?? '',
    employee_rating: (i.employee_rating as number | null) ?? null,
    manager_rating: (i.manager_rating as number | null) ?? null,
    manager_comment: (i.manager_comment as string | null) ?? null,
  }));
}

function mergeSkillsWithDelta(
  current: SkillItem[],
  prev: SkillItem[]
): SkillItemWithDelta[] {
  const prevMap = new Map(prev.map((s) => [s.name.toLowerCase(), s]));
  return current.map((s) => {
    const p = prevMap.get(s.name.toLowerCase());
    return {
      ...s,
      prev_employee_rating: p?.employee_rating ?? null,
      prev_manager_rating: p?.manager_rating ?? null,
      is_new: !p,
    };
  });
}

export async function exportSkillAssessmentReport(formId: string): Promise<void> {
  // Load current form + employee data in parallel with version history
  const [{ data: sf, error }, { data: versionsRaw }] = await Promise.all([
    db
      .from('skill_forms')
      .select(`id, status, submitted_at, approved_at, updated_at, cycle_id,
              total_exp, relevant_exp, haptiq_exp, current_project, tools, databases,
              certifications, upskilling_plan, manager_expectation_plan,
              users!skill_forms_employee_id_fkey(id, full_name, email, employee_number, designation, grade, manager_id)`)
      .eq('id', formId)
      .maybeSingle(),
    db
      .from('skill_form_versions')
      .select('id, cycle_id, snapshot, approved_at, review_cycles(name)')
      .eq('form_id', formId)
      .order('approved_at', { ascending: false }),
  ]);

  if (error || !sf) {
    throw new Error('Could not load form data');
  }

  const emp = sf.users as Record<string, unknown>;
  const managerId = emp?.manager_id as string | null;

  let managerName = '';
  if (managerId) {
    const { data: mgr } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', managerId)
      .maybeSingle();
    managerName = mgr?.full_name ?? '';
  }

  const { data: itemsRaw } = await supabase
    .from('skill_items')
    .select('category, name, employee_rating, manager_rating, manager_comment, sort_order')
    .eq('form_id', formId)
    .order('sort_order');

  const currentLanguages: SkillItem[] = (itemsRaw ?? [])
    .filter((i) => i.category === 'language');
  const currentFrameworks: SkillItem[] = (itemsRaw ?? [])
    .filter((i) => i.category === 'framework');

  // ── Previous cycle snapshot (the most-recently approved version other than current cycle) ──
  const versions = versionsRaw ?? [];
  // Filter out the version that matches the current cycle (if any)
  const prevVersions = versions.filter((v) => v.cycle_id !== sf.cycle_id);
  const latestPrevVersion = prevVersions[0] ?? null;

  let prevSnapshot: PrevSnapshot | null = null;
  if (latestPrevVersion) {
    const snap = latestPrevVersion.snapshot as Record<string, unknown>;
    const cycleName = (latestPrevVersion.review_cycles as Record<string, unknown> | null)?.name as string | undefined;
    const allPrevSkills = extractSnapshotSkills(snap);
    prevSnapshot = {
      cycle_name: cycleName ?? 'Previous Cycle',
      approved_at: latestPrevVersion.approved_at as string,
      skills: allPrevSkills,
      certifications: (snap.certifications as string[] | null)?.filter(Boolean) ?? [],
      tools: safeStr(snap.tools as string | null),
      databases: safeStr(snap.databases as string | null),
      total_exp: (snap.total_exp as number | null) ?? null,
      relevant_exp: (snap.relevant_exp as number | null) ?? null,
      haptiq_exp: (snap.haptiq_exp as number | null) ?? null,
      current_project: (snap.current_project as string | null) ?? null,
      upskilling_plan: (snap.upskilling_plan as string | null) ?? null,
    };
  }

  const hasPrev = !!prevSnapshot;

  // Build delta skill lists
  const prevLangs = prevSnapshot?.skills.filter((s) => s.category === 'language') ?? [];
  const prevFwks = prevSnapshot?.skills.filter((s) => s.category === 'framework') ?? [];
  const languagesWithDelta = mergeSkillsWithDelta(currentLanguages, prevLangs);
  const frameworksWithDelta = mergeSkillsWithDelta(currentFrameworks, prevFwks);

  // Compute "what's new" summary
  const newLanguages = languagesWithDelta.filter((s) => s.is_new);
  const newFrameworks = frameworksWithDelta.filter((s) => s.is_new);
  const currentCerts = (sf.certifications as string[] | null)?.filter(Boolean) ?? [];
  const prevCerts = new Set((prevSnapshot?.certifications ?? []).map((c) => c.toLowerCase().trim()));
  const newCerts = currentCerts.filter((c) => !prevCerts.has(c.toLowerCase().trim()));
  const prevToolSet = new Set((prevSnapshot?.tools ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  const newTools = (safeStr(sf.tools) || '').split(',').map((s) => s.trim()).filter((s) => s && !prevToolSet.has(s.toLowerCase()));

  // Create PDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const padding = 10;

  let y = drawHaptiqHeader(doc, pageWidth) + 10;

  // Title + subtitle
  doc.setTextColor(26, 60, 94);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Skill Assessment Report', padding, y);
  y += 8;

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, padding, y);
  y += 10;

  // ── Cycle comparison banner ───────────────────────────────────────────────
  if (hasPrev && prevSnapshot) {
    doc.setFillColor(0, 169, 206);
    doc.roundedRect(padding - 2, y, pageWidth - 2 * padding + 4, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Comparing with previous cycle: ${prevSnapshot.cycle_name}  (approved ${new Date(prevSnapshot.approved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})`,
      padding + 2, y + 7.5
    );
    y += 18;

    // Legend row
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    const legendItems: Array<{ label: string; color: [number, number, number] }> = [
      { label: 'Improved', color: [5, 150, 105] },
      { label: 'Declined', color: [220, 38, 38] },
      { label: 'Unchanged', color: [107, 114, 128] },
    ];
    let lx = padding + 2;
    legendItems.forEach(({ label, color }) => {
      doc.setTextColor(...color);
      doc.setFont('helvetica', 'bold');
      doc.text('■', lx, y);
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'normal');
      doc.text(label, lx + 4, y);
      lx += 30;
    });
    doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.text('■', lx, y);
    doc.setTextColor(55, 65, 81);
    doc.setFont('helvetica', 'normal');
    doc.text('NEW — added since last cycle', lx + 4, y);
    y += 8;
  }

  // ── Employee Profile ──────────────────────────────────────────────────────
  y = drawSectionHeader(doc, 'Employee Profile', y, pageWidth);
  y += 4;

  const col1x = padding + 2;
  const col2x = pageWidth / 2 + 5;

  let rowY = y;
  rowY = drawInfoRow(doc, 'Name:', (emp?.full_name as string) || '-', rowY, col1x, col1x + 25);
  rowY = drawInfoRow(doc, 'Email:', (emp?.email as string) || '-', rowY, col1x, col1x + 25);
  rowY = drawInfoRow(doc, 'Employee No:', (emp?.employee_number as string) || '-', rowY, col1x, col1x + 25);

  let rowY2 = y;
  rowY2 = drawInfoRow(doc, 'Designation:', (emp?.designation as string) || '-', rowY2, col2x, col2x + 25);
  rowY2 = drawInfoRow(doc, 'Grade:', (emp?.grade as string) || '-', rowY2, col2x, col2x + 25);
  rowY2 = drawInfoRow(doc, 'Manager:', managerName || '-', rowY2, col2x, col2x + 25);

  y = Math.max(rowY, rowY2) + 4;

  // ── Experience ────────────────────────────────────────────────────────────
  y = drawSectionHeader(doc, 'Experience', y, pageWidth);
  y += 4;

  rowY = y;

  function expVal(curr: number | null, prev: number | null): string {
    if (curr === null) return '-';
    let txt = `${curr} yrs`;
    if (prev !== null && prev !== curr) {
      const diff = curr - prev;
      txt += diff > 0 ? `  (+${diff})` : `  (${diff})`;
    }
    return txt;
  }

  rowY = drawInfoRow(doc, 'Total Experience:', expVal(sf.total_exp, prevSnapshot?.total_exp ?? null), rowY, col1x, col1x + 35);
  rowY = drawInfoRow(doc, 'Relevant Experience:', expVal(sf.relevant_exp, prevSnapshot?.relevant_exp ?? null), rowY, col1x, col1x + 35);
  rowY = drawInfoRow(doc, 'Haptiq Experience:', expVal(sf.haptiq_exp, prevSnapshot?.haptiq_exp ?? null), rowY, col1x, col1x + 35);

  rowY2 = y;
  const projChanged = hasPrev && prevSnapshot?.current_project && prevSnapshot.current_project !== sf.current_project;
  const projLabel = projChanged ? `${sf.current_project || '-'}  (was: ${prevSnapshot!.current_project})` : sf.current_project || '-';
  rowY2 = drawInfoRow(doc, 'Current Project:', projLabel.substring(0, 40), rowY2, col2x, col2x + 35);

  y = Math.max(rowY, rowY2) + 4;

  // ── Assessment Details ────────────────────────────────────────────────────
  y = drawSectionHeader(doc, 'Assessment Details', y, pageWidth);
  y += 4;

  rowY = y;
  rowY = drawInfoRow(doc, 'Status:', titleCase(sf.status), rowY, col1x, col1x + 20);
  rowY = drawInfoRow(doc, 'Submitted:', formatDateLong(sf.submitted_at), rowY, col1x, col1x + 20);
  rowY = drawInfoRow(doc, 'Approved:', formatDateLong(sf.approved_at), rowY, col1x, col1x + 20);

  y = rowY + 8;

  // ── Skills tables with delta ──────────────────────────────────────────────
  y = drawSkillTable(doc, 'Programming Languages', languagesWithDelta, y, pageWidth, pageHeight, hasPrev);
  y = drawSkillTable(doc, 'Frameworks', frameworksWithDelta, y, pageWidth, pageHeight, hasPrev);

  // ── What's New section (only when previous cycle exists) ─────────────────
  const hasNewItems = hasPrev && (newLanguages.length > 0 || newFrameworks.length > 0 || newCerts.length > 0 || newTools.length > 0);
  if (hasNewItems) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = drawHaptiqHeader(doc, pageWidth) + 10;
    }

    // Teal header for "What's New"
    doc.setFillColor(0, 169, 206);
    doc.roundedRect(padding - 2, y, pageWidth - 2 * padding + 4, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('What\'s New Since Last Assessment', padding + 2, y + 6.5);
    y += 15;

    function drawNewList(label: string, items: string[]) {
      if (items.length === 0) return;
      doc.setTextColor(26, 60, 94);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(label, col1x, y);
      y += 5;
      items.forEach((item) => {
        if (y > pageHeight - 15) {
          doc.addPage();
          y = drawHaptiqHeader(doc, pageWidth) + 10;
        }
        doc.setFillColor(5, 150, 105);
        doc.circle(col1x + 1.5, y - 1.5, 1.5, 'F');
        doc.setTextColor(55, 65, 81);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.text(item, col1x + 6, y);
        y += 5.5;
      });
      y += 2;
    }

    drawNewList('New Programming Languages:', newLanguages.map((s) => s.name));
    drawNewList('New Frameworks:', newFrameworks.map((s) => s.name));
    drawNewList('New Certifications:', newCerts);
    drawNewList('New Tools & Technologies:', newTools);
  }

  // ── Additional Skills ─────────────────────────────────────────────────────
  if (y > pageHeight - 60) {
    doc.addPage();
    y = drawHaptiqHeader(doc, pageWidth) + 10;
  }

  y = drawSectionHeader(doc, 'Additional Skills', y, pageWidth);
  y += 4;

  rowY = y;
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Tools & Technologies:', col1x, rowY);
  doc.setTextColor(26, 60, 94);
  doc.setFont('helvetica', 'bold');
  doc.text((safeStr(sf.tools) || '-').substring(0, 80), col1x + 35, rowY);
  rowY += 6;

  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  doc.text('Databases:', col1x, rowY);
  doc.setTextColor(26, 60, 94);
  doc.setFont('helvetica', 'bold');
  doc.text((safeStr(sf.databases) || '-').substring(0, 80), col1x + 35, rowY);
  y = rowY + 8;

  // ── Certifications ────────────────────────────────────────────────────────
  if (y > pageHeight - 50) {
    doc.addPage();
    y = drawHaptiqHeader(doc, pageWidth) + 10;
  }

  y = drawSectionHeader(doc, 'Certifications', y, pageWidth);
  y += 4;

  const certs = currentCerts;
  if (certs.length === 0) {
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(9);
    doc.text('No certifications listed', col1x, y);
    y += 6;
  } else {
    certs.forEach((cert) => {
      if (y > pageHeight - 15) {
        doc.addPage();
        y = drawHaptiqHeader(doc, pageWidth) + 10;
      }
      const isNewCert = hasPrev && !prevCerts.has(cert.toLowerCase().trim());
      if (isNewCert) {
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(padding, y - 4, pageWidth - 2 * padding, 6, 1, 1, 'F');
      }
      doc.setTextColor(isNewCert ? 5 : 26, isNewCert ? 150 : 60, isNewCert ? 105 : 94);
      doc.setFontSize(9);
      doc.setFont('helvetica', isNewCert ? 'bold' : 'normal');
      doc.text(cert + (isNewCert ? '  [NEW]' : ''), col1x + 3, y);
      y += 6;
    });
  }
  y += 4;

  // ── Development Plans ─────────────────────────────────────────────────────
  if (y > pageHeight - 80) {
    doc.addPage();
    y = drawHaptiqHeader(doc, pageWidth) + 10;
  }

  y = drawSectionHeader(doc, 'Development Plans', y, pageWidth);
  y += 6;

  doc.setTextColor(26, 60, 94);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('6-Month Upskilling Plan (Employee)', col1x, y);
  y += 5;

  doc.setTextColor(55, 65, 81);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const upskillText = safeStr(sf.upskilling_plan) || 'Not specified';
  const upskillLines = wrapText(doc, upskillText, pageWidth - 2 * padding - 5);
  upskillLines.forEach((line) => {
    if (y > pageHeight - 15) {
      doc.addPage();
      y = drawHaptiqHeader(doc, pageWidth) + 10;
    }
    doc.text(line, col1x + 3, y);
    y += 5;
  });
  y += 6;

  if (y > pageHeight - 30) {
    doc.addPage();
    y = drawHaptiqHeader(doc, pageWidth) + 10;
  }

  doc.setTextColor(26, 60, 94);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Manager Expectation Plan', col1x, y);
  y += 5;

  doc.setTextColor(55, 65, 81);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const expectationText = safeStr(sf.manager_expectation_plan) || 'Not specified';
  const expectationLines = wrapText(doc, expectationText, pageWidth - 2 * padding - 5);
  expectationLines.forEach((line) => {
    if (y > pageHeight - 15) {
      doc.addPage();
      y = drawHaptiqHeader(doc, pageWidth) + 10;
    }
    doc.text(line, col1x + 3, y);
    y += 5;
  });

  // ── Comparison with previous upskilling plan ──────────────────────────────
  if (hasPrev && prevSnapshot?.upskilling_plan) {
    y += 6;
    if (y > pageHeight - 30) {
      doc.addPage();
      y = drawHaptiqHeader(doc, pageWidth) + 10;
    }
    doc.setTextColor(0, 169, 206);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Previous cycle upskilling plan (${prevSnapshot.cycle_name}):`, col1x, y);
    y += 5;
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'italic');
    const prevLines = wrapText(doc, prevSnapshot.upskilling_plan, pageWidth - 2 * padding - 5);
    prevLines.slice(0, 4).forEach((line) => {
      doc.text(line, col1x + 3, y);
      y += 4.5;
    });
    if (prevLines.length > 4) {
      doc.text('…', col1x + 3, y);
    }
  }

  // ── Footer on all pages ───────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(229, 231, 235);
    doc.line(padding, pageHeight - 15, pageWidth - padding, pageHeight - 15);
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Haptiq SkillSync - Confidential', padding, pageHeight - 10);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - padding - 20, pageHeight - 10);
  }

  const employeeName = (emp?.full_name as string) ?? 'employee';
  const filename = `skill-assessment-${employeeName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

export async function exportSkillAssessmentFromSnapshot(
  snapshot: Record<string, unknown>,
  cycleName: string,
  approvedAt: string,
): Promise<void> {
  // Build form-like data entirely from the snapshot JSON — no live DB row needed.
  const skillItems = extractSnapshotSkills(snapshot);
  const currentLanguages: SkillItem[] = skillItems.filter((s) => s.category === 'language');
  const currentFrameworks: SkillItem[] = skillItems.filter((s) => s.category === 'framework');
  const currentEnvironments: SkillItem[] = skillItems.filter(
    (s) => (s.category as string) === 'environment'
  );

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const padding = 10;
  const col1x = padding + 2;
  const col2x = pageWidth / 2 + 5;

  let y = drawHaptiqHeader(doc, pageWidth) + 10;

  doc.setTextColor(26, 60, 94);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Skill Assessment Report', padding, y);
  y += 8;

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, padding, y);
  y += 10;

  // ── Employee Profile ──────────────────────────────────────────────────────
  y = drawSectionHeader(doc, 'Employee Profile', y, pageWidth);
  y += 4;

  let rowY = y;
  rowY = drawInfoRow(doc, 'Name:', safeStr(snapshot.employee_name as string), rowY, col1x, col1x + 25);
  rowY = drawInfoRow(doc, 'Email:', safeStr(snapshot.employee_email as string), rowY, col1x, col1x + 25);
  rowY = drawInfoRow(doc, 'Employee No:', safeStr(snapshot.employee_number as string), rowY, col1x, col1x + 25);

  let rowY2 = y;
  rowY2 = drawInfoRow(doc, 'Designation:', safeStr(snapshot.designation as string), rowY2, col2x, col2x + 25);
  rowY2 = drawInfoRow(doc, 'Grade:', safeStr(snapshot.grade as string), rowY2, col2x, col2x + 25);

  y = Math.max(rowY, rowY2) + 4;

  // ── Experience ────────────────────────────────────────────────────────────
  y = drawSectionHeader(doc, 'Experience', y, pageWidth);
  y += 4;

  rowY = y;
  rowY = drawInfoRow(doc, 'Total Experience:', `${snapshot.total_exp ?? '-'} yrs`, rowY, col1x, col1x + 35);
  rowY = drawInfoRow(doc, 'Relevant Experience:', `${snapshot.relevant_exp ?? '-'} yrs`, rowY, col1x, col1x + 35);
  rowY = drawInfoRow(doc, 'Haptiq Experience:', `${snapshot.haptiq_exp ?? '-'} yrs`, rowY, col1x, col1x + 35);

  rowY2 = y;
  rowY2 = drawInfoRow(doc, 'Current Project:', safeStr(snapshot.current_project as string) || '-', rowY2, col2x, col2x + 35);

  y = Math.max(rowY, rowY2) + 4;

  // ── Assessment Details ────────────────────────────────────────────────────
  y = drawSectionHeader(doc, 'Assessment Details', y, pageWidth);
  y += 4;

  rowY = y;
  rowY = drawInfoRow(doc, 'Cycle:', cycleName, rowY, col1x, col1x + 20);
  rowY = drawInfoRow(doc, 'Status:', 'Approved', rowY, col1x, col1x + 20);
  rowY = drawInfoRow(doc, 'Approved:', formatDateLong(approvedAt), rowY, col1x, col1x + 20);

  y = rowY + 8;

  // ── Skills ────────────────────────────────────────────────────────────────
  const noDeltas = (items: SkillItem[]): SkillItemWithDelta[] =>
    items.map((s) => ({ ...s, prev_employee_rating: null, prev_manager_rating: null, is_new: false }));

  y = drawSkillTable(doc, 'Programming Languages', noDeltas(currentLanguages), y, pageWidth, pageHeight, false);
  y = drawSkillTable(doc, 'Frameworks', noDeltas(currentFrameworks), y, pageWidth, pageHeight, false);
  if (currentEnvironments.length > 0) {
    y = drawSkillTable(doc, 'Environments', noDeltas(currentEnvironments), y, pageWidth, pageHeight, false);
  }

  // ── Additional Skills ─────────────────────────────────────────────────────
  if (y > pageHeight - 60) { doc.addPage(); y = drawHaptiqHeader(doc, pageWidth) + 10; }
  y = drawSectionHeader(doc, 'Additional Skills', y, pageWidth);
  y += 4;

  rowY = y;
  doc.setTextColor(107, 114, 128); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Tools & Technologies:', col1x, rowY);
  doc.setTextColor(26, 60, 94); doc.setFont('helvetica', 'bold');
  doc.text((safeStr(snapshot.tools as string) || '-').substring(0, 80), col1x + 35, rowY);
  rowY += 6;

  doc.setTextColor(107, 114, 128); doc.setFont('helvetica', 'normal');
  doc.text('Databases:', col1x, rowY);
  doc.setTextColor(26, 60, 94); doc.setFont('helvetica', 'bold');
  doc.text((safeStr(snapshot.databases as string) || '-').substring(0, 80), col1x + 35, rowY);
  y = rowY + 8;

  // ── Certifications ────────────────────────────────────────────────────────
  if (y > pageHeight - 50) { doc.addPage(); y = drawHaptiqHeader(doc, pageWidth) + 10; }
  y = drawSectionHeader(doc, 'Certifications', y, pageWidth);
  y += 4;

  const certs = (snapshot.certifications as string[] | null)?.filter(Boolean) ?? [];
  if (certs.length === 0) {
    doc.setTextColor(107, 114, 128); doc.setFontSize(9);
    doc.text('No certifications listed', col1x, y); y += 6;
  } else {
    certs.forEach((cert) => {
      if (y > pageHeight - 15) { doc.addPage(); y = drawHaptiqHeader(doc, pageWidth) + 10; }
      doc.setTextColor(26, 60, 94); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(cert, col1x + 3, y); y += 6;
    });
  }
  y += 4;

  // ── Development Plans ─────────────────────────────────────────────────────
  if (y > pageHeight - 80) { doc.addPage(); y = drawHaptiqHeader(doc, pageWidth) + 10; }
  y = drawSectionHeader(doc, 'Development Plans', y, pageWidth);
  y += 6;

  doc.setTextColor(26, 60, 94); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('6-Month Upskilling Plan (Employee)', col1x, y); y += 5;
  doc.setTextColor(55, 65, 81); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  wrapText(doc, safeStr(snapshot.upskilling_plan as string) || 'Not specified', pageWidth - 2 * padding - 5).forEach((line) => {
    if (y > pageHeight - 15) { doc.addPage(); y = drawHaptiqHeader(doc, pageWidth) + 10; }
    doc.text(line, col1x + 3, y); y += 5;
  });
  y += 6;

  if (snapshot.manager_expectation_plan) {
    if (y > pageHeight - 30) { doc.addPage(); y = drawHaptiqHeader(doc, pageWidth) + 10; }
    doc.setTextColor(26, 60, 94); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Manager Expectation Plan', col1x, y); y += 5;
    doc.setTextColor(55, 65, 81); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    wrapText(doc, safeStr(snapshot.manager_expectation_plan as string), pageWidth - 2 * padding - 5).forEach((line) => {
      if (y > pageHeight - 15) { doc.addPage(); y = drawHaptiqHeader(doc, pageWidth) + 10; }
      doc.text(line, col1x + 3, y); y += 5;
    });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(229, 231, 235);
    doc.line(padding, pageHeight - 15, pageWidth - padding, pageHeight - 15);
    doc.setTextColor(107, 114, 128); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('Haptiq SkillSync - Confidential', padding, pageHeight - 10);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - padding - 20, pageHeight - 10);
  }

  const empName = safeStr(snapshot.employee_name as string) || 'employee';
  const filename = `skill-assessment-${empName.toLowerCase().replace(/\s+/g, '-')}-${cycleName.toLowerCase().replace(/\s+/g, '-')}.pdf`;
  doc.save(filename);
}

export async function exportToExcel(filters: ExportFilters = {}): Promise<void> {
  let query = supabase
    .from('skill_forms')
    .select(
      `id, status, submitted_at, approved_at, updated_at, reminders_sent, manager_review_date,
       total_exp, relevant_exp, haptiq_exp, current_project, tools, databases,
       certifications, upskilling_plan, manager_expectation_plan,
       users!skill_forms_employee_id_fkey(id, full_name, email, employee_number, designation, grade, manager_id)`
    )
    .order('updated_at', { ascending: false });

  if (filters.fromDate) query = query.gte('submitted_at', filters.fromDate);
  if (filters.toDate) query = query.lte('submitted_at', filters.toDate + 'T23:59:59');
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

  const formIds = (formsRaw ?? []).map((f) => f.id);
  let skillsMap: Record<string, SkillItem[]> = {};
  if (formIds.length > 0) {
    const { data: itemsRaw } = await supabase
      .from('skill_items')
      .select('form_id, category, name, employee_rating, manager_rating, sort_order')
      .in('form_id', formIds)
      .order('sort_order');
    if (itemsRaw) {
      itemsRaw.forEach((item) => {
        if (!skillsMap[item.form_id]) skillsMap[item.form_id] = [];
        skillsMap[item.form_id].push({
          category: item.category as 'language' | 'framework',
          name: item.name,
          employee_rating: item.employee_rating,
          manager_rating: item.manager_rating,
        });
      });
    }
  }

  const forms: FormRecord[] = (formsRaw ?? []).map((f) => {
    const u = f.users as Record<string, unknown> | null;
    return {
      id: f.id,
      status: f.status,
      submitted_at: f.submitted_at,
      approved_at: f.approved_at ?? null,
      updated_at: f.updated_at,
      reminders_sent: f.reminders_sent ?? 0,
      manager_review_date: f.manager_review_date ?? null,
      total_exp: f.total_exp ?? null,
      relevant_exp: f.relevant_exp ?? null,
      haptiq_exp: f.haptiq_exp ?? null,
      current_project: f.current_project ?? null,
      tools: f.tools ?? null,
      databases: f.databases ?? null,
      certifications: (f.certifications as string[] | null) ?? null,
      upskilling_plan: f.upskilling_plan ?? null,
      manager_expectation_plan: f.manager_expectation_plan ?? null,
      employee: {
        id: safeStr(u?.id as string),
        full_name: safeStr(u?.full_name as string),
        email: safeStr(u?.email as string),
        employee_number: safeStr(u?.employee_number as string),
        designation: safeStr(u?.designation as string),
        grade: safeStr(u?.grade as string),
        manager_name: u?.manager_id ? (managersMap[u.manager_id as string] || '') : '',
      },
      skills: skillsMap[f.id] ?? [],
    };
  });

  if (filters.status === 'not_started') {
    const { data: employees } = await supabase
      .from('users')
      .select('id, full_name, email, employee_number, designation, grade, manager_id')
      .eq('role', 'employee');

    const formEmployeeIds = new Set(forms.map((f) => f.employee.id));
    const notStarted: FormRecord[] = (employees ?? [])
      .filter((e) => !formEmployeeIds.has(e.id))
      .map((e) => ({
        id: '',
        status: 'not_started',
        submitted_at: null,
        approved_at: null,
        updated_at: '',
        reminders_sent: 0,
        manager_review_date: null,
        total_exp: null,
        relevant_exp: null,
        haptiq_exp: null,
        current_project: null,
        tools: null,
        databases: null,
        certifications: null,
        upskilling_plan: null,
        manager_expectation_plan: null,
        employee: {
          id: e.id,
          full_name: e.full_name,
          email: e.email,
          employee_number: e.employee_number || '',
          designation: e.designation || '',
          grade: e.grade || '',
          manager_name: e.manager_id ? (managersMap[e.manager_id] || '') : '',
        },
        skills: [],
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
    const langs = f.skills.filter((s) => s.category === 'language');
    const fwks = f.skills.filter((s) => s.category === 'framework');

    sheet1Data.push([
      f.employee.full_name,
      f.employee.email,
      f.employee.employee_number,
      f.employee.designation,
      f.employee.grade,
      safeStr(f.total_exp),
      safeStr(f.relevant_exp),
      safeStr(f.haptiq_exp),
      safeStr(f.current_project),
      f.employee.manager_name,
      langs.map((s) => s.name).join('; '),
      langs.map((s) => safeStr(s.employee_rating)).join('; '),
      langs.map((s) => safeStr(s.manager_rating)).join('; '),
      fwks.map((s) => s.name).join('; '),
      fwks.map((s) => safeStr(s.employee_rating)).join('; '),
      fwks.map((s) => safeStr(s.manager_rating)).join('; '),
      safeStr(f.tools),
      safeStr(f.databases),
      (f.certifications ?? []).filter(Boolean).join('; '),
      safeStr(f.upskilling_plan),
      safeStr(f.manager_expectation_plan),
      titleCase(f.status),
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
      titleCase(f.status),
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

export async function exportSkillsMatrix(): Promise<void> {
  const [formsRes, itemsRes] = await Promise.all([
    db.from('skill_forms').select('id, status, tools, databases, certifications'),
    db.from('skill_items').select('category, name, employee_rating, manager_rating'),
  ]);

  const forms = formsRes.data ?? [];
  const items = itemsRes.data ?? [];

  function aggregateSkillItems(category: 'language' | 'framework'): Array<{ name: string; count: number; avg_employee: number; avg_manager: number }> {
    const map = new Map<string, { emp: number[]; mgr: number[] }>();
    items
      .filter((i) => i.category === category && i.employee_rating !== null)
      .forEach((i) => {
        if (!map.has(i.name)) map.set(i.name, { emp: [], mgr: [] });
        const entry = map.get(i.name)!;
        entry.emp.push(Number(i.employee_rating));
        if (i.manager_rating !== null) entry.mgr.push(Number(i.manager_rating));
      });
    const result: Array<{ name: string; count: number; avg_employee: number; avg_manager: number }> = [];
    map.forEach((v, name) => {
      const avg_emp = v.emp.length ? v.emp.reduce((a, b) => a + b, 0) / v.emp.length : 0;
      const avg_mgr = v.mgr.length ? v.mgr.reduce((a, b) => a + b, 0) / v.mgr.length : 0;
      result.push({
        name,
        count: v.emp.length,
        avg_employee: Math.round(avg_emp * 100) / 100,
        avg_manager: Math.round(avg_mgr * 100) / 100,
      });
    });
    return result.sort((a, b) => b.count - a.count);
  }

  function aggregateText(field: 'tools' | 'databases'): Array<{ name: string; count: number }> {
    const map = new Map<string, number>();
    forms.forEach((f) => {
      const raw: string = (f[field] as string) ?? '';
      raw.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((t: string) => {
        map.set(t, (map.get(t) ?? 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  const wb = XLSX.utils.book_new();
  wb.Props = { Title: 'SkillSync Skills Matrix', Author: 'SkillSync' };

  const languages = aggregateSkillItems('language');
  const frameworks = aggregateSkillItems('framework');
  const tools = aggregateText('tools');
  const databases = aggregateText('databases');

  const sheetHeaders = ['Name', 'Count', 'Avg Self Rating', 'Avg Manager Rating'];
  const sheetData: unknown[][] = [sheetHeaders];

  languages.forEach((row) => {
    sheetData.push([row.name, row.count, row.avg_employee, row.avg_manager]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = autoWidth(sheetData);
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  applyHeaderStyle(ws, XLSX.utils.decode_range(ws['!ref'] ?? 'A1'));
  XLSX.utils.book_append_sheet(wb, ws, 'Languages');

  const fwkHeaders = ['Name', 'Count', 'Avg Self Rating', 'Avg Manager Rating'];
  const fwkData: unknown[][] = [fwkHeaders];
  frameworks.forEach((row) => {
    fwkData.push([row.name, row.count, row.avg_employee, row.avg_manager]);
  });
  const fwkWs = XLSX.utils.aoa_to_sheet(fwkData);
  fwkWs['!cols'] = autoWidth(fwkData);
  fwkWs['!freeze'] = { xSplit: 0, ySplit: 1 };
  applyHeaderStyle(fwkWs, XLSX.utils.decode_range(fwkWs['!ref'] ?? 'A1'));
  XLSX.utils.book_append_sheet(wb, fwkWs, 'Frameworks');

  const txtHeaders = ['Name', 'Count'];
  const toolsData: unknown[][] = [txtHeaders];
  tools.forEach((row) => {
    toolsData.push([row.name, row.count]);
  });
  const toolsWs = XLSX.utils.aoa_to_sheet(toolsData);
  toolsWs['!cols'] = autoWidth(toolsData);
  toolsWs['!freeze'] = { xSplit: 0, ySplit: 1 };
  applyHeaderStyle(toolsWs, XLSX.utils.decode_range(toolsWs['!ref'] ?? 'A1'));
  XLSX.utils.book_append_sheet(wb, toolsWs, 'Tools');

  const dbData: unknown[][] = [txtHeaders];
  databases.forEach((row) => {
    dbData.push([row.name, row.count]);
  });
  const dbWs = XLSX.utils.aoa_to_sheet(dbData);
  dbWs['!cols'] = autoWidth(dbData);
  dbWs['!freeze'] = { xSplit: 0, ySplit: 1 };
  applyHeaderStyle(dbWs, XLSX.utils.decode_range(dbWs['!ref'] ?? 'A1'));
  XLSX.utils.book_append_sheet(wb, dbWs, 'Databases');

  const filename = `skillsync-matrix-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export async function exportSkillSettings(): Promise<void> {
  const tables = [
    { key: 'settings_certifications', sheet: 'Certifications' },
    { key: 'settings_languages', sheet: 'Languages' },
    { key: 'settings_frameworks', sheet: 'Frameworks' },
    { key: 'settings_tools', sheet: 'Tools' },
    { key: 'settings_databases', sheet: 'Databases' },
  ] as const;

  const results = await Promise.all(
    tables.map(({ key }) =>
      db.from(key).select('name, is_active').order('name')
    )
  );

  const wb = XLSX.utils.book_new();
  wb.Props = { Title: 'SkillSync Skill Settings', Author: 'SkillSync' };

  tables.forEach(({ sheet }, i) => {
    const rows = (results[i].data ?? []) as Array<{ name: string; is_active: boolean }>;
    const data: unknown[][] = [[sheet, 'Status']];
    rows.forEach((row) => {
      data.push([row.name, row.is_active ? 'Active' : 'Inactive']);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = autoWidth(data);
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    applyHeaderStyle(ws, XLSX.utils.decode_range(ws['!ref'] ?? 'A1'));
    XLSX.utils.book_append_sheet(wb, ws, sheet);
  });

  const filename = `skillsync-skill-settings-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export async function exportEmpSettings(): Promise<void> {
  const [gradesRes, designationsRes] = await Promise.all([
    db.from('settings_grades').select('name, is_active').order('name'),
    db.from('settings_designations').select('name, is_active').order('name'),
  ]);

  const grades = (gradesRes.data ?? []) as Array<{ name: string; is_active: boolean }>;
  const designations = (designationsRes.data ?? []) as Array<{ name: string; is_active: boolean }>;

  const wb = XLSX.utils.book_new();
  wb.Props = { Title: 'SkillSync Emp Settings', Author: 'SkillSync' };

  const gradesHeaders = ['Grade', 'Status'];
  const gradesData: unknown[][] = [gradesHeaders];
  grades.forEach((row) => {
    gradesData.push([row.name, row.is_active ? 'Active' : 'Inactive']);
  });
  const gradesWs = XLSX.utils.aoa_to_sheet(gradesData);
  gradesWs['!cols'] = autoWidth(gradesData);
  gradesWs['!freeze'] = { xSplit: 0, ySplit: 1 };
  applyHeaderStyle(gradesWs, XLSX.utils.decode_range(gradesWs['!ref'] ?? 'A1'));
  XLSX.utils.book_append_sheet(wb, gradesWs, 'Grades');

  const desigHeaders = ['Designation', 'Status'];
  const desigData: unknown[][] = [desigHeaders];
  designations.forEach((row) => {
    desigData.push([row.name, row.is_active ? 'Active' : 'Inactive']);
  });
  const desigWs = XLSX.utils.aoa_to_sheet(desigData);
  desigWs['!cols'] = autoWidth(desigData);
  desigWs['!freeze'] = { xSplit: 0, ySplit: 1 };
  applyHeaderStyle(desigWs, XLSX.utils.decode_range(desigWs['!ref'] ?? 'A1'));
  XLSX.utils.book_append_sheet(wb, desigWs, 'Designations');

  const filename = `skillsync-settings-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
