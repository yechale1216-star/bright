'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Link as LinkIcon,
  Bookmark,
  Play,
  Download,
  ExternalLink,
  RefreshCw,
  Loader2,
  X,
  FileAudio,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
  ArrowRight,
  Trash2,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import { getApiUrl } from '@/lib/api-config';
import { useSocket } from '@/components/providers/socket-provider';

const API_URL = getApiUrl();

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
  const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(schoolId ? { 'x-school-id': schoolId } : {}),
  };
}

function formatRelative(dateStr: string): string {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '';
  const num = Number(bytes);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

export type TabKey = 'media' | 'saved' | 'files' | 'links';

interface MediaItem {
  id: string;
  messageId: string;
  type: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
  sender?: { id: string; full_name: string; profile_photo?: string };
}

interface FileItem {
  id: string;
  messageId: string;
  fileName: string;
  fileSize?: number;
  fileUrl: string;
  extension: string;
  category: 'document' | 'spreadsheet' | 'presentation' | 'archive' | 'audio' | 'other';
  mimeType?: string;
  createdAt: string;
  sender?: { id: string; full_name: string; profile_photo?: string };
}

interface LinkItem {
  id: string;
  messageId: string;
  url: string;
  domain: string;
  title?: string;
  description?: string;
  previewImage?: string;
  createdAt: string;
  sender?: { id: string; full_name: string; profile_photo?: string };
}

interface SavedItem {
  bookmarkId: string;
  savedAt: string;
  messageId: string;
  content?: string;
  type: string;
  createdAt: string;
  sender?: { id: string; full_name: string; profile_photo?: string };
  attachments?: any[];
}

interface SharedData {
  media: MediaItem[];
  files: FileItem[];
  links: LinkItem[];
  saved: SavedItem[];
}

interface ConversationDetailsTabsProps {
  conversationId: string;
  onNavigateToMessage?: (messageId: string) => void;
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
}

export const ConversationDetailsTabs: React.FC<ConversationDetailsTabsProps> = ({
  conversationId,
  onNavigateToMessage,
  activeTab: externalTab,
  onTabChange,
}) => {
  const { socket } = useSocket();
  const [internalTab, setInternalTab] = useState<TabKey>('media');
  const activeTab = externalTab || internalTab;

  const handleTabSelect = (tab: TabKey) => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtering states
  const [mediaFilter, setMediaFilter] = useState<'all' | 'photos' | 'videos'>('all');
  const [fileFilter, setFileFilter] = useState<'all' | 'docs' | 'sheets' | 'archives' | 'audio'>('all');

  // Full-screen viewer state
  const [activeMediaItem, setActiveMediaItem] = useState<MediaItem | null>(null);

  const fetchContent = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/messages/${conversationId}/shared`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const json = await res.json();
      setData({
        media: Array.isArray(json.media) ? json.media : [],
        files: Array.isArray(json.files) ? json.files : [],
        links: Array.isArray(json.links) ? json.links : [],
        saved: Array.isArray(json.saved) ? json.saved : [],
      });
    } catch (err: any) {
      console.warn('[ConversationDetailsTabs] Fetch error:', err);
      setError('Failed to load shared content');
      setData({ media: [], files: [], links: [], saved: [] });
    } finally {
      setLoading(false);
    }

  }, [conversationId]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Real-time updates via Socket & Window events
  useEffect(() => {
    const handleNewMessage = (msg: any) => {
      if (msg.conversationId === conversationId || msg.detail?.conversationId === conversationId) {
        fetchContent();
      }
    };

    const handleMessageDeleted = (data: any) => {
      if (data.conversationId === conversationId) {
        fetchContent();
      }
    };

    if (socket) {
      socket.on('new_message', handleNewMessage);
      socket.on('message_deleted', handleMessageDeleted);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('zetime:new_message', handleNewMessage as EventListener);
    }

    return () => {
      if (socket) {
        socket.off('new_message', handleNewMessage);
        socket.off('message_deleted', handleMessageDeleted);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('zetime:new_message', handleNewMessage as EventListener);
      }
    };
  }, [socket, conversationId, fetchContent]);


  // Remove saved bookmark handler
  const handleRemoveBookmark = async (messageId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/messages/${messageId}/bookmark`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                saved: prev.saved.filter((s) => s.messageId !== messageId),
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to remove bookmark:', err);
    }
  };

  /* ── UI States ───────────────────────────────────────────────────────────── */
  const EmptyState = ({ icon: Icon, label, subtext }: { icon: any; label: string; subtext?: string }) => (
    <div className="py-16 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-300">
      <div className="h-14 w-14 rounded-2xl bg-secondary/80 flex items-center justify-center border border-border/40">
        <Icon className="h-7 w-7 text-muted-foreground/70" />
      </div>
      <p className="text-sm font-semibold text-foreground/90 text-center px-4">{label}</p>
      {subtext && <p className="text-xs text-muted-foreground text-center max-w-xs">{subtext}</p>}
    </div>
  );

  const LoadingSkeleton = () => (
    <div className="space-y-3 p-1 animate-pulse">
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-secondary/60" />
        ))}
      </div>
    </div>
  );

  const tabCounts: Record<TabKey, number> = {
    media: data?.media.length || 0,
    saved: data?.saved.length || 0,
    files: data?.files.length || 0,
    links: data?.links.length || 0,
  };

  /* ── 1. MEDIA TAB ───────────────────────────────────────────────────────── */
  const filteredMedia = (data?.media || []).filter((m) => {
    if (mediaFilter === 'photos') return m.type === 'IMAGE';
    if (mediaFilter === 'videos') return m.type === 'VIDEO';
    return true;
  });

  const renderMediaTab = () => {
    if (loading) return <LoadingSkeleton />;
    if (error) {
      return (
        <div className="py-12 flex flex-col items-center gap-2">
          <p className="text-xs text-destructive">{error}</p>
          <button onClick={fetchContent} className="text-xs text-emerald-500 font-medium flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      );
    }
    if (!data?.media.length) {
      return <EmptyState icon={ImageIcon} label="No photos or videos shared yet" subtext="Photos and videos sent in this conversation will appear here." />;
    }

    return (
      <div className="space-y-3 animate-in fade-in duration-200">
        {/* Sub-filter pills */}
        <div className="flex items-center gap-1.5 pb-1">
          {[
            { key: 'all', label: `All (${data.media.length})` },
            { key: 'photos', label: `Photos (${data.media.filter((m) => m.type === 'IMAGE').length})` },
            { key: 'videos', label: `Videos (${data.media.filter((m) => m.type === 'VIDEO').length})` },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setMediaFilter(f.key as any)}
              className={cn(
                'px-2.5 py-1 text-[11px] font-semibold rounded-full transition-all',
                mediaFilter === f.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredMedia.length === 0 ? (
          <EmptyState icon={ImageIcon} label={`No ${mediaFilter} found`} />
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {filteredMedia.map((item) => {
              const isVideo = item.type === 'VIDEO';
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveMediaItem(item)}
                  className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer bg-secondary/80 border border-border/40 hover:scale-[1.02] active:scale-95 transition-all shadow-sm"
                >
                  {isVideo ? (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
                      <video src={item.mediaUrl} className="w-full h-full object-cover opacity-80" preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="h-9 w-9 rounded-full bg-emerald-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="h-4 w-4 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={item.mediaUrl}
                      alt={item.fileName || 'Media'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%23334%22/%3E%3C/svg%3E';
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {isVideo && (
                    <div className="absolute bottom-1 right-1 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5 flex items-center gap-1">
                      <Play className="h-2.5 w-2.5 text-white fill-current" />
                      <span className="text-[9px] text-white font-semibold uppercase">Video</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /* ── 2. FILES TAB ───────────────────────────────────────────────────────── */
  const filteredFiles = (data?.files || []).filter((f) => {
    if (fileFilter === 'docs') return f.category === 'document' || f.category === 'presentation';
    if (fileFilter === 'sheets') return f.category === 'spreadsheet';
    if (fileFilter === 'archives') return f.category === 'archive';
    if (fileFilter === 'audio') return f.category === 'audio';
    return true;
  });

  const getFileCategoryBadge = (f: FileItem) => {
    switch (f.category) {
      case 'document':
        return { icon: FileText, color: 'text-red-500 bg-red-500/10 border-red-500/20' };
      case 'spreadsheet':
        return { icon: FileSpreadsheet, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
      case 'archive':
        return { icon: FileArchive, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' };
      case 'audio':
        return { icon: FileAudio, color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' };
      default:
        return { icon: File, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' };
    }
  };

  const renderFilesTab = () => {
    if (loading) return <LoadingSkeleton />;
    if (error) return <p className="text-xs text-destructive text-center py-8">{error}</p>;
    if (!data?.files.length) {
      return <EmptyState icon={FileText} label="No files shared yet" subtext="Documents, spreadsheets, PDFs, and archives sent in chat will appear here." />;
    }

    return (
      <div className="space-y-3 animate-in fade-in duration-200">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5 pb-1 overflow-x-auto scrollbar-none">
          {[
            { key: 'all', label: 'All' },
            { key: 'docs', label: 'Docs' },
            { key: 'sheets', label: 'Sheets' },
            { key: 'archives', label: 'Archives' },
            { key: 'audio', label: 'Audio' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFileFilter(f.key as any)}
              className={cn(
                'px-2.5 py-1 text-[11px] font-semibold rounded-full whitespace-nowrap transition-all',
                fileFilter === f.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredFiles.length === 0 ? (
          <EmptyState icon={FileText} label="No matching files found" />
        ) : (
          <div className="space-y-1.5">
            {filteredFiles.map((file) => {
              const badge = getFileCategoryBadge(file);
              const IconComp = badge.icon;
              return (
                <div
                  key={file.id}
                  onClick={() => onNavigateToMessage && onNavigateToMessage(file.messageId)}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-border/30 hover:bg-secondary/50 active:bg-secondary/80 transition-all cursor-pointer group"
                >
                  <div className={cn('h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 font-bold text-xs uppercase', badge.color)}>
                    {file.extension ? <span>{file.extension.slice(0, 4)}</span> : <IconComp className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground/90 truncate group-hover:text-emerald-500 transition-colors">{file.fileName}</p>
                    <p className="text-[11px] text-muted-foreground/70 font-medium mt-0.5 flex items-center gap-1.5 truncate">
                      {file.fileSize && <span>{formatFileSize(file.fileSize)}</span>}
                      {file.sender?.full_name && <span>· {file.sender.full_name.split(' ')[0]}</span>}
                      <span>· {formatRelative(file.createdAt)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {file.fileUrl && (
                      <a
                        href={file.fileUrl}
                        download={file.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        title="Download file"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                    {onNavigateToMessage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToMessage(file.messageId);
                        }}
                        className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-emerald-500 transition-colors"
                        title="Jump to message"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /* ── 3. LINKS TAB ───────────────────────────────────────────────────────── */
  const renderLinksTab = () => {
    if (loading) return <LoadingSkeleton />;
    if (error) return <p className="text-xs text-destructive text-center py-8">{error}</p>;
    if (!data?.links.length) {
      return <EmptyState icon={LinkIcon} label="No links shared yet" subtext="Web URLs and link previews shared in chat will appear here." />;
    }

    return (
      <div className="space-y-2 animate-in fade-in duration-200">
        {data.links.map((link) => {
          const domain = link.domain || link.url;
          return (
            <div
              key={link.id}
              onClick={() => onNavigateToMessage && onNavigateToMessage(link.messageId)}
              className="flex items-start gap-3 p-3 rounded-xl border border-border/30 hover:bg-secondary/50 active:bg-secondary/80 transition-all cursor-pointer group"
            >
              <div className="h-11 w-11 rounded-xl bg-secondary/80 border border-border/50 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                  alt={domain}
                  className="h-5 w-5 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground/90 truncate group-hover:text-emerald-500 transition-colors">{link.title || domain}</p>
                <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{link.url}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1 font-medium">
                  {link.sender?.full_name && <span>{link.sender.full_name} · </span>}
                  {formatRelative(link.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-emerald-500 transition-colors"
                  title="Open link"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── 4. SAVED TAB ───────────────────────────────────────────────────────── */
  const renderSavedTab = () => {
    if (loading) return <LoadingSkeleton />;
    if (error) return <p className="text-xs text-destructive text-center py-8">{error}</p>;
    if (!data?.saved.length) {
      return (
        <EmptyState
          icon={Bookmark}
          label="No saved messages in this conversation"
          subtext="Bookmark key messages from this chat to easily find them here."
        />
      );
    }

    return (
      <div className="space-y-2 animate-in fade-in duration-200">
        {data.saved.map((item) => {
          const att = Array.isArray(item.attachments) ? item.attachments[0] : null;
          const isMedia = item.type === 'IMAGE' || item.type === 'VIDEO';
          const imgUrl = isMedia ? att?.url || item.content : null;

          return (
            <div
              key={item.bookmarkId}
              onClick={() => onNavigateToMessage && onNavigateToMessage(item.messageId)}
              className="flex items-start gap-3 p-3 rounded-xl border border-border/30 hover:bg-secondary/50 active:bg-secondary/80 transition-all cursor-pointer group"
            >
              {imgUrl ? (
                <img src={imgUrl} alt="Saved preview" className="h-11 w-11 rounded-lg object-cover shrink-0 border border-border/40" />
              ) : (
                <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Bookmark className="h-5 w-5 text-emerald-500 fill-emerald-500/20" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {item.sender?.full_name || 'Saved Message'}
                </p>
                <p className="text-xs font-medium text-foreground/90 line-clamp-2 mt-0.5 leading-snug">
                  {item.content || att?.name || `[${item.type}]`}
                </p>
                <p className="text-[10px] text-muted-foreground/60 font-medium mt-1">Bookmarked {formatRelative(item.savedAt)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveBookmark(item.messageId);
                  }}
                  className="h-8 w-8 rounded-full hover:bg-red-500/10 hover:text-red-500 text-muted-foreground/60 transition-colors flex items-center justify-center"
                  title="Remove from saved"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── Tab Bar Labels & Counts ─────────────────────────────────────────────── */
  const TAB_LABELS: Record<TabKey, string> = {
    media: 'Media',
    saved: 'Saved',
    files: 'Files',
    links: 'Links',
  };

  return (
    <>
      {/* Full screen Lightbox Viewer */}
      {activeMediaItem && (
        <div
          className="fixed inset-0 z-[300] bg-black/95 flex flex-col justify-between p-4 animate-in fade-in duration-200"
          onClick={() => setActiveMediaItem(null)}
        >
          {/* Header */}
          <div className="flex items-center justify-between z-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-white">
              {activeMediaItem.sender?.profile_photo ? (
                <img src={activeMediaItem.sender.profile_photo} alt="" className="h-9 w-9 rounded-full object-cover border border-white/20" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-sm text-white">
                  {(activeMediaItem.sender?.full_name || 'U')[0]}
                </div>
              )}
              <div>
                <p className="text-sm font-bold leading-none">{activeMediaItem.sender?.full_name || 'User'}</p>
                <p className="text-[11px] text-white/60 font-medium mt-0.5">{formatRelative(activeMediaItem.createdAt)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onNavigateToMessage && (
                <button
                  onClick={() => {
                    const mid = activeMediaItem.messageId;
                    setActiveMediaItem(null);
                    onNavigateToMessage(mid);
                  }}
                  className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg transition"
                >
                  <Eye className="h-3.5 w-3.5" /> Jump to Message
                </button>
              )}
              <a
                href={activeMediaItem.mediaUrl}
                download={activeMediaItem.fileName || 'media'}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                onClick={() => setActiveMediaItem(null)}
                className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Media Body */}
          <div className="flex-1 flex items-center justify-center my-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {activeMediaItem.type === 'VIDEO' ? (
              <video src={activeMediaItem.mediaUrl} controls autoPlay className="max-w-full max-h-full rounded-lg shadow-2xl" />
            ) : (
              <img src={activeMediaItem.mediaUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
            )}
          </div>
        </div>
      )}

      {/* Main Tabs Container */}
      <div className="w-full flex flex-col bg-background">
        {/* Sticky Tab Header */}
        <div className="flex border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur-md z-20 shadow-sm">
          {(['media', 'saved', 'files', 'links'] as TabKey[]).map((tab) => {
            const count = tabCounts[tab];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleTabSelect(tab)}
                className={cn(
                  'flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all uppercase tracking-wider relative flex items-center justify-center gap-1.5 cursor-pointer select-none',
                  isActive ? 'border-emerald-600 text-emerald-600 font-extrabold' : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {TAB_LABELS[tab]}
                {count > 0 && (
                  <span
                    className={cn(
                      'text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-none',
                      isActive ? 'bg-emerald-600 text-white' : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-3 min-h-[300px] pb-12">
          {activeTab === 'media' && renderMediaTab()}
          {activeTab === 'saved' && renderSavedTab()}
          {activeTab === 'files' && renderFilesTab()}
          {activeTab === 'links' && renderLinksTab()}
        </div>
      </div>
    </>
  );
};
