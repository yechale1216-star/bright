'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  MessageSquare,
  Bell,
  BellOff,
  Phone,
  Video,
  Smartphone,
  User,
  MoreVertical,
  Copy,
  Grid,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  Check,
  ExternalLink,
  Download,
  Bookmark,
  BookmarkCheck,
  FileAudio,
  Play,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCall } from '@/components/providers/call-provider';
import { cn } from '@/lib/utils/utils';
import { useLanguage } from '@/lib/context/language-context';
import { apiUrl } from '@/lib/api-config';
import { ConversationDetailsTabs, type TabKey } from '@/components/messaging/conversation-details-tabs';

interface SavedItem {
  id: string;
  bookmarkId: string;
  savedAt: string;
  messageId: string;
  content?: string;
  type: string;
  createdAt: string;
  sender?: { id: string; full_name: string; profile_photo?: string };
  attachments?: any[];
}

interface SharedContent {
  media: any[];
  files: any[];
  links: any[];
}

const API_URL = apiUrl;

function getAuthHeaders(): Record<string, string> {
  const token    = typeof window !== 'undefined' ? localStorage.getItem('attendance_token')  : null;
  const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id')       : null;
  return {
    'Content-Type': 'application/json',
    ...(token    ? { Authorization: `Bearer ${token}` } : {}),
    ...(schoolId ? { 'x-school-id': schoolId }          : {}),
  };
}

function getAttachmentUrl(msg: any): string | null {
  const att = Array.isArray(msg.attachments) ? msg.attachments[0] : null;
  return att?.url || msg.content || null;
}

function getFileName(msg: any): string {
  const att = Array.isArray(msg.attachments) ? msg.attachments[0] : null;
  return att?.name || att?.fileName || msg.content?.split('/').pop() || 'file';
}

