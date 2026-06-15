import { useState, useEffect, useRef } from 'react';
import { ReportComment, getComments, addComment, deleteComment } from '@/lib/comment-storage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { MessageSquare, Send, Trash2, AlertCircle, FileText, PenLine } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  reportId: string;
}

const TYPE_ICON = {
  note: <MessageSquare className="w-3 h-3" />,
  'status-change': <AlertCircle className="w-3 h-3" />,
  update: <PenLine className="w-3 h-3" />,
};

const TYPE_COLOR = {
  note: 'text-blue-400',
  'status-change': 'text-orange-400',
  update: 'text-green-400',
};

export function ReportComments({ reportId }: Props) {
  const [comments, setComments] = useState<ReportComment[]>(() => getComments(reportId));
  const [text, setText] = useState('');
  const [author, setAuthor] = useState(() => localStorage.getItem('comment-author') ?? '');
  const [type, setType] = useState<ReportComment['type']>('note');
  const [showForm, setShowForm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSubmit = () => {
    if (!text.trim()) return;
    const authorName = author.trim() || 'Anonymous';
    localStorage.setItem('comment-author', authorName);
    const c = addComment({ reportId, text: text.trim(), author: authorName, type });
    setComments(prev => [...prev, c]);
    setText('');
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    deleteComment(id);
    setComments(getComments(reportId));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Updates & Comments {comments.length > 0 && `(${comments.length})`}
        </h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-xs text-primary font-medium flex items-center gap-1 hover:opacity-80">
          <Send className="w-3 h-3" /> Add
        </button>
      </div>

      {/* Add comment form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <Input
            value={author}
            onChange={e => setAuthor(e.target.value)}
            placeholder="Your name (saved for next time)"
            className="h-8 text-xs bg-background"
          />
          {/* Type selector */}
          <div className="flex gap-1">
            {(['note', 'update', 'status-change'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 text-[10px] py-1 rounded-lg border capitalize transition-colors font-medium
                  ${type === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}>
                {t === 'status-change' ? 'Status' : t}
              </button>
            ))}
          </div>
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={
              type === 'note' ? 'Add a comment or observation…'
              : type === 'update' ? 'Describe what was updated…'
              : 'Describe the status change…'
            }
            className="text-sm min-h-[80px] bg-background resize-none"
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSubmit} disabled={!text.trim()}>
              <Send className="w-3 h-3" /> Post
            </Button>
          </div>
        </div>
      )}

      {/* Thread */}
      {comments.length === 0 && !showForm ? (
        <div className="text-center py-6 bg-muted/30 rounded-xl border border-dashed border-border">
          <MessageSquare className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No updates yet. Tap <strong>Add</strong> to post the first comment.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2 group">
              {/* Timeline dot */}
              <div className="flex flex-col items-center pt-1">
                <div className={`w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0 ${TYPE_COLOR[c.type]}`}>
                  {TYPE_ICON[c.type]}
                </div>
                <div className="w-px flex-1 bg-border mt-1" />
              </div>
              {/* Bubble */}
              <div className="flex-1 mb-2">
                <div className="bg-card border border-border rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">{c.author}</span>
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-muted ${TYPE_COLOR[c.type]}`}>
                        {c.type === 'status-change' ? 'status' : c.type}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{c.text}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(c.createdAt), 'MMM d, yyyy · HH:mm')}
                  </p>
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
