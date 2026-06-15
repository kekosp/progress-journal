import { ReportCategory, ReportPriority } from '@/types/report';

export interface ReportTemplate {
  id: string;
  name: string;
  category: ReportCategory;
  priority: ReportPriority;
  title: string;
  description: string;
  notes: string;
  projectName: string;
  location: string;
  createdAt: string;
}

const KEY = 'report-templates';

export function getTemplates(): ReportTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch { return []; }
}

export function saveTemplate(t: ReportTemplate): void {
  const all = getTemplates();
  const idx = all.findIndex(x => x.id === t.id);
  if (idx >= 0) all[idx] = t; else all.unshift(t);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteTemplate(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(getTemplates().filter(t => t.id !== id)));
}

export function generateTemplateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
