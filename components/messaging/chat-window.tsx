'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Paperclip, Smile, MoreVertical, Phone, Video, ChevronLeft,
  Check, CheckCheck, Reply, Forward, Trash2, Heart, Search, X, Clock,
  Pin, Copy, FileText, FileJson, FileType, Music, Play, ExternalLink,
  Download, Globe, FileArchive, Mic, MicOff, StopCircle, ImageIcon, File as FileIcon,
  Info, Bell, RotateCw, PhoneIncoming, PhoneMissed, PhoneOff, PhoneCall,
  ArrowUpRight, ArrowDownLeft, PhoneOutgoing, Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/utils';
import { MessageWindowSkeleton } from '@/components/messaging/skeletons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { Logo } from '@/components/logo';
import { useCall } from '@/components/providers/call-provider';
import { authService } from '@/lib/auth/auth';
import { API_URL } from '@/lib/api-config';
import { supabase } from '@/lib/utils/supabase';
import { fileTransferManager } from '@/lib/utils/file-transfer-manager';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/context/language-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { MessageActionSheet } from '@/components/messaging/message-action-sheet';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE' | 'VIDEO_MESSAGE' | 'CALL_VOICE' | 'CALL_VIDEO' | 'CALL_MISSED_VOICE' | 'CALL_MISSED_VIDEO';
  isMe: boolean;
  attachments?: {
    url: string;
    name: string;
    type: string;
    size: number;
  }[];
  isDeleted?: boolean;
  editedAt?: Date | string | null;
  isPinned?: boolean;
  replyTo?: {
    id: string;
    content: string | null;
    senderName: string;
    type: string;
  } | null;
  forwardedFrom?: string | null;
}

interface ChatWindowProps {
  activeConversation: any;
  messages: Message[];
  typingStatus?: string;
  onSendMessage: (content: string, options?: {
    type?: string;
    attachment?: any;
    replyToId?: string;
    isOptimistic?: boolean;
    tempId?: string;
    replaceTempId?: string;
  }) => void;
  onBack?: () => void;
  onToggleInfo?: () => void;
  onAction?: (action: string, data: any) => void;
  isLoading?: boolean;
  pinnedMessage?: { messageId: string; content?: string; senderName?: string; type?: string } | null;
  onLoadOlderMessages?: () => void;
  hasMoreOlderMessages?: boolean;
  isLoadingOlderMessages?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = React.memo(({
  activeConversation,
  messages,
  typingStatus,
  onSendMessage,
  onBack,
  onToggleInfo,
  onAction,
  isLoading,
  pinnedMessage,
  onLoadOlderMessages,
  hasMoreOlderMessages,
  isLoadingOlderMessages,
}) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const { initiateCall, status: callStatus } = useCall();
  const isSuspended = false; // Single-School Edition — never suspended

  const [inputValue, setInputValue] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ file: File; type: 'IMAGE' | 'VIDEO' | 'FILE'; preview: string } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [editTarget, setEditTarget] = useState<Message | null>(null);
  // Legacy delete dialog state (kept for desktop ContextMenu path)
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState<Message | null>(null);
  // Telegram-style bottom sheet state
  const [actionSheetMessage, setActionSheetMessage] = useState<Message | null>(null);
  const [uploads, setUploads] = useState<Record<string, { progress: number; controller: AbortController; fileData?: { file: File; type: string; preview: string }; text?: string }>>({});

  const handleCancelUpload = (tempId: string) => {
    const upload = uploads[tempId];
    if (upload) {
      upload.controller.abort();
      onAction?.('cancel_upload', { messageId: tempId });
      setUploads(prev => {
        const next = { ...prev };
        delete next[tempId];
        return next;
      });
    }
  };

  const retryUpload = async (tempId: string) => {
    const upload = uploads[tempId];
    if (!upload || !upload.fileData) return;

    onAction?.('upload_retry_start', { messageId: tempId });

    const controller = new AbortController();
    setUploads(prev => ({
      ...prev,
      [tempId]: { ...prev[tempId], progress: 0, controller }
    }));

    try {
      const attachmentUrl = await uploadFile(upload.fileData.file, (percent) => {
        setUploads(prev => {
          if (!prev[tempId]) return prev;
          return { ...prev, [tempId]: { ...prev[tempId], progress: percent } };
        });
      }, controller.signal);

      onSendMessage(upload.text || (upload.fileData.type === 'IMAGE' ? 'Image' : upload.fileData.type === 'VIDEO' ? 'Video' : 'File'), {
        type: upload.fileData.type,
        attachment: {
          url: attachmentUrl,
          name: upload.fileData.file.name,
          type: upload.fileData.file.type,
          size: upload.fileData.file.size
        },
        replaceTempId: tempId,
      });

      setUploads(prev => {
        const next = { ...prev };
        delete next[tempId];
        return next;
      });
    } catch (error: any) {
      if (error.message === 'Upload aborted') {
        onAction?.('cancel_upload', { messageId: tempId });
        setUploads(prev => {
          const next = { ...prev };
          delete next[tempId];
          return next;
        });
      } else {
        toast.error('Retry failed.');
        onAction?.('upload_failed', { messageId: tempId });
      }
    }
  };
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  // Recording
  const [recordMode, setRecordMode] = useState<'audio' | 'video'>('audio');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Track which message to flash/highlight after scrolling to it
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const focusInput = () => {
    setTimeout(() => textInputRef.current?.focus(), 80);
  };

  useEffect(() => {
    setCurrentUser(authService.getCurrentUser());
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const formatLastSeen = (date: string | Date | null) => {
    if (!date) return t("last_seen_a_long_time_ago");
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t("last_seen_just_now");
    if (minutes < 60) return t("last_seen_minutes_ago", { n: minutes });

    if (days === 0 && now.getDate() === d.getDate()) {
      return t("last_seen_today_at", { t: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) });
    }

    if (days === 1 || (days === 0 && now.getDate() !== d.getDate())) {
      return t("last_seen_yesterday_at", { t: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) });
    }

    if (days < 7) {
      return t("last_seen_on", { d: d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) });
    }