function getFileSize(msg: any): string {
  const att = Array.isArray(msg.attachments) ? msg.attachments[0] : null;
  if (!att?.size) return '';
  const bytes = Number(att.size);
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelative(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

interface UserInfoPanelProps {
  user: any;
  currentUser: any;
  conversationId?: string | null;
  onClose: () => void;
  onAction?: (action: string, data: any) => void;
  onNavigateToMessage?: (messageId: string) => void;
}

export const UserInfoPanel: React.FC<UserInfoPanelProps> = ({
  user, currentUser, conversationId, onClose, onAction, onNavigateToMessage,
}) => {
  const { t } = useLanguage();
  const { initiateCall } = useCall();
  const [activeTab, setActiveTab]     = useState<TabKey>('media');
  const [isMuted, setIsMuted]         = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [shared, setShared]               = useState<SharedContent | null>(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError]     = useState<string | null>(null);
  const [savedItems, setSavedItems]     = useState<SavedItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError]     = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchShared = useCallback(async () => {
    const cid = conversationId || user?.conversationId || user?.id;
    if (!cid) return;
    setSharedLoading(true); setSharedError(null);
    try {
      const res = await fetch(`${API_URL}/api/messages/${cid}/shared`, { headers: getAuthHeaders() });
      if (!res.ok) {
        setShared({ media: [], files: [], links: [] });
        return;
      }
      const data = await res.json();
      setShared(data);
    } catch (err) {
      console.warn('[SharedContent] fallback to empty state:', err);
      setShared({ media: [], files: [], links: [] });
    }
    finally { setSharedLoading(false); }
  }, [conversationId, user]);

  const fetchSaved = useCallback(async () => {
    setSavedLoading(true); setSavedError(null);
    try {
      const res = await fetch(`${API_URL}/api/saved-messages/messages?limit=50`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSavedItems(Array.isArray(data.messages) ? data.messages : []);
    } catch { setSavedError('Failed to load'); }
    finally { setSavedLoading(false); }
  }, []);

  useEffect(() => { fetchShared(); fetchSaved(); }, [fetchShared, fetchSaved]);

  const phoneValue  = user?.phone || '+251 915731207';
  const rawUsername = user?.name ? `@${user.name.toLowerCase().replace(/\s+/g, '')}` : '@username';

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (onAction) onAction('pin', { messageId: 'mute', isMuted: !isMuted });
  };

  /* ── Shared sub-components ─────────────────────────────────────────────── */
  const EmptyState = ({ icon: Icon, label }: { icon: any; label: string }) => (
    <div className="py-16 flex flex-col items-center gap-3 opacity-50 animate-in fade-in duration-300">
      <div className="h-14 w-14 rounded-full bg-secondary/60 flex items-center justify-center">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground text-center px-4">{label}</p>
    </div>
  );

  const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
    <div className="py-16 flex flex-col items-center gap-3 opacity-60 animate-in fade-in duration-300">
      <p className="text-sm text-destructive font-medium">Failed to load content</p>
      <button onClick={onRetry} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:underline font-semibold">
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    </div>
  );

  const LoadingGrid = () => (
    <div className="grid grid-cols-3 gap-1.5 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square rounded-lg bg-secondary/60" />)}
    </div>
  );

  const LoadingList = () => (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2.5">
          <div className="h-10 w-10 rounded-lg bg-secondary/60 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-secondary/60 rounded w-3/4" />
            <div className="h-2 bg-secondary/40 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );

  /* ── MEDIA tab ──────────────────────────────────────────────────────────── */
  const MediaTab = () => {
    if (sharedLoading) return <LoadingGrid />;
    if (sharedError)   return <ErrorState onRetry={fetchShared} />;
    const items = shared?.media ?? [];
    if (!items.length) return <EmptyState icon={ImageIcon} label="No photos or videos shared yet" />;
    return (
      <div className="grid grid-cols-3 gap-1 animate-in fade-in duration-300">
        {items.map((m) => {
          const url = getAttachmentUrl(m);
          const isVideo = m.type === 'VIDEO';
          if (!url) return null;
          return (
            <div key={m.id} onClick={() => setLightboxUrl(url)}
              className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer border border-border/30 hover:scale-[1.02] active:scale-95 transition-all shadow-sm">
              {isVideo ? (
                <div className="w-full h-full bg-black/60 flex items-center justify-center">
                  <Play className="h-8 w-8 text-white drop-shadow-lg" />
                </div>
              ) : (
                <img src={url} alt="shared media" className="w-full h-full object-cover" loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%23334%22/%3E%3C/svg%3E'; }} />
              )}
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity" />
              {isVideo && <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.5"><Play className="h-2.5 w-2.5 text-white" /></div>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ── SAVED tab ──────────────────────────────────────────────────────────── */
  const SavedTab = () => {
    if (savedLoading) return <LoadingList />;
    if (savedError)   return <ErrorState onRetry={fetchSaved} />;
    if (!savedItems.length) return <EmptyState icon={Bookmark} label="No saved messages yet. Forward any message to Saved Messages." />;
    return (
      <div className="space-y-1 animate-in fade-in duration-300">
        {savedItems.map((msg) => {
          const att     = Array.isArray(msg.attachments) ? msg.attachments[0] : null;
          const isMedia = msg.type === 'IMAGE' || msg.type === 'VIDEO';
          const isFile  = msg.type === 'FILE'  || msg.type === 'VOICE';
          const imgUrl  = isMedia ? (att?.url || msg.content) : null;
          return (
            <div key={msg.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-secondary/40 active:bg-secondary/60 transition-all cursor-pointer group">
              {imgUrl ? (
                <img src={imgUrl} alt="saved" className="h-12 w-12 rounded-lg object-cover shrink-0 border border-border/40" loading="lazy" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  {isFile ? <FileText className="h-6 w-6 text-emerald-500" /> : <BookmarkCheck className="h-6 w-6 text-emerald-500" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground/90 font-medium line-clamp-2 leading-snug">
                  {msg.type === 'TEXT' ? msg.content : (att?.name || msg.type)}
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-1 font-medium">{formatRelative(msg.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── FILES tab ──────────────────────────────────────────────────────────── */
  const FilesTab = () => {
    if (sharedLoading) return <LoadingList />;
    if (sharedError)   return <ErrorState onRetry={fetchShared} />;
    const items = shared?.files ?? [];
    if (!items.length) return <EmptyState icon={FileText} label="No files shared in this conversation" />;
    const extColors: Record<string, string> = {
      pdf: 'text-red-500 bg-red-500/10 border-red-500/20',
      doc: 'text-blue-500 bg-blue-500/10 border-blue-500/20', docx: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      xls: 'text-green-500 bg-green-500/10 border-green-500/20', xlsx: 'text-green-500 bg-green-500/10 border-green-500/20',
      mp3: 'text-purple-500 bg-purple-500/10 border-purple-500/20', ogg: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    };
    return (
      <div className="space-y-1 animate-in fade-in duration-300">
        {items.map((f) => {
          const url      = getAttachmentUrl(f);
          const name     = getFileName(f);
          const size     = getFileSize(f);
          const ext      = name.split('.').pop()?.toLowerCase() || '';
          const isAudio  = f.type === 'VOICE';
          const colorCls = extColors[ext] || 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
          return (
            <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/40 active:bg-secondary/60 transition-all cursor-pointer group">
              <div className={cn('h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 font-black text-[10px] uppercase', colorCls)}>
                {isAudio ? <FileAudio className="h-5 w-5" /> : (ext ? <span>{ext}</span> : <FileText className="h-5 w-5" />)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground/90 truncate">{name}</p>
                <p className="text-[11px] text-muted-foreground/60 font-medium mt-0.5">
                  {size && <span>{size} · </span>}{formatRelative(f.createdAt)}
                </p>
              </div>
              {url && (
                <a href={url} download={name} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  className="h-8 w-8 rounded-full hover:bg-secondary/60 flex items-center justify-center text-muted-foreground/60 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <Download className="h-4 w-4" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /* ── LINKS tab ──────────────────────────────────────────────────────────── */
  const LinksTab = () => {
    if (sharedLoading) return <LoadingList />;
    if (sharedError)   return <ErrorState onRetry={fetchShared} />;
    const items = shared?.links ?? [];
    if (!items.length) return <EmptyState icon={LinkIcon} label="No links shared in this conversation" />;
    return (
      <div className="space-y-1.5 animate-in fade-in duration-300">
        {items.map((link) => {
          const domain = extractDomain(link.url);
          return (
            <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/40 active:bg-secondary/60 transition-all group">
              <div className="h-11 w-11 rounded-xl bg-secondary/60 border border-border/40 flex items-center justify-center shrink-0 overflow-hidden">
                <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt={domain} className="h-5 w-5 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground/90 truncate group-hover:text-emerald-500 transition-colors">{domain}</p>
                <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{link.url}</p>
                {link.createdAt && <p className="text-[10px] text-muted-foreground/40 mt-0.5">{formatRelative(link.createdAt)}</p>}
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground/40 group-hover:text-emerald-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100" />
            </a>
          );
        })}
      </div>
    );
  };

  const tabCounts: Record<TabKey, number | null> = {
    media: shared?.media?.length ?? null,
    saved: savedItems.length || null,
    files: shared?.files?.length ?? null,
    links: shared?.links?.length ?? null,
  };

  const TAB_LABELS: Record<TabKey, string> = { media: 'Media', saved: 'Saved', files: 'Files', links: 'Links' };

  return (
    <>
      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition" onClick={() => setLightboxUrl(null)}>
            <X className="h-5 w-5" />
          </button>
          <img src={lightboxUrl} alt="preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <div className="w-full md:w-96 h-full border-l border-border bg-background dark:bg-slate-950 flex flex-col animate-in slide-in-from-right duration-300 z-50 fixed inset-0 md:relative overflow-hidden">
        {/* Full panel scrollable container with touch momentum scrolling */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-muted-foreground/20 min-h-0 pb-16">

          {/* Cover Photo Header */}
          <div className="relative w-full aspect-[9/10] max-h-[380px] bg-secondary flex items-end">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 w-full h-full bg-gradient-to-tr from-emerald-700 via-teal-800 to-cyan-900" />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/45 to-transparent pt-24 pb-5 px-5">
              <h2 className="text-2xl font-black text-white leading-tight drop-shadow-md">{user?.name || 'User'}</h2>
              <p className="text-[13px] text-zinc-300 font-medium mt-1 drop-shadow-sm flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', user?.isOnline ? 'bg-emerald-500' : 'bg-zinc-400')} />
                {user?.isOnline ? t('online') : user?.timestamp || 'last seen recently'}
              </p>
            </div>
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pt-[env(safe-area-inset-top)]">
              <Button variant="outline" size="icon" onClick={onClose}
                className="h-10 w-10 rounded-full border-white/20 bg-black/35 hover:bg-black/60 text-white transition-all backdrop-blur-md active:scale-90">
                <X className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="icon"
                className="h-10 w-10 rounded-full border-white/20 bg-black/35 hover:bg-black/60 text-white transition-all backdrop-blur-md active:scale-90">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 flex justify-between gap-2.5 border-b border-border/50 bg-secondary/15">
            {[
              { icon: MessageSquare, label: 'Message', onClick: onClose },
              { icon: isMuted ? BellOff : Bell, label: isMuted ? 'Muted' : 'Mute', onClick: handleMuteToggle, muted: isMuted },
              { icon: Phone, label: 'Call',  onClick: () => initiateCall(user?.realContactId || user?.id, 'VOICE', user) },
              { icon: Video, label: 'Video', onClick: () => initiateCall(user?.realContactId || user?.id, 'VIDEO', user) },
            ].map(({ icon: Icon, label, onClick, muted }) => (
              <button key={label} onClick={onClick}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center rounded-2xl py-3.5 gap-1 transition-all active:scale-95 shadow-md cursor-pointer',
                  muted ? 'bg-slate-700/80 hover:bg-slate-800 text-slate-100' : 'bg-emerald-600/90 hover:bg-emerald-700/95 text-white shadow-emerald-900/10',
                )}>
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
              </button>
            ))}
          </div>

          {/* Info rows */}
          <div className="py-4 space-y-1">
            {[
              { icon: Smartphone, value: phoneValue, label: 'Mobile',   field: 'phone' },
              { icon: User,       value: rawUsername, label: 'Username', field: 'username', qr: true },
            ].map(({ icon: Icon, value, label, field, qr }) => (
              <div key={field} onClick={() => copyToClipboard(value, field)}
                className="px-6 py-3 flex items-center justify-between hover:bg-secondary/40 active:bg-secondary/70 transition-all cursor-pointer group">
                <div className="flex items-center gap-4 min-w-0">
                  <Icon className="h-5 w-5 text-muted-foreground/60 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-foreground/90 truncate">{value}</p>
                    <p className="text-[11px] text-muted-foreground/60 font-medium mt-0.5">{label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {qr && <div className="h-6 w-6 rounded-md bg-secondary/75 border border-border/80 flex items-center justify-center cursor-pointer shadow-sm"><Grid className="h-3.5 w-3.5" /></div>}
                  <button className="text-muted-foreground/50 hover:text-primary transition-colors focus:outline-none">
                    {copiedField === field ? <Check className="h-4 w-4 text-green-500 animate-in zoom-in" /> : <Copy className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs section */}
          <div className="border-t border-border/70 mt-2 bg-secondary/5 min-h-[350px]">
            {Boolean(conversationId || user?.conversationId || user?.id) && (
              <ConversationDetailsTabs
                conversationId={(conversationId || user?.conversationId || user?.id)!}
                onNavigateToMessage={(mid) => {
                  if (onNavigateToMessage) onNavigateToMessage(mid);
                  onClose();
                }}
              />
            )}
          </div>

        </div>
      </div>
    </>
  );
};
