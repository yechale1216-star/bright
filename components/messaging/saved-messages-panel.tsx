'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bookmark, Search, X, Send, Paperclip, ChevronLeft, Trash2, Copy,
  Reply, MoreVertical, FileText, ImageIcon, Music, File as FileIcon,
  Pin, Star, Check, CheckCheck, Download, Smile, ArrowLeft, Clock, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils/utils';
import { authService } from '@/lib/auth/auth';
import { getApiUrl } from '@/lib/api-config';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/context/language-context';
import { supabase } from '@/lib/utils/supabase';
import { uploadFile } from '@/lib/utils/upload-file';
import { resolveAttachmentUrl } from '@/components/messaging/chat-window';

const API_URL = getApiUrl();

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
  const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (schoolId) headers['x-school-id'] = schoolId;
  return headers;
}

interface SavedMessage {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  editedAt?: string | null;
  isDeleted?: boolean;
  attachments?: { url: string; name: string; type: string; size: number }[];
  sender?: { id: string; full_name: string; profile_photo?: string };
  replyTo?: { id: string; content: string; sender?: { full_name: string } } | null;
  reactions?: { emoji: string; userId: string }[];
  status?: 'sending' | 'sent' | 'failed';
}

interface SavedMessagesPanelProps {
  onClose?: () => void;
  isFullscreen?: boolean;
}