    return t("last_seen_on", { d: d.toLocaleDateString() });
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach(id => {
      const msg = messages.find(m => m.id === id);
      if (msg?.isMe) {
        onAction?.('delete', { messageId: id, deleteForEveryone: true });
      } else {
        onAction?.('delete_for_me', { messageId: id });
      }
    });
    setSelectedIds([]);
    setIsSelectionMode(false);
    toast.success(`${selectedIds.length} message(s) deleted`);
  };

  const isStudent = currentUser?.role === 'student';
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isNearBottomRef = useRef(true);
  const prevScrollInfoRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const isPrependingRef = useRef(false);

  // Track whether the user is near the bottom or top of the scroll container
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distFromBottom < 120;
    setShowScrollBtn(distFromBottom > 200);

    // Infinite scroll up trigger: near top (< 120px)
    if (el.scrollTop < 120 && hasMoreOlderMessages && !isLoadingOlderMessages && onLoadOlderMessages) {
      prevScrollInfoRef.current = {
        scrollHeight: el.scrollHeight,
        scrollTop: el.scrollTop,
      };
      isPrependingRef.current = true;
      onLoadOlderMessages();
    }

    const currentScrollY = el.scrollTop;
    const lastScroll = parseInt(el.dataset.lastScroll || '0', 10);
    const diff = currentScrollY - lastScroll;

    if (Math.abs(diff) > 5) {
      window.dispatchEvent(new CustomEvent('chat-scroll', {
        detail: { direction: diff > 0 ? 'down' : 'up' }
      }));
    }
    el.dataset.lastScroll = currentScrollY.toString();
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  // When messages change: adjust scroll position if prepending older items, or scroll to bottom if near bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el && isPrependingRef.current && prevScrollInfoRef.current) {
      const heightDiff = el.scrollHeight - prevScrollInfoRef.current.scrollHeight;
      el.scrollTop = prevScrollInfoRef.current.scrollTop + heightDiff;
      isPrependingRef.current = false;
      prevScrollInfoRef.current = null;
      return;
    }

    if (isNearBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [messages]);

  // When the conversation changes: instant jump to bottom
  const activeConvId = activeConversation?.id;
  useEffect(() => {
    isNearBottomRef.current = true;
    setShowScrollBtn(false);
    // Slight delay lets the DOM paint the new messages first
    const t = setTimeout(() => scrollToBottom('instant'), 50);
    return () => clearTimeout(t);
  }, [activeConvId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, forcedType?: 'IMAGE' | 'VIDEO' | 'FILE') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const type = forcedType ?? (isImage ? 'IMAGE' : isVideo ? 'VIDEO' : 'FILE');
    const preview = (isImage || isVideo) ? URL.createObjectURL(file) : '';

    setAttachedFile({ file, type, preview });
    setShowAttachMenu(false);
    e.target.value = '';
  };

  const emojis = [
    { cat: "Smileys", items: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕"] },
    { cat: "Gestures", items: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦵", "🦿", "🦶", "👂", "🦻", "👃", "🧠", "🦷", "🦴", "👀", "👁️", "👅", "👄", "💋", "🩸"] },
    { cat: "Hearts", items: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"] },
    { cat: "Nature", items: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🪳", "🦂", "🕸️", "🕷️", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🦬", "🐃", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🦮", "🐕‍🦺", "🐈", "🐈‍⬛", "🐓", "🦃", "🦚", "🦜", "🦢", "🦩", "🕊️", "🐇", "🦝", "🦨", "🦡", "🦫", " Otter", "🦥", "🐁", "🐀", "🐿️", "🦔"] },
    { cat: "Food", items: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔", "🍟", "🍕", "🫓", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗", "🥘", "🫕", "🥣", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛", "☕", "🫖", "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂", "🥃", "🥤", "🧋", "🧃", "🧉", "🧊", "🥢", "🍽️", "🍴", "🥄", "🔪", "🏺"] },
    { cat: "Activities", items: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🎱", "🥏", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", " curling", "🎿", "⛷️", "🏂", "🪂", "🏋️", "🤼", "🤸", "⛹️", "🤺", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗", "🚵", "🚴", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🏵️", "🎫", "🎟️", "🎭", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🪕", "🎻", "🎲", "♟️", "🎯", "🎳", "🎮", "🎰", "🧩"] }
  ];

  const addEmoji = (emoji: string) => {
    setInputValue(prev => prev + emoji);
    // Keep visible if user wants to add multiple, but provide feedback/close logic if needed
  };

  // ── Recording ─────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        recordMode === 'video'
          ? { audio: true, video: { width: { ideal: 400 }, height: { ideal: 400 }, facingMode: 'user' } }
          : { audio: true }
      );

      if (recordMode === 'video') {
        setCameraStream(stream);
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      }

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch (err: any) {
      console.error('Recording error:', err);
      if (err.name === 'NotReadableError') {
        toast.error('Camera or microphone is already in use by another application.');
      } else {
        toast.error(recordMode === 'video' ? 'Camera/Mic access denied' : 'Microphone access denied');
      }
    }
  };

  const stopRecording = (send: boolean) => {
    if (!mediaRecorderRef.current) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const mr = mediaRecorderRef.current;

    const mimeType = recordMode === 'video' ? 'video/webm' : 'audio/webm';
    const ext = 'webm';
    const prefix = recordMode === 'video' ? 'video' : 'voice';

    mr.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      mr.stream.getTracks().forEach(t => t.stop());
      setCameraStream(null);

      if (send && blob.size > 0) {
        const file = new File([blob], `${prefix}-${Date.now()}.${ext}`, { type: mimeType });
        const localUrl = URL.createObjectURL(blob);
        const fileTempId = `temp-${Date.now()}`;
        const controller = new AbortController();

        setUploads(prev => ({
          ...prev,
          [fileTempId]: { 
            progress: 0, 
            controller,
            fileData: { file, type: recordMode === 'video' ? 'VIDEO_MESSAGE' : 'FILE', preview: localUrl },
            text: recordMode === 'video' ? '📹 Video message' : '🎤 Voice message'
          }
        }));

        // 1. Show optimistic message with local preview
        onSendMessage(recordMode === 'video' ? '📹 Video message' : '🎤 Voice message', {
          type: recordMode === 'video' ? 'VIDEO_MESSAGE' : 'FILE',
          attachment: { url: localUrl, name: file.name, type: file.type, size: file.size, isLocal: true },
          isOptimistic: true,
          tempId: fileTempId,
        });

        // 2. Upload and replace with real message
        try {
          const url = await uploadFile(file, (percent) => {
            setUploads(prev => {
              if (!prev[fileTempId]) return prev;
              return { ...prev, [fileTempId]: { ...prev[fileTempId], progress: percent } };
            });
          }, controller.signal);

          onSendMessage(recordMode === 'video' ? '📹 Video message' : '🎤 Voice message', {
            type: recordMode === 'video' ? 'VIDEO_MESSAGE' : 'FILE',
            attachment: { url, name: file.name, type: file.type, size: file.size },
            replaceTempId: fileTempId,
          });
          
          setUploads(prev => {
            const next = { ...prev };
            delete next[fileTempId];
            return next;
          });
        } catch (err: any) {
          if (err.message === 'Upload aborted') {
            onAction?.('cancel_upload', { messageId: fileTempId });
            setUploads(prev => {
              const next = { ...prev };
              delete next[fileTempId];
              return next;
            });
          } else {
            toast.error(`Failed to send ${recordMode} message`);
            onAction?.('upload_failed', { messageId: fileTempId });
          }
        }
      }
    };
    mr.stop();
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const uploadFile = async (
    file: File,
    onProgress: (percent: number) => void,
    abortSignal?: AbortSignal
  ): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}-${Date.now()}.${fileExt}`;
    const filePath = `chat-attachments/${fileName}`;

    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
    const uploadUrl = `${supabaseUrl}/storage/v1/object/communication-attachments/${filePath}`;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', apiKey);

      // Track progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = (event.loaded / event.total) * 100;
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload network error'));
      xhr.onabort = () => reject(new Error('Upload aborted'));

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => xhr.abort());
      }

      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });

    // Use signed URL for privacy (10 years expiration)
    const { data, error: signError } = await supabase.storage
      .from('communication-attachments')
      .createSignedUrl(filePath, 315360000); // 10 years

    if (signError || !data?.signedUrl) {
      // Fallback to public URL if signing fails
      const { data: { publicUrl } } = supabase.storage
        .from('communication-attachments')
        .getPublicUrl(filePath);
      return publicUrl;
    }

    return data.signedUrl;
  };



  const handleSend = async () => {
    if (!inputValue.trim() && !attachedFile) return;

    if (editTarget) {
      onAction?.('edit', { messageId: editTarget.id, content: inputValue });
      setEditTarget(null);
      setInputValue('');
      return;
    }

    const currentInput = inputValue;
    const currentFile = attachedFile;

    // Clear UI instantly
    setInputValue('');
    setAttachedFile(null);
    setReplyTarget(null);

    // Case 1: Just text
    if (!currentFile) {
      onSendMessage(currentInput, { replyToId: replyTarget?.id || undefined });
      return;
    }

    // Case 2: Has attachment
    const fileTempId = `temp-${Date.now()}`;
    const controller = new AbortController();

    setUploads(prev => ({
      ...prev,
      [fileTempId]: { 
        progress: 0, 
        controller,
        fileData: currentFile,
        text: currentInput
      }
    }));

    // 1. Show optimistic message with local preview immediately
    onSendMessage(currentInput || (currentFile.type === 'IMAGE' ? 'Image' : currentFile.type === 'VIDEO' ? 'Video' : 'File'), {
      type: currentFile.type,
      attachment: {
        url: currentFile.preview,
        name: currentFile.file.name,
        type: currentFile.file.type,
        size: currentFile.file.size,
        isLocal: true
      },
      replyToId: replyTarget?.id,
      isOptimistic: true,
      tempId: fileTempId, // ← pin this optimistic message with a known id
    });

    // 2. Upload in background then replace the optimistic message
    try {
      const attachmentUrl = await uploadFile(currentFile.file, (percent) => {
        setUploads(prev => {
          if (!prev[fileTempId]) return prev;
          return { ...prev, [fileTempId]: { ...prev[fileTempId], progress: percent } };
        });
      }, controller.signal);

      onSendMessage(currentInput || (currentFile.type === 'IMAGE' ? 'Image' : currentFile.type === 'VIDEO' ? 'Video' : 'File'), {
        type: currentFile.type,
        attachment: {
          url: attachmentUrl,
          name: currentFile.file.name,
          type: currentFile.file.type,
          size: currentFile.file.size
        },
        replyToId: replyTarget?.id,
        replaceTempId: fileTempId, // ← replace the local preview, not add a new message
      });
      
      // Cleanup uploads state upon success
      setUploads(prev => {
        const next = { ...prev };
        delete next[fileTempId];
        return next;
      });
    } catch (error: any) {
      if (error.message === 'Upload aborted') {
        console.log('Upload canceled');
        onAction?.('cancel_upload', { messageId: fileTempId });
        setUploads(prev => {
          const next = { ...prev };
          delete next[fileTempId];
          return next;
        });
      } else {
        console.error('Error sending message:', error);
        toast.error('Failed to upload file. Please try again.');
        onAction?.('upload_failed', { messageId: fileTempId });
        // Retain the file metadata for retry, but reset controller/abort state
        setUploads(prev => {
          if (!prev[fileTempId]) return prev;
          return {
            ...prev,
            [fileTempId]: {
              ...prev[fileTempId],
              progress: 0,
              failed: true,
            }
          };
        });
      }
    }
  };

  const handleBubbleAction = (action: string, data: any) => {
    const message = data.message;
    switch (action) {
      case 'reply':
        setReplyTarget(message);
        setEditTarget(null);
        focusInput();
        break;
      case 'edit_start':
        setEditTarget(message);
        setReplyTarget(null);
        setInputValue(message.content);
        focusInput();
        break;
      case 'copy':
        navigator.clipboard.writeText(message.content || '');
        toast.success('Copied to clipboard');
        break;
      case 'delete_confirm':
        // Desktop ContextMenu path — open the legacy simple dialog
        setDeleteConfirmMessage(message);
        break;
      case 'long_press':
        // Mobile path — open Telegram-style bottom sheet
        setActionSheetMessage(message);
        break;
      case 'select':
        setIsSelectionMode(true);
        setSelectedIds([message.id]);
        break;
      case 'retry_upload':
        retryUpload(message.id);
        break;
      default:
        onAction?.(action, data);
    }
  };

  if (!activeConversation) {
    if (isMobile) return null;
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f8fafc] dark:bg-slate-950 p-8 text-center relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Logo size="xl" withText={false} href="" />
          </div>

          <h1 className="text-2xl font-black tracking-tighter text-foreground mb-2 uppercase">
            {t("communication")}
          </h1>

          <p className="text-sm text-muted-foreground/60 max-w-[240px] mx-auto leading-relaxed">
            Select a conversation to start chatting
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f0f2f5] dark:bg-slate-950 relative overflow-hidden">
      {/* Telegram-style Background Pattern */}
      <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.08] pointer-events-none"
        style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/curls-run-wild.png")' }}
      />

      {/* Telegram-style Compact Chat Header - With Safe Area for Notch/Status Bar */}
      <header className="h-[calc(88px+env(safe-area-inset-top))] md:h-[96px] border-b border-border/50 bg-background/95 backdrop-blur-md flex items-center justify-between px-3 z-40 sticky top-0 font-sans shadow-sm pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-1 flex-1 min-w-0 h-full">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 rounded-full transition-colors hover:bg-secondary mt-9">
              <ChevronLeft className="h-6 w-6 text-foreground" />
            </Button>
          )}

          <div
            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer h-full pt-10 pb-1"
            onClick={() => onToggleInfo?.()}
          >
            <div className="relative shrink-0 self-center">
              {callStatus !== 'IDLE' && (
                <div className="absolute inset-0 -z-10">
                  <motion.div
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full bg-green-500/60"
                  />
                  <motion.div
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
                    className="absolute inset-0 rounded-full bg-green-500/40"
                  />
                  <motion.div
                    initial={{ scale: 1, opacity: 0.3 }}
                    animate={{ scale: 3, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1.2 }}
                    className="absolute inset-0 rounded-full bg-green-500/20"
                  />
                </div>
              )}
              <Avatar className={cn(
                "h-10 w-10 border overflow-hidden shadow-sm transition-all duration-500",
                callStatus !== 'IDLE' ? "border-green-500 ring-4 ring-green-500/20 scale-110" : "border-border/10"
              )}>
                <AvatarImage src={activeConversation?.avatar || undefined} className="object-cover" />
                <AvatarFallback className={cn(
                  "text-xs font-black transition-colors",
                  callStatus !== 'IDLE' ? "bg-green-500 text-white" : "bg-primary/5 text-primary"
                )}>
                  {activeConversation.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {activeConversation.isOnline && callStatus === 'IDLE' && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-background rounded-full shadow-sm" />
              )}
            </div>
            <div className="flex flex-col min-w-0 justify-center">
              <span className="font-bold text-[15px] truncate tracking-tight text-foreground leading-tight">
                {activeConversation.name}
              </span>
              {activeConversation.isGroup ? (
                <span className="text-[11px] text-muted-foreground/80 truncate">
                  {typingStatus || `${activeConversation.members?.length} members`}
                </span>
              ) : typingStatus ? (
                <span className="text-[11px] text-primary font-bold animate-pulse">{typingStatus}</span>
              ) : activeConversation.isOnline ? (
                <span className="text-[11px] text-primary font-medium tracking-tight">online</span>
              ) : (
                <span className="text-[11px] text-muted-foreground/60">
                  {formatLastSeen(activeConversation.lastActive)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 mt-9">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground/80 hover:bg-secondary">
            <Search className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground/80 hover:bg-secondary">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border/50 shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-200">
              {!isStudent && !activeConversation.isGroup && (
                <>
                  <DropdownMenuItem
                    className={`rounded-xl h-10 gap-3 ${isSuspended ? 'opacity-40 cursor-not-allowed' : ''}`}
                    onClick={() => !isSuspended && initiateCall(activeConversation.realContactId || activeConversation.id, 'VOICE', activeConversation)}
                    title={isSuspended ? 'Voice calls are disabled while the school is suspended' : undefined}
                  >
                    <Phone className="h-4 w-4 text-primary" /> {t("voice_call")}
                    {isSuspended && <span className="ml-auto text-[10px] font-semibold text-orange-500 uppercase">Suspended</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={`rounded-xl h-10 gap-3 ${isSuspended ? 'opacity-40 cursor-not-allowed' : ''}`}
                    onClick={() => !isSuspended && initiateCall(activeConversation.realContactId || activeConversation.id, 'VIDEO', activeConversation)}
                    title={isSuspended ? 'Video calls are disabled while the school is suspended' : undefined}
                  >
                    <Video className="h-4 w-4 text-primary" /> {t("video_call")}
                    {isSuspended && <span className="ml-auto text-[10px] font-semibold text-orange-500 uppercase">Suspended</span>}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 bg-border/40" />
                </>
              )}
              <DropdownMenuItem className="rounded-xl h-10 gap-3">
                <Info className="h-4 w-4" /> {activeConversation.isGroup ? 'Group Info' : t("view_profile")}
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl h-10 gap-3">
                <Bell className="h-4 w-4" /> {t("mute_notifications")}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-border/40" />
              <DropdownMenuItem className="rounded-xl h-10 gap-3 text-destructive focus:bg-destructive/10 focus:text-destructive">
                <Trash2 className="h-4 w-4" /> {activeConversation.isGroup ? 'Leave Group' : t("delete_chat")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Telegram-style thin loading bar at top of messages — never blocks the chat window */}
      {isLoading && (
        <div className="absolute top-[72px] left-0 right-0 z-50 h-[3px] overflow-hidden">
          <div
            className="h-full bg-primary/80 rounded-full"
            style={{
              width: '40%',
              animation: 'telegram-progress 1.2s ease-in-out infinite',
            }}
          />
          <style>{`
            @keyframes telegram-progress {
              0%   { transform: translateX(-100%); width: 40%; }
              50%  { width: 60%; }
              100% { transform: translateX(300%); width: 40%; }
            }
          `}</style>
        </div>
      )}

      {/* Pinned Message Banner */}
      <AnimatePresence>
        {pinnedMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="relative z-30 border-b border-border/40 bg-background/90 backdrop-blur-sm"
          >
            <button
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-secondary/50 transition-colors text-left group"
              onClick={() => {
                // Scroll to the pinned message
                const el = document.getElementById(`msg-${pinnedMessage.messageId}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              <div className="shrink-0 w-0.5 h-8 bg-primary rounded-full" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                  <Pin className="h-3 w-3" /> Pinned Message
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {pinnedMessage.type === 'IMAGE' ? '📷 Photo'
                    : pinnedMessage.type === 'VIDEO' ? '🎥 Video'
                    : pinnedMessage.type === 'FILE' ? '📎 File'
                    : pinnedMessage.content || 'Message'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction?.('pin', { messageId: pinnedMessage.messageId, isPinned: true });
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10 scrollbar-hide"
      >
        {/* Spinner when fetching older messages */}
        {isLoadingOlderMessages && (
          <div className="flex justify-center py-2">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-secondary/80 backdrop-blur text-xs text-muted-foreground shadow-sm animate-pulse">
              <RotateCw className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Loading older messages...</span>
            </div>
          </div>
        )}
        {/* Initial chat loading skeleton */}
        {isLoading && messages.length === 0 ? (
          <MessageWindowSkeleton />
        ) : (
          <>
            <DateSeparator date={t("today")} />
            {(() => {
              const displayMessages = messages.filter(m => !m.isDeleted);
              const rendered: React.ReactNode[] = [];
          let i = 0;
          while (i < displayMessages.length) {
            const message = displayMessages[i];
            const isCallType = message.type === 'CALL_VOICE' || message.type === 'CALL_VIDEO' ||
              message.type === 'CALL_MISSED_VOICE' || message.type === 'CALL_MISSED_VIDEO';

            if (isCallType) {
              const isMissed = message.type === 'CALL_MISSED_VOICE' || message.type === 'CALL_MISSED_VIDEO';
              // Group consecutive missed calls from same sender
              if (isMissed) {
                let count = 1;
                while (
                  i + count < displayMessages.length &&
                  displayMessages[i + count].type === message.type &&
                  displayMessages[i + count].senderId === message.senderId
                ) count++;

                rendered.push(
                  <CallMessageBubble
                    key={message.id}
                    message={message}
                    missedCount={count}
                    onCallAgain={(type) => {
                      if (isSuspended) {
                        toast.error('Portal Read-Only: Calls are disabled while the school is suspended.');
                        return;
                      }
                      const contactId = activeConversation.realContactId || activeConversation.id;
                      initiateCall(contactId, type, activeConversation);
                    }}
                    onAction={handleBubbleAction}
                  />
                );
                i += count;
              } else {
                rendered.push(
                  <CallMessageBubble
                    key={message.id}
                    message={message}
                    missedCount={1}
                    onCallAgain={(type) => {
                      if (isSuspended) {
                        toast.error('Portal Read-Only: Calls are disabled while the school is suspended.');
                        return;
                      }
                      const contactId = activeConversation.realContactId || activeConversation.id;
                      initiateCall(contactId, type, activeConversation);
                    }}
                    onAction={handleBubbleAction}
                  />
                );
                i++;
              }
            } else {
              const isNextSameSender = displayMessages[i + 1]?.senderId === message.senderId;
              rendered.push(
                <MessageBubble
                  key={message.id}
                  message={message}
                  isLastInGroup={!isNextSameSender}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.includes(message.id)}
                  onToggleSelect={() => toggleSelect(message.id)}
                  onEnterSelectionMode={() => setIsSelectionMode(true)}
                  t={t}
                  isGroup={activeConversation.isGroup}
                  onAction={handleBubbleAction}
                  currentUser={currentUser}
                  uploadState={uploads[message.id]}
                  onCancelUpload={handleCancelUpload}
                  isMobile={isMobile}
                />
              );
              i++;
            }
          }
          return rendered;
        })()}
          </>
        )}
        {/* Invisible anchor element always at the very bottom */}
        <div ref={messagesEndRef} className="h-0 w-full" />
      </div>

      {/* Scroll-to-bottom FAB — visible only when scrolled up */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-28 right-4 z-50 h-10 w-10 rounded-full bg-background border border-border shadow-lg flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="h-5 w-5 -rotate-90 text-muted-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating Selection Bar */}
      <AnimatePresence>
        {isSelectionMode && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
          >
            <div className="bg-background/90 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }}>
                  <X className="h-5 w-5" />
                </Button>
                <span className="typography-label">{selectedIds.length} {t("selected")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary"
                  onClick={() => {
                    onAction?.('forward_selected', { messageIds: selectedIds });
                    setIsSelectionMode(false);
                    setSelectedIds([]);
                  }}
                >
                  <Forward className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={deleteSelected}>
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Input */}
      <div className="p-2 md:p-4 bg-background/80 backdrop-blur-md border-t border-border z-50 sticky bottom-0 pb-safe">

        <div className="max-w-4xl w-full mx-auto space-y-2">

          {/* Reply/Edit Preview */}
          <AnimatePresence>
            {(replyTarget || editTarget) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-secondary/30 border-l-4 border-primary rounded-r-xl px-4 py-3 flex items-center justify-between group overflow-hidden"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {replyTarget ? (
                      <>
                        <Reply className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{t("replying_to", { name: replyTarget.senderName })}</span>
                      </>
                    ) : (
                      <>
                        <FileType className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Editing Message</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate italic">
                    {(replyTarget || editTarget)?.content || "File"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => { setReplyTarget(null); setEditTarget(null); if (editTarget) setInputValue(''); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recording UI */}
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3"
              >
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
                <div className="flex-1 flex items-center gap-1">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-0.5 bg-red-500 rounded-full"
                      animate={{ height: [4, Math.random() * 24 + 4, 4] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.05 }}
                    />
                  ))}
                </div>
                <span className="text-sm font-mono text-red-500 shrink-0">
                  {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground" onClick={() => stopRecording(false)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* File Preview */}
          <AnimatePresence>
            {attachedFile && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-secondary/30 rounded-xl p-2 flex items-center gap-3 border border-border/50"
              >
                {attachedFile.type === 'IMAGE' ? (
                  <div className="h-12 w-12 rounded-lg overflow-hidden border border-border shrink-0">
                    <img src={attachedFile.preview} alt="preview" className="w-full h-full object-cover" />
                  </div>
                ) : attachedFile.type === 'VIDEO' ? (
                  <div className="h-12 w-12 rounded-lg overflow-hidden border border-border bg-black shrink-0 relative">
                    <video src={attachedFile.preview} className="w-full h-full object-cover opacity-70" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video className="h-5 w-5 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    <FileIcon className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="typography-label truncate text-sm">{attachedFile.file.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{attachedFile.type.toLowerCase()} • {(attachedFile.file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full shrink-0" onClick={() => setAttachedFile(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-1.5 md:gap-2 relative w-full">
            {/* Hidden file inputs */}
            <input type="file" ref={fileInputRef} accept="image/*" onChange={(e) => handleFileSelect(e, 'IMAGE')} className="hidden" />
            <input type="file" ref={videoInputRef} accept="video/*" onChange={(e) => handleFileSelect(e, 'VIDEO')} className="hidden" />
            <input type="file" ref={docInputRef} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt" onChange={(e) => handleFileSelect(e, 'FILE')} className="hidden" />

            {/* Attachment button + popup */}
            <div className="relative shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-12 w-12 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all active:scale-90"
                onClick={() => setShowAttachMenu(v => !v)}
              >
                <Paperclip className="h-6 w-6" />
              </Button>
              <AnimatePresence>
                {showAttachMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.9 }}
                    className="absolute bottom-16 left-0 bg-background border border-border/50 shadow-2xl rounded-[24px] p-2.5 flex flex-col gap-1.5 min-w-[200px] z-50 animate-in fade-in slide-in-from-bottom-2"
                  >
                    <button
                      className="flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-secondary/70 text-sm text-left transition-all active:scale-[0.98] group"
                      onClick={() => { fileInputRef.current?.click(); }}
                    >
                      <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <ImageIcon className="h-5 w-5 text-blue-500 group-hover:text-white" />
                      </div>
                      <span className="font-bold text-foreground/80 tracking-tight">Photo</span>
                    </button>
                    <button
                      className="flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-secondary/70 text-sm text-left transition-all active:scale-[0.98] group"
                      onClick={() => { videoInputRef.current?.click(); }}
                    >
                      <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 group-hover:bg-red-500 group-hover:text-white transition-colors">
                        <Video className="h-5 w-5 text-red-500 group-hover:text-white" />
                      </div>
                      <span className="font-bold text-foreground/80 tracking-tight">Video</span>
                    </button>
                    <button
                      className="flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-secondary/70 text-sm text-left transition-all active:scale-[0.98] group"
                      onClick={() => { docInputRef.current?.click(); }}
                    >
                      <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                        <FileText className="h-5 w-5 text-amber-500 group-hover:text-white" />
                      </div>
                      <span className="font-bold text-foreground/80 tracking-tight">Document</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Text input */}
            <div className="bg-secondary/50 rounded-2xl flex-1 flex items-end p-1.5 focus-within:ring-1 focus-within:ring-primary/20 transition-all relative min-w-0">
              <div className="relative shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("rounded-full h-9 w-9 text-muted-foreground hover:text-primary shrink-0", showEmojiPicker && "text-primary bg-primary/10")}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Smile className="h-5 w-5" />
                </Button>

                <AnimatePresence>
                  {showEmojiPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-12 left-0 w-[280px] md:w-[350px] max-h-[400px] bg-background border border-border shadow-2xl rounded-2xl p-4 overflow-hidden z-50 flex flex-col"
                      >
                        <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                          <span className="typography-label text-xs font-bold uppercase tracking-widest text-primary">Emoji Picker</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setShowEmojiPicker(false)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="overflow-y-auto pr-2 custom-scrollbar space-y-4">
                          {emojis.map((group) => (
                            <div key={group.cat}>
                              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{group.cat}</h4>
                              <div className="grid grid-cols-7 md:grid-cols-8 gap-1">
                                {group.items.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => addEmoji(emoji)}
                                    className="h-8 w-8 flex items-center justify-center text-xl hover:bg-primary/10 rounded-lg transition-all active:scale-90"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              <textarea
                placeholder={isRecording ? 'Recording…' : t('write_message')}
                value={inputValue}
                disabled={isRecording}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                className="flex-1 w-full min-w-0 bg-transparent border-none focus:ring-0 focus:outline-none py-2 px-3 text-[15px] resize-none max-h-32 scrollbar-hide disabled:opacity-50"
              />
            </div>

            {/* Send / Mic / Video button */}
            {isRecording ? (
              <Button
                onClick={() => stopRecording(true)}
                className="rounded-full h-12 w-12 shrink-0 shadow-lg bg-red-500 hover:bg-red-600 transition-all active:scale-95 animate-pulse"
              >
                <StopCircle className="h-6 w-6 text-white" />
              </Button>
            ) : (inputValue.trim() || attachedFile) ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="shrink-0"
              >
                <Button
                  onClick={handleSend}
                  className="rounded-full h-12 w-12 shrink-0 shadow-xl bg-primary hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center p-0"
                >
                  <Send className="h-6 w-6 text-white ml-0.5" />
                </Button>
              </motion.div>
            ) : (
              <div className="flex items-center shrink-0">
                <Button
                  onMouseDown={startRecording}
                  onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                  className={cn(
                    "rounded-full h-12 w-12 shrink-0 shadow-lg transition-all active:scale-95",
                    recordMode === 'video' ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-primary"
                  )}
                  title={recordMode === 'video' ? "Hold to record video message" : "Hold to record voice message"}
                >
                  {recordMode === 'video' ? <Video className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </Button>
                {!isRecording && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-1 h-9 w-9 text-muted-foreground/30 hover:text-primary"
                    onClick={() => setRecordMode(m => m === 'audio' ? 'video' : 'audio')}
                  >
                    {recordMode === 'video' ? <Mic className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Video Recording Preview */}
        <AnimatePresence>
          {isRecording && recordMode === 'video' && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute bottom-24 right-4 w-40 h-40 rounded-full border-4 border-primary shadow-2xl overflow-hidden z-50 bg-black"
            >
              <video
                ref={videoPreviewRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/50 px-2 py-0.5 rounded text-[10px] text-white font-mono">
                REC
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-10 cursor-zoom-out"
            onClick={() => setPreviewImage(null)}
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/10"
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-8 w-8" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <ImagePreviewListener onPreview={setPreviewImage} />

      {/* Telegram-style Message Action Bottom Sheet (mobile long-press) */}
      <MessageActionSheet
        message={actionSheetMessage}
        isOpen={!!actionSheetMessage}
        onClose={() => setActionSheetMessage(null)}
        canDeleteForEveryone={actionSheetMessage?.isMe ?? false}
        otherPersonName={activeConversation?.isGroup ? undefined : activeConversation?.name}
        isGroup={!!activeConversation?.isGroup}
        onCopy={() => {
          navigator.clipboard.writeText(actionSheetMessage?.content || '');
          toast.success('Copied to clipboard');
        }}
        onReply={() => {
          if (actionSheetMessage) setReplyTarget(actionSheetMessage);
          setEditTarget(null);
          focusInput();
        }}
        onEdit={() => {
          if (actionSheetMessage) {
            setEditTarget(actionSheetMessage);
            setReplyTarget(null);
            setInputValue(actionSheetMessage.content || '');
            focusInput();
          }
        }}
        onPin={() => {
          if (actionSheetMessage) {
            onAction?.('pin', {
              messageId: actionSheetMessage.id,
              isPinned: !!(actionSheetMessage as any).isPinned,
              content: actionSheetMessage.content,
              senderName: (actionSheetMessage as any).senderName,
            });
          }
        }}
        onForward={() => {
          if (actionSheetMessage) onAction?.('forward', { message: actionSheetMessage });
        }}
        onBookmark={async () => {
          if (!actionSheetMessage) return;
          try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
            const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null;
            const res = await fetch(`${API_URL}/api/messages/${actionSheetMessage.id}/bookmark`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(schoolId ? { 'x-school-id': schoolId } : {}),
              },
            });
            if (res.ok) {
              const data = await res.json();
              toast.success(data.isBookmarked ? 'Saved to bookmarks' : 'Removed from bookmarks');
            } else {
              toast.error('Failed to bookmark message');
            }
          } catch (err) {
            toast.error('Failed to bookmark message');
          }
        }}
        onDelete={(deleteForEveryone) => {
          if (actionSheetMessage) {
            if (deleteForEveryone) {
              onAction?.('delete', { messageId: actionSheetMessage.id, deleteForEveryone: true });
            } else {
              onAction?.('delete_for_me', { messageId: actionSheetMessage.id });
            }
          }
        }}
      />


      {/* Desktop Delete Confirmation Dialog (from ContextMenu) */}
      <AnimatePresence>
        {deleteConfirmMessage && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmMessage(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="relative z-10 bg-background rounded-3xl border border-border shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-5 border-b border-border/50">
                <h3 className="font-bold text-base text-foreground">Delete this message?</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {deleteConfirmMessage.isMe
                    ? 'Choose who to delete this message for.'
                    : 'This will remove the message from your view.'}
                </p>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {deleteConfirmMessage.isMe && (
                  <Button
                    variant="destructive"
                    className="w-full rounded-2xl h-11 font-bold"
                    onClick={() => {
                      onAction?.('delete', { messageId: deleteConfirmMessage.id, deleteForEveryone: true });
                      setDeleteConfirmMessage(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete for Everyone
                  </Button>
                )}
                <Button
                  variant={deleteConfirmMessage.isMe ? 'outline' : 'destructive'}
                  className="w-full rounded-2xl h-11 font-bold"
                  onClick={() => {
                    if (deleteConfirmMessage.isMe) {
                      onAction?.('delete_for_me', { messageId: deleteConfirmMessage.id });
                    } else {
                      onAction?.('delete_for_me', { messageId: deleteConfirmMessage.id });
                    }
                    setDeleteConfirmMessage(null);
                  }}
                >
                  {deleteConfirmMessage.isMe ? 'Delete for Me' : <><Trash2 className="h-4 w-4 mr-2" />Delete</>}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full rounded-2xl h-11"
                  onClick={() => setDeleteConfirmMessage(null)}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatCallDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── CallMessageBubble ───────────────────────────────────────────────────────
const CallMessageBubble = React.memo(({ message, missedCount, onCallAgain, onAction }: {
  message: Message;
  missedCount: number;
  onCallAgain: (type: 'VOICE' | 'VIDEO') => void;
  onAction?: (action: string, data: any) => void;
}) => {
  const isMe = message.isMe;
  const isVideo = message.type === 'CALL_VIDEO' || message.type === 'CALL_MISSED_VIDEO';
  const metadata = (message as any).metadata as { duration?: number; reason?: string } | null;
  const duration = metadata?.duration || 0;
  const reason = metadata?.reason?.toUpperCase();

  // Variant category
  // Green: Completed call
  // Red: Missed, Cancelled, Declined, Failed
  // Gray: Ongoing or informational
  let status: 'completed' | 'missed' | 'cancelled' | 'declined' | 'failed' | 'info' = 'info';
  let label = '';
  const typeLabel = isVideo ? "video call" : "voice call";

  if (duration > 0) {
    status = 'completed';
    const formattedDuration = formatCallDuration(duration);
    label = isMe 
      ? `📞 Call ended — Duration: ${formattedDuration}` 
      : `📞 Answered — Duration: ${formattedDuration}`;
  } else if (reason === 'CANCELLED') {
    if (isMe) {
      status = 'cancelled';
      label = "❌ Cancelled";
    } else {
      status = 'missed';
      label = isVideo ? `❌ Missed video call` : `❌ Missed voice call`;
      if (missedCount > 1) {
        label = `❌ ${missedCount} missed ${typeLabel}s`;
      }
    }
  } else if (reason === 'DECLINED' || reason === 'BUSY') {
    if (isMe) {
      status = 'declined';
      label = reason === 'BUSY' ? '❌ Busy' : '❌ Declined';
    } else {
      status = 'declined';
      label = isVideo ? "🚫 Declined video call" : "🚫 Declined voice call";
    }
  } else if (reason === 'MISSED' || reason === 'NO_ANSWER') {
    if (isMe) {
      status = 'missed';
      label = "❌ No answer";
    } else {
      status = 'missed';
      label = isVideo ? `❌ Missed video call` : `❌ Missed voice call`;
      if (missedCount > 1) {
        label = `❌ ${missedCount} missed ${typeLabel}s`;
      }
    }
  } else if (reason === 'FAILED') {
    status = 'failed';
    label = "❌ Failed";
  } else {
    // Info/Ongoing
    status = 'info';
    if (isMe) {
      label = isVideo ? "📹 Outgoing video call" : "📞 Outgoing voice call";
    } else {
      label = isVideo ? "📹 Incoming video call" : "📞 Incoming voice call";
    }
  }

  // Set colors and icons
  let circleBg = 'bg-slate-100 dark:bg-slate-800 text-gray-500';
  let titleColor = 'text-foreground';
  
  if (status === 'completed') {
    circleBg = 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500';
  } else if (status === 'info') {
    circleBg = 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500';
  } else {
    titleColor = 'text-rose-500';
    circleBg = 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-500';
  }

  const handleCallAgain = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCallAgain(isVideo ? 'VIDEO' : 'VOICE');
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex justify-center my-1.5"
        >
          <div
            className="flex items-center gap-3 bg-white/95 dark:bg-slate-900 border border-border/40 rounded-2xl px-4 py-2.5 shadow-sm hover:shadow-md transition-all cursor-pointer max-w-[300px] backdrop-blur-sm group select-none relative overflow-hidden"
            onClick={handleCallAgain}
            title="Tap to call again"
          >
            {/* Circular status indicator */}
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center shrink-0 relative transition-transform group-hover:scale-105",
              circleBg
            )}>
              {isVideo ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
              
              {/* Call indicator badge */}
              {status !== 'failed' && (
                <div className={cn(
                  "absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-background flex items-center justify-center text-white shadow-sm",
                  isMe ? "bg-blue-500" : "bg-teal-500"
                )}>
                  {isMe ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                </div>
              )}
            </div>

            {/* Details body */}
            <div className="flex flex-col min-w-0 flex-1">
              <span className={cn("text-[13px] font-bold leading-tight truncate tracking-tight", titleColor)}>
                {label}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-muted-foreground/60">
                  {message.timestamp}
                </span>
              </div>
            </div>

            {/* Tap to Call Again indicator */}
            <div className="flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
              <div className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center bg-primary/10 text-primary"
              )}>
                {isVideo ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
              </div>
            </div>
          </div>
        </motion.div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52 rounded-2xl border-border/50 shadow-2xl p-1.5 animate-in fade-in zoom-in-95">
        <ContextMenuItem
          className="rounded-xl h-10 gap-3 font-medium"
          onClick={() => onCallAgain(isVideo ? 'VIDEO' : 'VOICE')}
        >
          {isVideo ? <Video className="h-4 w-4 text-primary" /> : <Phone className="h-4 w-4 text-primary" />}
          Call again
        </ContextMenuItem>
        <ContextMenuSeparator className="my-1 bg-border/40" />
        <ContextMenuItem
          className="rounded-xl h-10 gap-3"
          onClick={() => {
            const cleanLabel = label.replace(/^[^\w\s\p{Alpha}]*/u, '').trim();
            const textToCopy = `${cleanLabel} (${message.timestamp})`;
            navigator.clipboard.writeText(textToCopy);
            toast.success('Call details copied');
          }}
        >
          <Copy className="h-4 w-4" />
          Copy call details
        </ContextMenuItem>
        <ContextMenuItem
          className="rounded-xl h-10 gap-3"
          onClick={() => onAction?.('forward', { message })}
        >
          <Forward className="h-4 w-4" />
          Forward
        </ContextMenuItem>
        <ContextMenuSeparator className="my-1 bg-border/40" />
        <ContextMenuItem
          className="rounded-xl h-10 gap-3 text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={() => onAction?.('delete_confirm', { message })}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

const ImagePreviewListener = ({ onPreview }: { onPreview: (url: string) => void }) => {
  useEffect(() => {
    (window as any).showImagePreview = (url: string) => {
      const event = new CustomEvent('show-image-preview', { detail: url });
      window.dispatchEvent(event);
    };

    const handle = (e: any) => onPreview(e.detail);
    window.addEventListener('show-image-preview', handle);
    return () => {
      window.removeEventListener('show-image-preview', handle);
      delete (window as any).showImagePreview;
    };
  }, [onPreview]);
  return null;
};

const CustomAudioPlayer = React.memo(({ url, isMe }: { url: string, isMe: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn(
      "flex items-center gap-3 py-2 px-3 rounded-2xl min-w-[200px] border border-white/10 shadow-sm",
      isMe ? "bg-primary-foreground/10 text-white" : "bg-secondary text-foreground"
    )}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-10 w-10 rounded-full shrink-0 shadow-lg active:scale-95 transition-all",
          isMe ? "bg-white text-primary hover:bg-white/90" : "bg-primary text-white hover:bg-primary/90"
        )}
        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
      >
        {isPlaying ? <div className="flex gap-0.5"><div className="w-1 h-3 bg-current rounded-full" /><div className="w-1 h-3 bg-current rounded-full" /></div> : <Play className="h-5 w-5 ml-1 fill-current" />}
      </Button>
      <div className="flex-1 flex flex-col gap-1.5 pr-2">
        <div className="h-1.5 bg-current/10 rounded-full overflow-hidden relative">
          <motion.div
            className="absolute top-0 left-0 h-full bg-current"
            initial={false}
            animate={{ width: `${(currentTime / duration) * 100 || 0}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-medium opacity-60">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
});

const UploadProgressOverlay = ({
  progress = 0,
  onCancel,
}: {
  progress?: number;
  onCancel?: () => void;
}) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all z-20">
      {/* Semi-transparent Telegram-style circle with X inside */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel?.();
        }}
        className="w-12 h-12 rounded-full bg-black/55 shadow-lg flex items-center justify-center text-white hover:bg-black/75 transition-colors active:scale-95 group/cancel"
      >
        <X className="h-5 w-5 stroke-[2.5]" />
      </button>

      {/* Percentage badge */}
      <div className="mt-2 bg-black/70 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white tracking-widest shadow-md select-none">
        {progress.toFixed(1)}%
      </div>
    </div>
  );
};

interface CircularProgressProps {
  progress: number;
  status: 'idle' | 'pending' | 'transferring' | 'completed' | 'failed';
  onClick?: (e: React.MouseEvent) => void;
  size?: number;
  strokeWidth?: number;
  completedIcon?: React.ReactNode;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  status,
  onClick,
  size = 40,
  strokeWidth = 2.5,
  completedIcon,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.max(0, Math.min(progress, 100)) / 100) * circumference;

  return (
    <div
      onClick={onClick}
      className="relative flex items-center justify-center shrink-0 cursor-pointer select-none rounded-full hover:scale-105 active:scale-95 transition-transform bg-primary/10 dark:bg-slate-800/40"
      style={{ width: size, height: size }}
    >
      <svg className="absolute inset-0 -rotate-90 w-full h-full">
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-primary/10 fill-none"
          strokeWidth={strokeWidth}
        />
        {/* Foreground animated progress circle */}
        {(status === 'transferring' || status === 'pending') && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-primary fill-none transition-[stroke-dashoffset] duration-150"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        )}
      </svg>
      {/* Icon Overlay inside circle */}
      <div className="z-10 flex items-center justify-center text-primary">
        {status === 'idle' && <Download className="h-4 w-4 text-primary" />}
        {status === 'pending' && <Clock className="h-4 w-4 animate-pulse text-primary" />}
        {status === 'transferring' && <X className="h-4 w-4 text-primary stroke-[2.5]" />}
        {status === 'failed' && <RotateCw className="h-4 w-4 text-destructive animate-spin-reverse" />}
        {status === 'completed' && (completedIcon || <FileText className="h-4 w-4 text-primary" />)}
      </div>
    </div>
  );
};

const AttachmentRenderer = ({
  file: rawFile,
  onImageClick,
  isCompact,
  isMe,
  status,
  uploadState,
  onCancelUpload,
  onRetryUpload,
}: {
  file: any;
  onImageClick: (url: string) => void;
  isCompact?: boolean;
  isMe: boolean;
  status?: string;
  uploadState?: { progress: number };
  onCancelUpload?: () => void;
  onRetryUpload?: () => void;
}) => {
  const file = rawFile.create ? rawFile.create : rawFile;
  const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.url);
  const isAudio = file.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.url) || file.url.includes('voice-');
  const isVideo = (file.type?.startsWith('video/') || /\.(mp4|webm)$/i.test(file.url)) && !file.url.includes('voice-');
  const isSending = status === 'sending';
  const isUploading = isSending && uploadState && uploadState.progress < 100;

  const [downloadState, setDownloadState] = useState<{
    progress: number;
    loaded: number;
    total: number;
    status: 'idle' | 'pending' | 'transferring' | 'completed' | 'failed';
    localUrl?: string;
  }>({
    progress: 0,
    loaded: 0,
    total: 0,
    status: 'idle',
  });

  useEffect(() => {
    if (isImage || isVideo || isSending) return;

    // Check Cache on mount
    fileTransferManager.checkCache(file.url).then(cachedUrl => {
      if (cachedUrl) {
        setDownloadState({
          progress: 100,
          loaded: file.size || 0,
          total: file.size || 0,
          status: 'completed',
          localUrl: cachedUrl,
        });
      }
    });

    // Subscribe to transfer manager progress updates
    const unsubscribe = fileTransferManager.subscribe(file.url, (state) => {
      setDownloadState(state);
    });

    return () => unsubscribe();
  }, [file.url, file.size, isImage, isVideo, isSending]);

  const handleDownloadAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSending) return;

    if (downloadState.status === 'completed' && downloadState.localUrl) {
      window.open(downloadState.localUrl, '_blank');
    } else if (downloadState.status === 'transferring' || downloadState.status === 'pending') {
      fileTransferManager.cancelDownload(file.url);
    } else {
      try {
        await fileTransferManager.downloadFile(file.url, file.name);
      } catch (err) {
        console.error('[Download error]', err);
      }
    }
  };

  const getFileIcon = (url: string) => {
    if (url.endsWith('.pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (url.match(/\.(docx|doc|rtf)$/)) return <FileText className="h-5 w-5 text-blue-500" />;
    if (url.match(/\.(xlsx|xls|csv)$/)) return <FileType className="h-5 w-5 text-emerald-500" />;
    if (url.match(/\.(pptx|ppt)$/)) return <FileType className="h-5 w-5 text-orange-500" />;
    if (url.match(/\.(zip|rar|7z|tar|gz)$/)) return <FileArchive className="h-5 w-5 text-yellow-600" />;
    return <Paperclip className="h-5 w-5 text-primary" />;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isImage) {
    return (
      <div
        className={cn(
          "overflow-hidden cursor-pointer hover:opacity-95 transition-opacity relative group",
          isCompact ? "rounded-lg" : "rounded-xl border border-border/10"
        )}
        onClick={() => {
          if (!isSending) onImageClick(file.url);
        }}
      >
        <img
          src={file.url}
          alt={file.name || "Image"}
          className={cn("w-full h-auto max-h-[400px] object-cover", isSending && "opacity-60 blur-[1px]")}
          loading="lazy"
        />
        {!isSending && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Search className="text-white h-8 w-8" />
          </div>
        )}
        {isUploading && (
          <UploadProgressOverlay
            progress={uploadState?.progress || 0}
            onCancel={onCancelUpload}
          />
        )}
      </div>
    );
  }

  if (isAudio) {
    return <CustomAudioPlayer url={file.url} isMe={isMe} />;
  }

  if (isVideo || rawFile.type === 'VIDEO_MESSAGE') {
    const isCircular = rawFile.type === 'VIDEO_MESSAGE';
    const [isMuted, setIsMuted] = useState(isCircular);

    return (
      <div
        className={cn(
          "overflow-hidden relative bg-black cursor-pointer",
          isCircular
            ? "rounded-full w-48 h-48 border-4 border-white/20 shadow-xl mx-auto my-2"
            : (isCompact ? "rounded-lg" : "rounded-xl border border-border/10")
        )}
        onClick={() => {
          if (!isSending) setIsMuted(!isMuted);
        }}
      >
        <video
          src={file.url}
          controls={!isCircular && !isSending}
          autoPlay={isCircular && !isSending}
          loop={isCircular}
          muted={isMuted}
          playsInline
          className={cn(
            "w-full h-full",
            isCircular ? "object-cover" : "max-h-[400px]",
            isSending && "opacity-60 blur-[1px]"
          )}
        />
        {isCircular && !isSending && (
          <>
            <div className="absolute inset-0 border-[6px] border-black/10 rounded-full pointer-events-none" />
            {isMuted && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/50 p-2 rounded-full">
                  <MicOff className="h-6 w-6 text-white" />
                </div>
              </div>
            )}
          </>
        )}
        {isUploading && (
          <UploadProgressOverlay
            progress={uploadState?.progress || 0}
            onCancel={onCancelUpload}
          />
        )}
      </div>
    );
  }

  const isFailed = status === 'failed';

  return (
    <div
      className={cn(
        "bg-background/40 dark:bg-slate-800/40 border border-border/10 flex items-center gap-4 hover:bg-background/60 transition-all cursor-pointer group backdrop-blur-sm shadow-sm relative",
        isCompact ? "rounded-lg p-3" : "rounded-xl p-3"
      )}
      onClick={(e) => {
        if (isFailed) {
          e.stopPropagation();
          onRetryUpload?.();
        } else {
          handleDownloadAction(e);
        }
      }}
    >
      <div className="shrink-0 relative">
        {isUploading ? (
          <CircularProgress
            progress={uploadState?.progress || 0}
            status="transferring"
            onClick={(e) => {
              e.stopPropagation();
              onCancelUpload?.();
            }}
          />
        ) : isFailed ? (
          <CircularProgress
            progress={0}
            status="failed"
            onClick={(e) => {
              e.stopPropagation();
              onRetryUpload?.();
            }}
          />
        ) : (
          <CircularProgress
            progress={downloadState.progress}
            status={downloadState.status}
            onClick={handleDownloadAction}
            completedIcon={getFileIcon(file.url)}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="typography-label truncate group-hover:text-primary transition-colors">{file.name || "Document"}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs">
          {isUploading ? (
            <span className="text-[10px] font-medium text-primary/80">
              Uploading... {Math.round(uploadState?.progress || 0)}% • {formatSize(((uploadState?.progress || 0) * file.size) / 100)} / {formatSize(file.size)}
            </span>
          ) : isFailed ? (
            <span className="text-[10px] font-medium text-destructive/80">
              Upload failed • {formatSize(file.size)} • Tap to retry
            </span>
          ) : downloadState.status === 'transferring' ? (
            <span className="text-[10px] font-medium text-primary/80">
              Downloading... {Math.round(downloadState.progress)}% • {formatSize(downloadState.loaded)} / {formatSize(downloadState.total || file.size)}
            </span>
          ) : downloadState.status === 'completed' ? (
            <span className="text-[10px] font-medium text-muted-foreground/80 flex items-center gap-1.5">
              <span className="uppercase">{file.url.split('.').pop() || 'FILE'}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>{formatSize(file.size)}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span className="text-green-500 font-bold">Cached</span>
            </span>
          ) : downloadState.status === 'failed' ? (
            <span className="text-[10px] font-medium text-destructive/80">
              Download failed • {formatSize(file.size)} • Tap to retry
            </span>
          ) : (
            <span className="text-[10px] font-medium text-muted-foreground/80 flex items-center gap-1.5">
              <span className="uppercase">{file.url.split('.').pop() || 'FILE'}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>{formatSize(file.size)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0">
        {isUploading ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onCancelUpload?.();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : isFailed ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRetryUpload?.();
            }}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        ) : downloadState.status === 'transferring' || downloadState.status === 'pending' ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              fileTransferManager.cancelDownload(file.url);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : downloadState.status === 'completed' ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground"
            onClick={handleDownloadAction}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        ) : downloadState.status === 'failed' ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors text-destructive"
            onClick={handleDownloadAction}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground"
            onClick={handleDownloadAction}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

const LinkPreview = React.memo(({ url }: { url: string }) => {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchMetadata = async () => {
      try {
        const domain = new URL(url).hostname;
        if (isMounted) {
          setMetadata({
            title: domain,
            description: `Click to visit ${domain}`,
            url,
            domain,
            favicon: `https://www.google.com/s2/favicons?sz=64&domain=${domain}`
          });
          setLoading(false);
        }
      } catch (e) {
        if (isMounted) setLoading(false);
      }
    };
    fetchMetadata();
    return () => { isMounted = false; };
  }, [url]);

  if (loading) return null;

  return (
    <div
      className="mt-2 border-l-2 border-primary bg-primary/5 rounded-r-lg p-2 hover:bg-primary/10 transition-all cursor-pointer group max-w-sm"
      onClick={(e) => {
        e.stopPropagation();
        window.open(url, '_blank');
      }}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <div className="h-3 w-3 shrink-0">
          <img
            src={metadata?.favicon}
            alt=""
            className="h-full w-full rounded-sm"
            onError={(e) => {
              (e.target as any).style.display = 'none';
              (e.target as any).parentElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe h-3 w-3 text-primary/70"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/><path d="M2 12h20"/></svg>';
            }}
          />
        </div>
        <span className="typography-label text-[10px] uppercase text-primary/70">{metadata?.domain}</span>
      </div>
      <h5 className="typography-label text-[13px] text-foreground group-hover:text-primary transition-colors line-clamp-1">{metadata?.title}</h5>
      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{metadata?.description}</p>
    </div>
  );
});

const MessageBubble = React.memo(({
  message,
  isLastInGroup,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onEnterSelectionMode,
  t,
  isGroup,
  onAction,
  currentUser,
  uploadState,
  onCancelUpload,
  isMobile,
}: {
  message: Message,
  isLastInGroup: boolean,
  isSelectionMode: boolean,
  isSelected: boolean,
  onToggleSelect: () => void,
  onEnterSelectionMode: () => void,
  t: any,
  isGroup: boolean,
  onAction?: (action: string, data: any) => void,
  currentUser: any,
  uploadState?: { progress: number },
  onCancelUpload?: (tempId: string) => void,
  isMobile?: boolean
}) => {
  const isMe = message.isMe;
  const hasAttachments = message.attachments && message.attachments.length > 0;

  // Telegram-style large emojis: check if content is only emojis
  const emojiOnlyRegex = /^(\s*(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}|\p{Emoji_Modifier})\s*)+$/u;
  const isEmojiOnly = Boolean(!hasAttachments && message.content && emojiOnlyRegex.test(message.content));

  const isMediaOnly = Boolean((hasAttachments &&
    (!message.content || message.content === 'Image' || message.content === 'Video' || message.content === 'File')) ||
    message.type === 'VIDEO_MESSAGE' || message.type === 'VIDEO' || message.type === 'IMAGE' || isEmojiOnly);

  // ── Long-press detection for mobile ──────────────────────────────────────
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const startLongPress = useCallback((e: React.TouchEvent) => {
    // Record position to detect drag vs press
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressTimer.current = setTimeout(() => {
      if (!message.status || message.status !== 'sending') {
        // Haptic feedback on devices that support it
        if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
          (navigator as any).vibrate(30);
        }
        handleAction('long_press');
      }
    }, 500);
  }, [message.status]); // eslint-disable-line

  const cancelLongPress = useCallback((e?: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    // Cancel if scrolling / swiping
    if (dx > 10 || dy > 10) cancelLongPress();
  }, [cancelLongPress]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  const handleAction = (action: string, data?: any) => {
    onAction?.(action, { message, ...data });
  };

  const reactions = (message as any).reactions || [];
  const uniqReactions = Array.from(new Set(reactions.map((r: any) => r.emoji)));

  return (
    <motion.div
      id={`msg-${message.id}`}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "flex flex-col group relative transition-all",
        isMe ? "ml-auto items-end" : "mr-auto items-start",
        isMediaOnly ? "max-w-[70%] md:max-w-[40%] w-full" : "max-w-[75%]",
        isLastInGroup && "mb-2",
        isSelectionMode && "cursor-pointer"
      )}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={handleTouchMove}
      onTouchCancel={cancelLongPress}
    >
      {!isMe && isGroup && isLastInGroup && (
        <div className="flex items-center gap-2 mb-1 px-1">
          <Avatar className="h-5 w-5 border border-border/50">
            <AvatarImage src={(message as any).senderAvatar} />
            <AvatarFallback className="bg-primary/20 text-[8px] font-bold text-primary">
              {(message as any).senderName?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-[10px] font-bold text-primary/80 uppercase">{(message as any).senderName}</span>
        </div>
      )}
      <div className={cn(
        "relative transition-all shadow-sm",
        message.isDeleted ? "opacity-50 grayscale italic" : ""
      )}>
        <div className={cn(
          "relative transition-all shadow-sm overflow-hidden",
          (message.type === 'VIDEO_MESSAGE' || isEmojiOnly)
            ? "p-0 bg-transparent border-none shadow-none"
            : (isMediaOnly
              ? "p-1 rounded-xl bg-white dark:bg-slate-900 border border-border/40"
              : cn(
                "pl-3 pr-12 py-2 rounded-2xl text-[15px]",
                isMe
                  ? "bg-primary text-primary-foreground rounded-br-none"
                  : "bg-white dark:bg-slate-900 border border-border/50 text-foreground rounded-bl-none"
              )),
          !isLastInGroup && !isMediaOnly && (isMe ? "rounded-br-sm" : "rounded-bl-sm")
        )}
          style={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {isMobile ? (
            <div
              className={cn(
                "select-text w-full relative",
                isMediaOnly ? "leading-[0]" : ""
              )}
              style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              {/* ── Forwarded tag ─────────────────────────────────── */}
              {(message as any).forwardedFrom && !message.isDeleted && (
                <div className={cn(
                  "flex items-center gap-1 text-[10px] font-medium mb-1.5",
                  isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  <Forward className="h-3 w-3" />
                  <span>Forwarded</span>
                </div>
              )}

              {/* ── Reply-to quote preview ────────────────────────── */}
              {(message as any).replyTo && !message.isDeleted && (
                <div className={cn(
                  "flex items-stretch gap-0 mb-1.5 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity",
                  isMe
                    ? "bg-white/15 border border-white/20"
                    : "bg-primary/8 border border-primary/20"
                )}
                  onClick={(e) => {
                    e.stopPropagation();
                    const el = document.getElementById(`msg-${(message as any).replyTo?.id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  <div className={cn(
                    "w-1 shrink-0",
                    isMe ? "bg-white/60" : "bg-primary"
                  )} />
                  <div className="px-2 py-1.5 min-w-0 flex-1">
                    <p className={cn(
                      "text-[11px] font-bold truncate",
                      isMe ? "text-primary-foreground/90" : "text-primary"
                    )}>
                      {(message as any).replyTo?.senderName || 'Unknown'}
                    </p>
                    <p className={cn(
                      "text-[12px] truncate",
                      isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {(message as any).replyTo?.content ||
                        ((message as any).replyTo?.type === 'IMAGE' ? '📷 Photo'
                          : (message as any).replyTo?.type === 'VIDEO' ? '🎥 Video'
                          : '📎 File')}
                    </p>
                  </div>
                </div>
              )}
              {hasAttachments && (
                <div className={cn(
                  "flex flex-col gap-1",
                  isMediaOnly ? "-m-1" : "mb-1 -mx-2 -mt-1"
                )}>
                  {message.attachments!.map((file, idx) => (
                    <AttachmentRenderer
                      key={idx}
                      file={file}
                      onImageClick={(url) => (window as any).showImagePreview?.(url)}
                      isCompact={isMediaOnly}
                      isMe={isMe}
                      status={message.status}
                      uploadState={uploadState}
                      onCancelUpload={() => onCancelUpload?.(message.id)}
                      onRetryUpload={() => handleAction('retry_upload')}
                    />
                  ))}
                </div>
              )}
              {message.content && (!isMediaOnly || isEmojiOnly) && message.content !== 'File' && (
                <div className={cn(
                  "pb-4",
                  hasAttachments ? "mt-2" : "",
                  isEmojiOnly ? "text-5xl pb-1" : ""
                )}>
                  {(() => {
                    const urlRegex = /((https?:\/\/[^\s]+)|(www\.[^\s]+))/g;
                    const parts = message.content.split(urlRegex);
                    let firstLinkFound = false;

                    const matches = Array.from(message.content.matchAll(urlRegex));
                    if (matches.length === 0) return message.content;

                    let lastIdx = 0;
                    const result = [];
                    matches.forEach((match, i) => {
                      if (match.index! > lastIdx) {
                        result.push(message.content.substring(lastIdx, match.index));
                      }

                      const url = match[0];
                      const href = url.startsWith('http') ? url : `https://${url}`;
                      const showPreview = !firstLinkFound;
                      firstLinkFound = true;

                      result.push(
                        <React.Fragment key={`link-${i}`}>
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "underline decoration-2 underline-offset-2 hover:opacity-80 transition-opacity font-bold break-all",
                              message.isMe ? "text-white" : "text-primary"
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {url}
                          </a>
                          {showPreview && <LinkPreview url={href} />}
                        </React.Fragment>
                      );
                      lastIdx = match.index! + url.length;
                    });

                    if (lastIdx < message.content.length) {
                      result.push(message.content.substring(lastIdx));
                    }

                    return result;
                  })()}
                </div>
              )}
            </div>
          ) : (
            <ContextMenu>
              <ContextMenuTrigger>
                <div
                  className={cn(
                    "select-text w-full relative",
                    isMediaOnly ? "leading-[0]" : ""
                  )}
                  style={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {/* ── Forwarded tag ─────────────────────────────────── */}
                  {(message as any).forwardedFrom && !message.isDeleted && (
                    <div className={cn(
                      "flex items-center gap-1 text-[10px] font-medium mb-1.5",
                      isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      <Forward className="h-3 w-3" />
                      <span>Forwarded</span>
                    </div>
                  )}

                  {/* ── Reply-to quote preview ────────────────────────── */}
                  {(message as any).replyTo && !message.isDeleted && (
                    <div className={cn(
                      "flex items-stretch gap-0 mb-1.5 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity",
                      isMe
                        ? "bg-white/15 border border-white/20"
                        : "bg-primary/8 border border-primary/20"
                    )}
                      onClick={(e) => {
                        e.stopPropagation();
                        const el = document.getElementById(`msg-${(message as any).replyTo?.id}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      <div className={cn(
                        "w-1 shrink-0",
                        isMe ? "bg-white/60" : "bg-primary"
                      )} />
                      <div className="px-2 py-1.5 min-w-0 flex-1">
                        <p className={cn(
                          "text-[11px] font-bold truncate",
                          isMe ? "text-primary-foreground/90" : "text-primary"
                        )}>
                          {(message as any).replyTo?.senderName || 'Unknown'}
                        </p>
                        <p className={cn(
                          "text-[12px] truncate",
                          isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {(message as any).replyTo?.content ||
                            ((message as any).replyTo?.type === 'IMAGE' ? '📷 Photo'
                              : (message as any).replyTo?.type === 'VIDEO' ? '🎥 Video'
                              : '📎 File')}
                        </p>
                      </div>
                    </div>
                  )}
                  {hasAttachments && (
                    <div className={cn(
                      "flex flex-col gap-1",
                      isMediaOnly ? "-m-1" : "mb-1 -mx-2 -mt-1"
                    )}>
                      {message.attachments!.map((file, idx) => (
                        <AttachmentRenderer
                          key={idx}
                          file={file}
                          onImageClick={(url) => (window as any).showImagePreview?.(url)}
                          isCompact={isMediaOnly}
                          isMe={isMe}
                          status={message.status}
                          uploadState={uploadState}
                          onCancelUpload={() => onCancelUpload?.(message.id)}
                          onRetryUpload={() => handleAction('retry_upload')}
                        />
                      ))}
                    </div>
                  )}
                  {message.content && (!isMediaOnly || isEmojiOnly) && message.content !== 'File' && (
                    <div className={cn(
                      "pb-4",
                      hasAttachments ? "mt-2" : "",
                      isEmojiOnly ? "text-5xl pb-1" : ""
                    )}>
                      {(() => {
                        const urlRegex = /((https?:\/\/[^\s]+)|(www\.[^\s]+))/g;
                        const parts = message.content.split(urlRegex);
                        let firstLinkFound = false;

                        const matches = Array.from(message.content.matchAll(urlRegex));
                        if (matches.length === 0) return message.content;

                        let lastIdx = 0;
                        const result = [];
                        matches.forEach((match, i) => {
                          if (match.index! > lastIdx) {
                            result.push(message.content.substring(lastIdx, match.index));
                          }

                          const url = match[0];
                          const href = url.startsWith('http') ? url : `https://${url}`;
                          const showPreview = !firstLinkFound;
                          firstLinkFound = true;

                          result.push(
                            <React.Fragment key={`link-${i}`}>
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "underline decoration-2 underline-offset-2 hover:opacity-80 transition-opacity font-bold break-all",
                                  message.isMe ? "text-white" : "text-primary"
                                )}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {url}
                              </a>
                              {showPreview && <LinkPreview url={href} />}
                            </React.Fragment>
                          );
                          lastIdx = match.index! + url.length;
                        });

                        if (lastIdx < message.content.length) {
                          result.push(message.content.substring(lastIdx));
                        }

                        return result;
                      })()}
                    </div>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56 rounded-2xl border-border/50 shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-200">
                {!message.isDeleted && message.content && (
                  <ContextMenuItem onClick={() => handleAction('copy')} className="rounded-xl h-10 gap-3 font-medium">
                    <Copy className="h-4 w-4 text-primary" />
                    {t('copy_text')}
                  </ContextMenuItem>
                )}
                {!message.isDeleted && (
                  <ContextMenuItem onClick={() => handleAction('reply')} className="rounded-xl h-10 gap-3 font-medium">
                    <Reply className="h-4 w-4 text-primary" />
                    {t('reply')}
                  </ContextMenuItem>
                )}
                {isMe && !message.isDeleted && message.type === 'TEXT' && (
                  <ContextMenuItem onClick={() => handleAction('edit_start')} className="rounded-xl h-10 gap-3 font-medium">
                    <Edit className="h-4 w-4 text-primary" />
                    Edit Message
                  </ContextMenuItem>
                )}
                {!message.isDeleted && (
                  <ContextMenuItem
                    onClick={() => handleAction('pin', { isPinned: !!(message as any).isPinned, content: message.content, senderName: (message as any).senderName })}
                    className="rounded-xl h-10 gap-3 font-medium"
                  >
                    {(message as any).isPinned
                      ? <><Pin className="h-4 w-4 text-primary" />Unpin Message</>
                      : <><Pin className="h-4 w-4 text-primary" />Pin Message</>}
                  </ContextMenuItem>
                )}
                {!message.isDeleted && (
                  <ContextMenuItem onClick={() => handleAction('forward')} className="rounded-xl h-10 gap-3 font-medium">
                    <Forward className="h-4 w-4 text-primary" />
                    {t('forward')}
                  </ContextMenuItem>
                )}
                <ContextMenuSeparator className="my-1 bg-border/50" />
                <ContextMenuItem
                  onClick={() => handleAction('delete_confirm')}
                  className="rounded-xl h-10 gap-3 text-destructive focus:bg-destructive/10 focus:text-destructive font-medium"
                >
                  <Trash2 className="h-4 w-4" />
                  {isMe ? 'Delete' : 'Delete for Me'}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )}

          <div className={cn(
            "flex items-center gap-1 text-[10px]",
            isEmojiOnly
              ? "relative mt-1 self-end text-muted-foreground opacity-60"
              : "absolute bottom-1 right-2",
            (isMediaOnly && !isEmojiOnly)
              ? "bg-black/30 backdrop-blur-md text-white px-2 py-0.5 rounded-full"
              : (isMe ? "text-primary-foreground/70" : "text-muted-foreground")
          )}>
            {message.editedAt && <span className="italic mr-1">edited</span>}
            <span>{message.timestamp}</span>
            {isMe && (
              <span className="shrink-0">
                {message.status === 'failed' ? (
                  <Button 
                    variant="destructive" size="icon" className="h-4 w-4 rounded-full ml-1"
                    onClick={() => handleAction('retry_upload')}
                  >
                    <RotateCw className="h-2.5 w-2.5" />
                  </Button>
                ) : message.status === 'sending' ? (
                  <Clock className="h-3 w-3 animate-pulse" />
                ) : message.status === 'read' ? (
                  <CheckCheck className="h-3 w-3 text-sky-400" />
                ) : message.status === 'delivered' ? (
                  <CheckCheck className="h-3 w-3 opacity-70" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </span>
            )}
          </div>

          {/* Reactions Display */}
          {uniqReactions.length > 0 && (
            <div className={cn(
              "absolute -bottom-4 flex gap-1",
              isMe ? "right-0" : "left-0"
            )}>
              {uniqReactions.map((emoji: any) => (
                <button
                  key={emoji}
                  onClick={() => handleAction('react', { emoji })}
                  className={cn(
                    "bg-white dark:bg-slate-800 border border-border/50 rounded-full px-1.5 py-0.5 text-[10px] shadow-sm hover:scale-110 transition-transform flex items-center gap-1",
                    reactions.some((r: any) => r.userId === currentUser?.id && r.emoji === emoji) ? "border-primary bg-primary/5" : ""
                  )}
                >
                  <span>{emoji}</span>
                  <span className="font-bold opacity-70">
                    {reactions.filter((r: any) => r.emoji === emoji).length}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Telegram-style Corner Tail */}
          {isLastInGroup && message.type !== 'VIDEO_MESSAGE' && !isEmojiOnly && (
            <div className={cn(
              "absolute bottom-0 w-3 h-3 overflow-hidden",
              message.isMe ? "-right-2" : "-left-2"
            )}>
              <div className={cn(
                "w-full h-full rotate-45 transform origin-bottom-left",
                message.isMe ? "bg-primary" : "bg-white dark:bg-slate-900 border-l border-b border-border/50"
              )} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Deep comparison for memoization
  return prevProps.message.id === nextProps.message.id &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.editedAt === nextProps.message.editedAt &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.uploadState?.progress === nextProps.uploadState?.progress &&
    prevProps.isLastInGroup === nextProps.isLastInGroup &&
    (prevProps.message as any).reactions?.length === (nextProps.message as any).reactions?.length;
});

const DateSeparator = ({ date }: { date: string }) => (
  <div className="flex justify-center my-6">
    <div className="typography-label bg-secondary/40 backdrop-blur-sm px-4 py-1 rounded-full text-[11px] text-muted-foreground uppercase shadow-sm">
      {date}
    </div>
  </div>
);

