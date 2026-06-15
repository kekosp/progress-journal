export interface ReportComment {
  id: string;
  reportId: string;
  text: string;
  author: string;
  createdAt: string;
  type: 'note' | 'status-change' | 'update';
}

const KEY = 'report-comments';

export function getComments(reportId: string): ReportComment[] {
  try {
    const all: ReportComment[] = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return all.filter(c => c.reportId === reportId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch { return []; }
}

export function addComment(comment: Omit<ReportComment, 'id' | 'createdAt'>): ReportComment {
  const all: ReportComment[] = JSON.parse(localStorage.getItem(KEY) ?? '[]');
  const full: ReportComment = {
    ...comment,
    id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  all.push(full);
  localStorage.setItem(KEY, JSON.stringify(all));
  return full;
}

export function deleteComment(id: string): void {
  const all: ReportComment[] = JSON.parse(localStorage.getItem(KEY) ?? '[]');
  localStorage.setItem(KEY, JSON.stringify(all.filter(c => c.id !== id)));
}