export const SavedMessagesPanel: React.FC<SavedMessagesPanelProps> = ({ onClose, isFullscreen = false }) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ file: File; type: string; preview: string } | null>(null);
  const [replyTarget, setReplyTarget] = useState<SavedMessage | null>(null);
  const [contextMenu, setContextMenu] = useState<{ message: SavedMessage; x: number; y: number } | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = authService.getCurrentUser();

  const fetchConversation = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/saved-messages/conversation`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setConversationId(data.id);
    } catch {
      // Conversation may not exist yet, that's fine
    }
  }, []);

  const fetchMessages = useCallback(async (cursor?: string) => {
    if (cursor) setIsLoadingMore(true);
    else setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (cursor) params.set('cursor', cursor);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`${API_URL}/api/saved-messages/messages?${params.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (cursor) {
        setMessages(prev => [...data.messages, ...prev]);
      } else {
        setMessages(data.messages || []);
      }
      setHasNextPage(data.hasNextPage);
      setNextCursor(data.nextCursor);
    } catch {
      // silently fail — empty state shown
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (!isLoadingMore) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isLoadingMore]);

  const handleSend = async () => {
    if (!inputValue.trim() && !attachedFile) return;
    setIsSending(true);
    const currentInput = inputValue;
    const currentFile = attachedFile;
    const currentReply = replyTarget;
    setInputValue('');
    setAttachedFile(null);
    setReplyTarget(null);

    const tempId = `temp-${Date.now()}`;
    const fallbackText = currentFile?.type === 'IMAGE' ? 'Image' : currentFile?.type === 'VIDEO' ? 'Video' : 'File';
    const content = currentInput || fallbackText;
    const type = currentFile ? (currentFile.file.type.startsWith('image/') ? 'IMAGE' : currentFile.file.type.startsWith('video/') ? 'VIDEO' : 'FILE') : 'TEXT';

    let optimisticAttachment: any = undefined;
    if (currentFile) {
       optimisticAttachment = { 
         url: currentFile.preview, 
         name: currentFile.file.name, 
         type: currentFile.file.type, 
         size: currentFile.file.size 
       };
    }

    const optimisticMessage: SavedMessage = {
      id: tempId,
      content,
      type,
      createdAt: new Date().toISOString(),
      attachments: optimisticAttachment ? [optimisticAttachment] : undefined,
      replyTo: currentReply ? { id: currentReply.id, content: currentReply.content, sender: currentReply.sender } : null,
      status: 'sending'
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      let attachment: any = undefined;
      if (currentFile) {
        const url = await uploadFile(currentFile.file);
        attachment = { url, name: currentFile.file.name, type: currentFile.file.type, size: currentFile.file.size };
      }

      const res = await fetch(`${API_URL}/api/saved-messages/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          content,
          type,
          attachment,
          replyToId: currentReply?.id,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to save message');
      
      const newMsg = await res.json();
      setMessages(prev => prev.map(m => m.id === tempId ? { ...newMsg, status: 'sent' } : m));
    } catch {
      toast.error('Failed to save message');
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/saved-messages/messages/${messageId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed');
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    } catch {
      toast.error('Failed to delete message');
    }
    setContextMenu(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const preview = (isImage || isVideo) ? URL.createObjectURL(file) : '';
    setAttachedFile({ file, type: isImage ? 'IMAGE' : isVideo ? 'VIDEO' : 'FILE', preview });
    e.target.value = '';
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDateSeparator = (ts: string) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const groupByDate = (msgs: SavedMessage[]) => {
    const groups: { date: string; messages: SavedMessage[] }[] = [];
    let currentDate = '';
    for (const msg of msgs) {
      const date = formatDateSeparator(msg.createdAt);
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }
    return groups;
  };

  const filteredMessages = searchQuery
    ? messages.filter(m =>
        m.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.attachments?.[0]?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const groupedMessages = groupByDate(filteredMessages);

  return (
    <div className={cn(
      "flex flex-col bg-background",
      isFullscreen ? "fixed inset-0 z-[100]" : "w-full h-full"
    )}>
      {/* Header */}
      <div className="h-[calc(88px+env(safe-area-inset-top))] md:h-[72px] bg-background/95 backdrop-blur-md border-b border-border/50 flex items-end pb-2 px-3 z-40 sticky top-0 pt-[env(safe-area-inset-top)] shadow-sm shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-full hover:bg-secondary">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}
          <div className="h-10 w-10 rounded-full bg-emerald-600/20 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <Bookmark className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[16px] tracking-tight text-foreground">Saved Messages</span>
            <span className="text-[11px] text-muted-foreground/70">{messages.length} saved</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => setShowSearch(s => !s)}>
            {showSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 border-b border-border/50 bg-background/80 backdrop-blur shrink-0"
          >
            <div className="flex items-center gap-3 bg-secondary/60 rounded-full px-4 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages, files, links..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain scrollbar-hide"
        style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")', backgroundSize: '200px' }}
        onClick={() => setContextMenu(null)}
      >
        <div className="p-3 space-y-1 min-h-full flex flex-col justify-end">
          {/* Load More */}
          {hasNextPage && (
            <div className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => nextCursor && fetchMessages(nextCursor)}
                disabled={isLoadingMore}
                className="rounded-full text-xs text-muted-foreground h-8"
              >
                {isLoadingMore ? 'Loading...' : 'Load earlier messages'}
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-emerald-600/15 border border-emerald-500/20 flex items-center justify-center animate-pulse">
                  <Bookmark className="h-7 w-7 text-emerald-600/60" />
                </div>
                <p className="text-sm text-muted-foreground/60">Loading saved messages...</p>
              </div>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-6">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <div className="h-20 w-20 rounded-full bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <Bookmark className="h-9 w-9 text-emerald-600/70" />
                </div>
                <h3 className="text-lg font-black tracking-tight text-foreground mb-1">Saved Messages</h3>
                <p className="text-sm text-muted-foreground/70 max-w-[260px] leading-relaxed">
                  {searchQuery
                    ? 'No messages match your search.'
                    : 'Forward messages here to save them, or send yourself notes, files, and links.'}
                </p>
              </motion.div>
            </div>
          ) : (
            groupedMessages.map(group => (
              <div key={group.date}>
                {/* Date Separator */}
                <div className="flex items-center justify-center py-3">
                  <span className="bg-background/80 border border-border/40 backdrop-blur-sm text-[11px] text-muted-foreground/70 font-semibold px-3 py-1 rounded-full shadow-sm">
                    {group.date}
                  </span>
                </div>

                {group.messages.map(message => (
                  <SavedMessageBubble
                    key={message.id}
                    message={message}
                    onContextMenu={(m, x, y) => setContextMenu({ message: m, x, y })}
                    onReply={m => setReplyTarget(m)}
                    formatTime={formatTime}
                  />
                ))}
              </div>
            ))
          )}
          <div ref={messagesEndRef} className="h-0 w-full" />
        </div>
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed z-[60] bg-background border border-border shadow-2xl rounded-2xl overflow-hidden w-52"
              style={{ left: Math.min(contextMenu.x, window.innerWidth - 210), top: Math.min(contextMenu.y, window.innerHeight - 200) }}
            >
              {[
                { icon: Reply, label: 'Reply', action: () => { setReplyTarget(contextMenu.message); setContextMenu(null); } },
                { icon: Copy, label: 'Copy', action: () => { navigator.clipboard.writeText(contextMenu.message.content); toast.success('Copied'); setContextMenu(null); } },
                { icon: Pin, label: 'Pin', action: () => { toast.info('Coming soon'); setContextMenu(null); } },
                { icon: Star, label: 'Star', action: () => { toast.info('Coming soon'); setContextMenu(null); } },
                { icon: Trash2, label: 'Delete', action: () => handleDelete(contextMenu.message.id), danger: true },
              ].map(({ icon: Icon, label, action, danger }: any) => (
                <button
                  key={label}
                  onClick={action}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary/50",
                    danger && "text-destructive hover:bg-destructive/10"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Reply Preview */}
      <AnimatePresence>
        {replyTarget && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border/50 bg-background/90 px-4 py-2 flex items-center gap-3 shrink-0"
          >
            <div className="flex-1 min-w-0 border-l-4 border-emerald-500 pl-3">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Replying to saved</p>
              <p className="text-xs text-muted-foreground truncate">{replyTarget.content || 'File'}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full shrink-0" onClick={() => setReplyTarget(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Preview */}
      <AnimatePresence>
        {attachedFile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border/50 bg-background/90 px-4 py-2 flex items-center gap-3 shrink-0"
          >
            {attachedFile.type === 'IMAGE' ? (
              <img src={attachedFile.preview} alt="" className="h-10 w-10 rounded-lg object-cover border border-border shrink-0" />
            ) : (
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <FileIcon className="h-5 w-5 text-primary" />
              </div>
            )}
            <p className="flex-1 text-sm font-semibold truncate">{attachedFile.file.name}</p>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full shrink-0" onClick={() => setAttachedFile(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Input */}
      <div className="p-3 bg-background/90 backdrop-blur-md border-t border-border/50 pb-safe shrink-0">
        <div className="flex items-end gap-2">
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all active:scale-90 shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <div className="flex-1 bg-secondary/50 rounded-3xl px-4 py-2.5 min-h-[44px] flex items-center">
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Message yourself..."
              rows={1}
              className="w-full bg-transparent text-sm resize-none outline-none leading-normal max-h-[120px] overflow-y-auto scrollbar-hide placeholder:text-muted-foreground/50"
            />
          </div>

          <Button
            size="icon"
            onClick={handleSend}
            disabled={isSending || (!inputValue.trim() && !attachedFile)}
            className="h-11 w-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg transition-all active:scale-90 shrink-0 disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Individual Message Bubble ─────────────────────────────────────────────────
const SavedMessageBubble = React.memo(({
  message,
  onContextMenu,
  onReply,
  formatTime,
}: {
  message: SavedMessage;
  onContextMenu: (m: SavedMessage, x: number, y: number) => void;
  onReply: (m: SavedMessage) => void;
  formatTime: (ts: string) => string;
}) => {
  const att = message.attachments?.[0];
  const isImage = att?.type?.startsWith('image/') || message.type === 'IMAGE';
  const isVideo = att?.type?.startsWith('video/') || message.type === 'VIDEO';
  const isFile = att && !isImage && !isVideo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="flex items-end justify-end gap-1.5 mb-0.5 group"
      onContextMenu={e => { e.preventDefault(); onContextMenu(message, e.clientX, e.clientY); }}
    >
      <div className="max-w-[78%] md:max-w-[55%]">
        {/* Reply Preview */}
        {message.replyTo && (
          <div className="mb-0.5 bg-emerald-800/10 border-l-4 border-emerald-500 rounded-t-xl px-3 py-1.5 overflow-hidden">
            <p className="text-[10px] font-bold text-emerald-600 mb-0.5">{message.replyTo.sender?.full_name || 'Saved'}</p>
            <p className="text-[11px] text-muted-foreground truncate">{message.replyTo.content}</p>
          </div>
        )}

        <div className={cn(
          "relative rounded-2xl shadow-sm",
          "bg-emerald-800/90 dark:bg-emerald-900/90 text-white rounded-br-none"
        )}>
          {isImage && att && (
            <div className="rounded-xl overflow-hidden mb-1">
              <img
                src={resolveAttachmentUrl(att.url)}
                alt={att.name}
                className="max-w-full w-full max-h-[320px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
                loading="lazy"
              />
            </div>
          )}
          {isVideo && att && (
            <div className="rounded-xl overflow-hidden mb-1">
              <video src={resolveAttachmentUrl(att.url)} controls className="max-w-full w-full max-h-[280px] rounded-xl" />
            </div>
          )}
          {isFile && att && (
            <a
              href={resolveAttachmentUrl(att.url)}
              target="_blank"
              rel="noopener noreferrer"
              download={att.name}
              className="flex items-center gap-3 px-3 pt-2.5 pb-1.5 hover:opacity-80 transition-opacity"
            >
              <div className="h-10 w-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold truncate text-white">{att.name}</p>
                <p className="text-[11px] text-white/60">{(att.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <Download className="h-4 w-4 text-white/60 shrink-0" />
            </a>
          )}
          {message.content && message.content !== 'Image' && message.content !== 'Video' && message.content !== 'File' && !message.isDeleted && (
            <p className="text-[15px] leading-snug px-3 py-2 whitespace-pre-wrap break-words">{message.content}</p>
          )}
          {message.isDeleted && (
            <p className="text-[13px] italic opacity-50 px-3 py-2">This message was deleted</p>
          )}

          {/* Timestamp */}
          <div className="flex items-center gap-1 justify-end px-3 pb-1.5 -mt-1">
            {message.editedAt && <span className="text-[9px] text-white/50">edited</span>}
            <span className="text-[10px] text-white/60">{formatTime(message.createdAt)}</span>
            {message.status === 'sending' ? (
              <Clock className="h-3 w-3 text-white/60 animate-pulse" />
            ) : message.status === 'failed' ? (
              <AlertCircle className="h-3 w-3 text-red-400" />
            ) : (
              <CheckCheck className="h-3 w-3 text-white/60" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

SavedMessageBubble.displayName = 'SavedMessageBubble';
