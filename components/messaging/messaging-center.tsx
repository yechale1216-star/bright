'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatLayout } from '@/components/messaging/chat-layout';
import { ChatSidebar } from '@/components/messaging/chat-sidebar';
import { ChatWindow } from '@/components/messaging/chat-window';
import { CreateGroupModal } from '@/components/messaging/create-group-modal';
import { GroupInfoPanel } from '@/components/messaging/group-info-panel';
import { UserInfoPanel } from '@/components/messaging/user-info-panel';
import { SavedMessagesPanel } from '@/components/messaging/saved-messages-panel';
import { Bookmark, X } from 'lucide-react';
import { useSocket } from '@/components/providers/socket-provider';
import { authService } from '@/lib/auth/auth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/context/language-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { notifications } from '@/lib/utils/notifications';
import { updateAppBadge } from '@/lib/utils/app-badge';
import { formatLocalizedTime } from '@/lib/utils/date-utils';
import { useUnread } from '@/lib/context/unread-context';
import {
  cacheMessages,
  getCachedMessages,
  appendCachedMessage,
  updateCachedMessage,
  cacheConversations,
  getCachedConversations,
  deleteCachedMessages,
  clearCachedMessages,
  enqueueOutboxMessage,
  getOutboxMessages,
  removeOutboxMessage,
  prependCachedMessages,
  type OutboxMessage,
} from '@/lib/utils/message-cache';

import { apiUrl } from '@/lib/api-config';
const API_URL = apiUrl;

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
  const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(schoolId ? { 'x-school-id': schoolId } : {}),
  };
}

export function MessagingCenter() {
  const { t, language } = useLanguage();
  const { unreadMap, markConversationRead, syncConversations } = useUnread();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationData, setActiveConversationData] = useState<any>(null);
  const [unreadSeparatorMessageId, setUnreadSeparatorMessageId] = useState<string | null>(null);
  
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, any[]>>({});
  const [paginationByConversation, setPaginationByConversation] = useState<
    Record<string, { nextCursor: string | null; hasMore: boolean; isLoadingOlder: boolean }>
  >({});
  const staleTimeMapRef = useRef<Record<string, number>>({});
  // isFetchingMessages only drives the thin progress bar — never a blocking skeleton
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  const [isLoadingSidebar, setIsLoadingSidebar] = useState(true);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [showSavedMessages, setShowSavedMessages] = useState(false);
  const [forwardDialogData, setForwardDialogData] = useState<{
    messageIds?: string[];
    singleMessage?: any;
  } | null>(null);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');
  const [pinnedByConversation, setPinnedByConversation] = useState<Record<string, any>>({}); // conversationId -> pinnedMessage info
  const [isMuted, setIsMuted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const { socket, isConnected } = useSocket();
  const [user, setUser] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({}); // conversationId -> typing status text
  const { toast } = useToast();

  // Refs so socket handlers always see latest values without stale closures
  const activeConversationIdRef = useRef<string | null>(null);
  const userRef = useRef<any>(null);
  const isConnectedRef = useRef(false);
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Sync mute and block status when active conversation changes
  useEffect(() => {
    if (!activeConversationData) {
      setIsMuted(false);
      setIsBlocked(false);
      return;
    }

    setIsMuted(!!activeConversationData.isMuted);

    // Fetch block status for 1:1 conversations
    if (!activeConversationData.isGroup && user) {
      const targetUserId = activeConversationData.realContactId ||
        activeConversationData.memberIds?.find((id: string) => id !== user.id) ||
        activeConversationData.members?.find((m: any) => (m.userId || m.id) !== user.id)?.userId;

      if (targetUserId) {
        fetch(`${API_URL}/api/messages/users/${targetUserId}/block-status`, {
          headers: getAuthHeaders(),
        })
          .then((res) => res.json())
          .then((data) => {
            setIsBlocked(!!data.iBlockedThem);
          })
          .catch(() => {});
      }
    }
  }, [activeConversationData, user]);

  // ── Toggle Mute Handler ───────────────────────────────────────────────────
  const handleToggleMute = useCallback(async () => {
    if (!activeConversationId) return;
    try {
      const res = await fetch(`${API_URL}/api/messages/conversations/${activeConversationId}/mute`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setIsMuted(data.isMuted);
        setActiveConversationData((prev: any) => prev ? { ...prev, isMuted: data.isMuted } : prev);
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversationId ? { ...c, isMuted: data.isMuted } : c))
        );
        notifications.success(
          data.isMuted ? 'Notifications Muted' : 'Notifications Unmuted',
          data.isMuted ? 'Notifications muted for this conversation' : 'Notifications unmuted'
        );
      }
    } catch (err) {
      notifications.error('Failed', 'Could not toggle mute state');
    }
  }, [activeConversationId]);

  // ── Toggle Block Handler ──────────────────────────────────────────────────
  const handleToggleBlock = useCallback(async (currentlyBlocked: boolean) => {
    if (!activeConversationData || !user) return;
    const targetUserId = activeConversationData.realContactId ||
      activeConversationData.memberIds?.find((id: string) => id !== user.id) ||
      activeConversationData.members?.find((m: any) => (m.userId || m.id) !== user.id)?.userId;

    if (!targetUserId) return;

    const endpoint = currentlyBlocked ? 'unblock' : 'block';
    try {
      const res = await fetch(`${API_URL}/api/messages/users/${targetUserId}/${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const newBlockedState = !currentlyBlocked;
        setIsBlocked(newBlockedState);
        notifications.success(
          newBlockedState ? 'User Blocked' : 'User Unblocked',
          newBlockedState
            ? `${activeConversationData.name} has been blocked.`
            : `${activeConversationData.name} has been unblocked.`
        );
      }
    } catch (err) {
      notifications.error('Failed', 'Could not update block state');
    }
  }, [activeConversationData, user]);

  // ── Clear Chat History Handler ──────────────────────────────────────────
  const handleClearHistory = useCallback(async () => {
    if (!activeConversationId) return;
    try {
      const res = await fetch(`${API_URL}/api/messages/conversations/${activeConversationId}/clear`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setMessagesByConversation((prev) => ({
          ...prev,
          [activeConversationId]: [],
        }));
        await clearCachedMessages(activeConversationId);
        notifications.success('Chat Cleared', 'All message history cleared for you');
      }
    } catch (err) {
      notifications.error('Failed', 'Could not clear chat history');
    }
  }, [activeConversationId]);

  // ── Delete Chat Handler ───────────────────────────────────────────────────
  const handleDeleteChat = useCallback(async () => {
    if (!activeConversationId) return;
    try {
      const res = await fetch(`${API_URL}/api/messages/conversations/${activeConversationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const deletedId = activeConversationId;
        setActiveConversationId(null);
        setActiveConversationData(null);
        setIsInfoPanelOpen(false);
        setConversations((prev) => prev.filter((c) => c.id !== deletedId));
        setMessagesByConversation((prev) => {
          const next = { ...prev };
          delete next[deletedId];
          return next;
        });
        await deleteCachedMessages(deletedId);
        notifications.success('Chat Deleted', 'Conversation removed from your chat list');
      }
    } catch (err) {
      notifications.error('Failed', 'Could not delete conversation');
    }
  }, [activeConversationId]);


  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem('zetime:active_chat_id', activeConversationId);
    } else {
      localStorage.removeItem('zetime:active_chat_id');
    }
  }, [activeConversationId]);

  useEffect(() => {
    setUser(authService.getCurrentUser());
    
    // Register global bridge for sidebar to open group modal
    (window as any).openCreateGroup = () => setIsGroupModalOpen(true);

    // ── Handle notification tap → auto-open the conversation ──────────────────
    // Fired by SocketProvider when (a) user clicks an in-app notification or
    // (b) the service worker posts a NOTIFICATION_CLICK message after a push tap.
    const handleOpenConversation = (e: Event) => {
      const { conversationId } = (e as CustomEvent).detail || {};
      if (conversationId) {
        setActiveConversationId(conversationId);
      }
    };
    window.addEventListener('zetime:open_conversation', handleOpenConversation);

    // ── Update sidebar badge without a full re-fetch ───────────────────────────
    const handleNewMessageEvent = (e: Event) => {
      const { conversationId, senderName, preview, timestamp } = (e as CustomEvent).detail || {};
      if (!conversationId) return;
      setConversations(prev => prev.map(conv => {
        if (conv.id !== conversationId) return conv;
        return {
          ...conv,
          lastMessage: preview || conv.lastMessage,
          timestamp,
          unreadCount: (conv.unreadCount || 0) + 1,
        };
      }));
    };
    window.addEventListener('zetime:new_message', handleNewMessageEvent);

    // ── Telegram-style: Load cached conversations from IndexedDB instantly ──
    getCachedConversations().then(cached => {
      if (cached && cached.length > 0) {
        setConversations(cached);
        setIsLoadingSidebar(false);
        console.log('[Messaging] Loaded', cached.length, 'cached conversations from IndexedDB');
      }
    }).catch(() => {});

    return () => {
      delete (window as any).openCreateGroup;
      window.removeEventListener('zetime:open_conversation', handleOpenConversation);
      window.removeEventListener('zetime:new_message', handleNewMessageEvent);
    };
  }, []);

  // ── Sync Launcher Icon Badge Count ───────────────────────────────────────────
  useEffect(() => {
    let totalUnreadChats = 0;
    for (const c of conversations) {
      totalUnreadChats += (c.unreadCount || 0);
    }
    // Update the capacitor app badge
    updateAppBadge(totalUnreadChats).catch(() => {});
  }, [conversations]);



  // ── Load sidebar data ────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    if (typeof window !== 'undefined' && !navigator.onLine) {
      console.log('[Messaging] Offline — using cached conversations');
      setIsLoadingSidebar(false);
      return;
    }
    try {
      const headers = getAuthHeaders();

      const [contactsRes, convRes] = await Promise.all([
        fetch(`${API_URL}/api/users/contacts`, { headers, cache: 'no-store' }),
        fetch(`${API_URL}/api/messages/conversations/${user.id}`, { headers, cache: 'no-store' }),
      ]);

      const contactsData = await contactsRes.json();
      const contacts: any[] = contactsData.data || [];

      const convs = await convRes.json();

      const finalItems: any[] = [];
      const handledUserIds = new Set<string>();

      // Process existing conversations first (most recent first)
      if (Array.isArray(convs)) {
        const sorted = [...convs].sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt).getTime() -
            new Date(a.updatedAt || a.createdAt).getTime()
        );

        for (const c of sorted) {
          const isGroup = c.isGroup;
          let otherMember: any = null;

          if (!isGroup) {
            otherMember = c.members.find((m: any) => m.userId !== user.id)?.user;
            if (!otherMember) continue; // Skip orphaned conversations

            // De-duplicate: one entry per person (keep most recent)
            if (handledUserIds.has(otherMember.id)) continue;
            handledUserIds.add(otherMember.id);
          }

          finalItems.push({
            id: c.id,
            name: isGroup ? c.name : otherMember?.full_name || 'Unknown',
            avatar: isGroup ? c.avatar : otherMember?.profile_photo || undefined,
            isOnline: false,
            lastMessage: c.messages?.[0]?.content || t("no_messages"),
            timestamp: c.messages?.[0]?.createdAt
              ? formatLocalizedTime(c.messages[0].createdAt, language)
              : '',
            updatedAt: new Date(c.updatedAt || c.createdAt).getTime(),
            unreadCount: c.unreadCount || 0,
            isGroup,
            memberIds: c.members.map((m: any) => m.userId),
            phone: otherMember?.phone || '',
            role: otherMember?.role || (isGroup ? 'Group' : 'User'),
            realContactId: otherMember?.id || null,
            isNewContact: false,
            lastActive: otherMember?.lastActive,
          });
        }
      }

      // Add directory contacts (no conversation yet)
      for (const contact of contacts) {
        if (contact.id === user.id) continue;
        if (handledUserIds.has(contact.id)) continue;

        finalItems.push({
          id: `contact-${contact.id}`,
          name: contact.full_name,
          avatar: contact.profile_photo || undefined,
          isOnline: false,
          lastMessage: t("tap_to_message").replace("{role}", contact.role),
          timestamp: '',
          updatedAt: 0,
          unreadCount: 0,
          isGroup: false,
          memberIds: [user.id, contact.id],
          phone: contact.phone || '',
          role: contact.role,
          realContactId: contact.id,
          isNewContact: true,
          lastActive: contact.lastActive,
        });

        handledUserIds.add(contact.id);
      }

      // Sort: active chats by recency, directory by name
      const activeChats = finalItems.filter(i => !i.isNewContact);
      const directory = finalItems.filter(i => i.isNewContact);
      activeChats.sort((a, b) => b.updatedAt - a.updatedAt);
      directory.sort((a, b) => a.name.localeCompare(b.name));

      const finalConversations = [...activeChats, ...directory];
      setConversations(finalConversations);
      syncConversations(finalConversations);

      // ── Telegram-style: persist conversations to IndexedDB for offline ──
      cacheConversations(finalConversations).catch(() => {});

      // ── Telegram-style: Pre-load recent messages for top 10 chats into memory (0ms tap delay) ──
      const topChats = activeChats.slice(0, 10);
      topChats.forEach(conv => {
        getCachedMessages(conv.id).then(cached => {
          if (cached && cached.length > 0) {
            setMessagesByConversation(prev => {
              if (prev[conv.id]?.length > 0) return prev;
              return { ...prev, [conv.id]: cached };
            });
          }
        }).catch(() => {});
      });
    } catch (error) {
      console.error('[Messaging] Failed to load data:', error);
      toast({ 
        title: t("error"), 
        description: t("load_conv_error"), 
        variant: 'destructive' 
      });
    } finally {
      setIsLoadingSidebar(false);
    }
  }, [user, t, toast, language]);

  useEffect(() => {
    loadData();

    const handleStudentChange = () => {
      setIsLoadingSidebar(true);
      loadData();
    };

    window.addEventListener("studentChanged", handleStudentChange);
    return () => window.removeEventListener("studentChanged", handleStudentChange);
  }, [loadData]);

  // ── Fetch messages for the selected conversation ─────────────────────────────
  const loadMessages = useCallback(async (conversationId: string) => {
    // ── Step 1: Load from IndexedDB cache instantly (if not already in memory) ──
    const hasInMemory = messagesByConversation[conversationId]?.length > 0;
    if (!hasInMemory) {
      try {
        const cached = await getCachedMessages(conversationId);
        if (cached && cached.length > 0) {
          setMessagesByConversation(prev => {
            if (prev[conversationId]?.length > 0) return prev;
            return { ...prev, [conversationId]: cached };
          });
          console.log('[Messaging] Loaded', cached.length, 'cached messages for', conversationId);
        }
      } catch {
        // IndexedDB failed — continue to server fetch
      }
    }

    // ── Step 2: Stale-while-revalidate check (30s stale window) ──
    const lastFetch = staleTimeMapRef.current[conversationId] || 0;
    const isStale = Date.now() - lastFetch > 30000;
    if (!isStale && hasInMemory) {
      return;
    }

    if (typeof window !== 'undefined' && !navigator.onLine) {
      console.log('[Messaging] Offline — using cached messages only');
      return;
    }

    // Only show thin progress bar if we don't have any messages in memory yet
    const shouldShowProgress = !hasInMemory && (!messagesByConversation[conversationId] || messagesByConversation[conversationId].length === 0);
    if (shouldShowProgress) {
      setIsFetchingMessages(true);
    }
    try {
      const res = await fetch(`${API_URL}/api/messages/${conversationId}?limit=30`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        console.error('[Messaging] Failed to fetch messages', res.status);
        return;
      }

      const data = await res.json();
      const msgs: any[] = data.messages ? data.messages : (Array.isArray(data) ? data : []);
      const nextCursor: string | null = data.nextCursor ?? null;
      const hasMore: boolean = Boolean(data.hasMore ?? data.hasNextPage);

      if (!msgs.length && !Array.isArray(data)) return;

      const formatted = msgs.map(m => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.sender?.full_name || 'Unknown',
        senderAvatar: m.sender?.profile_photo,
        content: m.content,
        timestamp: formatLocalizedTime(m.createdAt, language),
        status: m.readBy && m.readBy.length > 0 ? 'read' : 'sent',
        type: m.type || 'TEXT',
        attachments: m.attachments,
        isMe: m.senderId === userRef.current?.id,
        reactions: m.reactions || [],
        isDeleted: m.isDeleted,
        editedAt: m.editedAt,
        metadata: m.metadata || null,
        isPinned: m.isPinned || false,
        replyTo: m.replyTo
          ? {
              id: m.replyTo.id,
              content: m.replyTo.content,
              senderName: m.replyTo.sender?.full_name || 'Unknown',
              type: m.replyTo.type || 'TEXT',
            }
          : null,
        forwardedFrom: m.forwardedFrom || null,
      }));

      // Store messages keyed by conversationId & merge with any pending optimistic items
      setMessagesByConversation(prev => {
        const existing = prev[conversationId] || [];
        const optimistic = existing.filter(m => m.id.startsWith('temp-') || m.status === 'sending');
        
        const mergedMap = new Map<string, any>();
        formatted.forEach(m => mergedMap.set(m.id, m));
        optimistic.forEach(m => mergedMap.set(m.id, m));
        
        const mergedList = Array.from(mergedMap.values());
        return { ...prev, [conversationId]: mergedList };
      });

      // Update cursor pagination metadata & stale timestamp
      setPaginationByConversation(prev => ({
        ...prev,
        [conversationId]: {
          nextCursor,
          hasMore,
          isLoadingOlder: false,
        },
      }));
      staleTimeMapRef.current[conversationId] = Date.now();

      // ── Persist to IndexedDB for offline access ──
      cacheMessages(conversationId, formatted).catch(() => {});
    } catch (err) {
      console.error('[Messaging] Error loading messages:', err);
    } finally {
      if (shouldShowProgress) {
        setIsFetchingMessages(false);
      }
    }
  }, [messagesByConversation, language]);

  // ── Load older messages (Cursor Pagination for Infinite Scroll) ─────────────
  const loadOlderMessages = useCallback(async (conversationId: string) => {
    const pag = paginationByConversation[conversationId];
    if (!pag || !pag.hasMore || !pag.nextCursor || pag.isLoadingOlder) {
      return;
    }

    setPaginationByConversation(prev => ({
      ...prev,
      [conversationId]: { ...prev[conversationId], isLoadingOlder: true },
    }));

    try {
      const res = await fetch(
        `${API_URL}/api/messages/${conversationId}?cursor=${pag.nextCursor}&limit=30`,
        { headers: getAuthHeaders() }
      );

      if (!res.ok) {
        setPaginationByConversation(prev => ({
          ...prev,
          [conversationId]: { ...prev[conversationId], isLoadingOlder: false },
        }));
        return;
      }

      const data = await res.json();
      const olderMsgs: any[] = data.messages ? data.messages : [];
      const newNextCursor: string | null = data.nextCursor ?? null;
      const newHasMore: boolean = Boolean(data.hasMore ?? data.hasNextPage);

      const formattedOlder = olderMsgs.map(m => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.sender?.full_name || 'Unknown',
        senderAvatar: m.sender?.profile_photo,
        content: m.content,
        timestamp: formatLocalizedTime(m.createdAt, language),
        status: m.readBy && m.readBy.length > 0 ? 'read' : 'sent',
        type: m.type || 'TEXT',
        attachments: m.attachments,
        isMe: m.senderId === userRef.current?.id,
        reactions: m.reactions || [],
        isDeleted: m.isDeleted,
        editedAt: m.editedAt,
        metadata: m.metadata || null,
        isPinned: m.isPinned || false,
        replyTo: m.replyTo
          ? {
              id: m.replyTo.id,
              content: m.replyTo.content,
              senderName: m.replyTo.sender?.full_name || 'Unknown',
              type: m.replyTo.type || 'TEXT',
            }
          : null,
        forwardedFrom: m.forwardedFrom || null,
      }));

      // Prepend older messages to state without duplicates
      setMessagesByConversation(prev => {
        const current = prev[conversationId] || [];
        const currentIds = new Set(current.map(m => m.id));
        const filteredOlder = formattedOlder.filter(m => !currentIds.has(m.id));
        return {
          ...prev,
          [conversationId]: [...filteredOlder, ...current],
        };
      });

      // Update pagination metadata
      setPaginationByConversation(prev => ({
        ...prev,
        [conversationId]: {
          nextCursor: newNextCursor,
          hasMore: newHasMore,
          isLoadingOlder: false,
        },
      }));

      // Persist prepended items to IndexedDB
      prependCachedMessages(conversationId, formattedOlder).catch(() => {});
    } catch (err) {
      console.error('[Messaging] Error fetching older messages:', err);
      setPaginationByConversation(prev => ({
        ...prev,
        [conversationId]: { ...prev[conversationId], isLoadingOlder: false },
      }));
    }
  }, [paginationByConversation, language]);

  // Re-fetch conversations when network recovers (messages only — no full refetch)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('[Messaging] Connection restored. Syncing active conversation...');
      // Only re-fetch messages for the active conversation.
      // The full conversation list is kept fresh by socket events.
      if (activeConversationIdRef.current) {
        loadMessages(activeConversationIdRef.current);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [loadMessages]);

  // ── Offline outbox drain & room re-join on reconnect ────────────────────────
  // Re-join active room and replay any messages queued while offline.
  useEffect(() => {
    if (!isConnected || !socket || !user) return;

    // ── Bug 3 Fix: Re-join joined rooms on socket reconnect ──
    if (joinedRoomsRef.current.size > 0) {
      console.log(`[Messaging] Socket reconnected — re-joining ${joinedRoomsRef.current.size} conversation room(s)...`);
      joinedRoomsRef.current.forEach(convId => {
        socket.emit('join_conversation', convId);
      });
    }

    const drainOutbox = async () => {
      const pending = await getOutboxMessages();
      if (pending.length === 0) return;

      console.log(`[Messaging] Draining ${pending.length} offline message(s) from outbox...`);

      const conversationIdMap: Record<string, string> = {};

      for (const msg of pending) {
        let conversationId = msg.conversationId;

        // If the conversation ID starts with "contact-", it means it's a contact conversation
        // that hasn't been created on the backend yet because of offline state when the message was sent.
        if (conversationId.startsWith('contact-')) {
          if (conversationIdMap[conversationId]) {
            conversationId = conversationIdMap[conversationId];
          } else {
            try {
              const contactId = conversationId.split('contact-')[1];
              const res = await fetch(`${API_URL}/api/messages/conversations`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                  isGroup: false,
                  memberIds: [user.id, contactId],
                }),
              });

              if (res.ok) {
                const newConv = await res.json();
                const realId = newConv.id;
                conversationIdMap[conversationId] = realId;
                conversationId = realId;

                // Sync the active conversation state if the user has it open
                if (activeConversationIdRef.current === msg.conversationId) {
                  setActiveConversationId(realId);
                  setActiveConversationData((prev: any) => prev ? { ...prev, id: realId, isNewContact: false } : null);
                }

                // Update local conversations list
                setConversations(prev =>
                  prev.map(c =>
                    c.id === msg.conversationId
                      ? { ...c, id: realId, isNewContact: false }
                      : c
                  )
                );

                // Transfer locally cached messages in state
                setMessagesByConversation(prev => {
                  const updated = { ...prev };
                  if (updated[msg.conversationId]) {
                    updated[realId] = [...(updated[realId] || []), ...updated[msg.conversationId]];
                    delete updated[msg.conversationId];
                  }
                  return updated;
                });

                // Update the IndexedDB cache for messages
                const cachedMsgs = await getCachedMessages(msg.conversationId);
                if (cachedMsgs) {
                  await cacheMessages(realId, cachedMsgs);
                }
              } else {
                console.error('[Messaging] Failed to create conversation on socket connect:', res.status);
                continue; // Skip replaying this message yet
              }
            } catch (err) {
              console.error('[Messaging] Error creating conversation during outbox sync:', err);
              continue; // Skip
            }
          }
        }

        // Re-emit the message via socket — the server's tempId dedup will
        // prevent double-inserts if the message was already persisted.
        socket.emit('send_message', {
          conversationId,
          senderId: msg.senderId,
          content: msg.content,
          type: msg.type,
          tempId: msg.tempId,
          replyToId: msg.replyToId,
          attachment: msg.attachment,
        });
        // Remove from outbox immediately — if it fails, the message_error
        // event will add it back with a failed status.
        await removeOutboxMessage(msg.tempId);
      }
    };

    drainOutbox();
  }, [isConnected, socket, user]);

  // ── Select conversation ──────────────────────────────────────────────────────
  const handleSelectConversation = useCallback(
    async (id: string, chatData: any) => {
      if (!user) return;

      // If new contact without a conversation → open chat window INSTANTLY,
      // then create the conversation on the server silently in the background.
      if (chatData?.isNewContact) {
        // ── Step 1: Open the chat window immediately on first tap ──────────────
        // Pre-seed the message list so the window renders with no delay.
        setMessagesByConversation(prev => ({
          ...prev,
          [id]: prev[id] || []
        }));
        setActiveConversationId(id);
        setActiveConversationData(chatData);

        // If offline, stop here. Messages will be queued in the outbox
        // and the conversation will be created as soon as connectivity resumes.
        if (typeof window !== 'undefined' && !navigator.onLine) {
          console.log('[Messaging] Offline — chat window open in offline mode for:', id);
          return;
        }

        // ── Step 2: Create the conversation on the server in the background ───
        try {
          const res = await fetch(`${API_URL}/api/messages/conversations`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              isGroup: false,
              memberIds: [user.id, chatData.realContactId],
            }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            if (errorData.code === 'SCHOOL_SUSPENDED') {
              toast({
                title: "Portal Read-Only",
                description: "Your school account is suspended. Write actions are disabled, but historical records remain fully visible.",
                variant: 'destructive'
              });
            } else if (errorData.code === 'SCHOOL_EXPIRED') {
              toast({ title: t("error"), description: t("plan_expired_error"), variant: 'destructive' });
            } else if (errorData.code === 'FEATURE_RESTRICTED') {
              toast({ title: t("error"), description: t("feature_restricted_error"), variant: 'destructive' });
            } else {
              toast({ title: t("error"), description: errorData.message || t("start_conv_error"), variant: 'destructive' });
            }
            // Close the optimistic chat window on failure
            setActiveConversationId(null);
            setActiveConversationData(null);
            return;
          }

          const newConv = await res.json();
          const realId = newConv.id;

          // ── Step 3: Seamlessly swap the temporary contact-* ID for the real one ──
          // Update sidebar: replace temp ID with real conversation ID
          setConversations(prev =>
            prev.map(c =>
              c.id === id
                ? { ...c, id: realId, isNewContact: false, lastMessage: t("no_messages") }
                : c
            )
          );

          // Migrate the message list from temp ID → real ID (preserves any
          // optimistic messages the user may have already typed/sent)
          setMessagesByConversation((prev: any) => {
            const msgs = prev[id] || [];
            const next: any = { ...prev, [realId]: msgs };
            delete next[id];
            return next;
          });

          // Switch active conversation to the real ID — no visible transition
          setActiveConversationId(realId);
          setActiveConversationData({ ...chatData, id: realId, isNewContact: false });

          if (socket && isConnected) {
            socket.emit('join_conversation', realId);
          }
        } catch (err) {
          toast({ title: t("error"), description: t("start_conv_error"), variant: 'destructive' });
          setActiveConversationId(null);
          setActiveConversationData(null);
        }
        return;
      }

      // 1. Pre-seed an empty array immediately so the window renders now
      //    without any skeleton or blank-white-screen delay.
      setMessagesByConversation(prev => {
        if (prev[id]) return prev; // already cached — keep it
        return { ...prev, [id]: [] };
      });

      // 2. Switch active conversation & join socket room FIRST — this
      //    ensures we don't miss any incoming messages while fetching metadata.
      setActiveConversationId(id);
      joinedRoomsRef.current.add(id);
      if (socket && isConnected) {
        socket.emit('join_conversation', id);
      }

      // 3. Fetch group metadata & messages in parallel (non-blocking for UI)
      let finalChatData = chatData;
      const parallelTasks: Promise<any>[] = [loadMessages(id)];

      if (chatData?.isGroup) {
        parallelTasks.push(
          fetch(`${API_URL}/api/groups/${id}`, { headers: getAuthHeaders() })
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) finalChatData = data; })
            .catch(err => console.error('Failed to fetch full group data:', err))
        );
      }

      await Promise.all(parallelTasks);
      setActiveConversationData(finalChatData);
    },
    [user, socket, isConnected, loadMessages, t, toast]
  );

  const handleUpdateRole = async (userId: string, role: string) => {
    if (!activeConversationId) return;
    try {
      const res = await fetch(`${API_URL}/api/groups/${activeConversationId}/members/${userId}/role`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        // Refresh group data
        const groupRes = await fetch(`${API_URL}/api/groups/${activeConversationId}`, { headers: getAuthHeaders() });
        const data = await groupRes.json();
        setActiveConversationData(data);
        notifications.success("Success", "Member role updated");
      } else {
        const errorData = await res.json();
        notifications.error("Error", errorData.message || "Failed to update role");
      }
    } catch (err: any) {
      console.error('Failed to update role:', err);
      notifications.error("Error", err.message || "An error occurred");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeConversationId) return;
    try {
      const res = await fetch(`${API_URL}/api/groups/${activeConversationId}/members/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        // Refresh group data
        const groupRes = await fetch(`${API_URL}/api/groups/${activeConversationId}`, { headers: getAuthHeaders() });
        const data = await groupRes.json();
        setActiveConversationData(data);
        notifications.success("Success", "Member removed from group");
      } else {
        const errorData = await res.json();
        notifications.error("Error", errorData.message || "Failed to remove member");
      }
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      notifications.error("Error", err.message || "An error occurred");
    }
  };

  const handleForwardTo = async (targetConvId: string) => {
    if (!forwardDialogData || !user) return;
    const { singleMessage, messageIds } = forwardDialogData;

    const msgsToForward = [];
    if (singleMessage) {
      msgsToForward.push(singleMessage);
    } else if (messageIds && activeConversationId) {
      const allMsgs = messagesByConversation[activeConversationId] || [];
      const selected = allMsgs.filter(m => messageIds.includes(m.id));
      msgsToForward.push(...selected);
    }

    if (msgsToForward.length === 0) {
      setForwardDialogData(null);
      return;
    }

    try {
      for (const msg of msgsToForward) {
        if (targetConvId === 'saved-messages') {
          // Forwarding directly to Saved Messages
          await fetch(`${API_URL}/api/saved-messages/messages`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              content: msg.content,
              type: msg.type || 'TEXT',
              attachment: msg.attachments?.[0],
              forwardedFromId: msg.id,
            }),
          });
        } else {
          // Forwarding to another normal active conversation via WebSocket
          if (socket && isConnected) {
            socket.emit('send_message', {
              conversationId: targetConvId,
              senderId: user.id,
              content: msg.content,
              type: msg.type || 'TEXT',
              attachment: msg.attachments?.[0],
              forwardedFrom: msg.senderName || 'Unknown',
              forwardedFromId: msg.id,
            });
          }
        }
      }
      notifications.success("Success", `Forwarded ${msgsToForward.length} message(s)`);
    } catch (err) {
      toast({
        title: t("error"),
        description: "Failed to forward message(s)",
        variant: 'destructive',
      });
    } finally {
      setForwardDialogData(null);
      setForwardSearchQuery('');
    }
  };

  const handleAction = async (action: string, data: any) => {
    if (!socket || !isConnected) return;
    
    switch (action) {
      case 'edit':
        socket.emit('edit_message', { ...data, conversationId: activeConversationId });
        break;
      case 'delete': {
        const delId = data.messageId;
        const deleteForEveryone = data.deleteForEveryone !== false; // default true for 'delete' action
        // Optimistic local update: remove message completely from view
        setMessagesByConversation(prev => {
          const msgs = prev[activeConversationId!];
          if (!msgs) return prev;
          const filtered = msgs.filter(m => m.id !== delId);
          cacheMessages(activeConversationId!, filtered).catch(() => {});
          return { ...prev, [activeConversationId!]: filtered };
        });
        socket.emit('delete_message', {
          messageId: delId,
          conversationId: activeConversationId,
          deleteForEveryone,
        });
        break;
      }
      // Delete for Me: only removes from local state, no socket broadcast
      case 'delete_for_me': {
        const delId = data.messageId;
        const currentMsgs = messagesByConversation[activeConversationId!] || [];
        const filteredMsgs = currentMsgs.filter(m => m.id !== delId);
        setMessagesByConversation(prev => ({
          ...prev,
          [activeConversationId!]: filteredMsgs
        }));
        cacheMessages(activeConversationId!, filteredMsgs).catch(() => {});
        toast({
          title: "Deleted for you",
          description: "Message removed from your view",
        });
        break;
      }
      case 'pin': {
        const messageId = data.messageId;
        const isPinned = data.isPinned;
        // Optimistic local update
        setPinnedByConversation(prev => {
          if (isPinned) {
            // Unpin optimistically
            const next = { ...prev };
            if (next[activeConversationId!]?.messageId === messageId) delete next[activeConversationId!];
            return next;
          } else {
            return { ...prev, [activeConversationId!]: { messageId, content: data.content, senderName: data.senderName, type: data.type } };
          }
        });
        socket.emit('pin_message', { messageId, conversationId: activeConversationId });
        break;
      }
      case 'react':
        socket.emit('toggle_reaction', { ...data, conversationId: activeConversationId, userId: user?.id });
        break;
      case 'forward':
        setForwardDialogData({ singleMessage: data.message });
        break;
      case 'forward_selected':
        setForwardDialogData({ messageIds: data.messageIds });
        break;
      case 'cancel_upload': {
        const msgId = data.messageId;
        setMessagesByConversation(prev => {
          const msgs = prev[activeConversationId!];
          if (!msgs) return prev;
          return {
            ...prev,
            [activeConversationId!]: msgs.filter(m => m.id !== msgId)
          };
        });
        break;
      }
      case 'upload_failed': {
        const msgId = data.messageId;
        setMessagesByConversation(prev => {
          const msgs = prev[activeConversationId!];
          if (!msgs) return prev;
          return {
            ...prev,
            [activeConversationId!]: msgs.map(m => m.id === msgId ? { ...m, status: 'failed' } : m)
          };
        });
        break;
      }
      case 'upload_retry_start': {
        const msgId = data.messageId;
        setMessagesByConversation(prev => {
          const msgs = prev[activeConversationId!];
          if (!msgs) return prev;
          return {
            ...prev,
            [activeConversationId!]: msgs.map(m => m.id === msgId ? { ...m, status: 'sending' } : m)
          };
        });
        break;
      }
    }
  };

  // Sync activeConversationData when conversations list updates (for real-time presence)
  useEffect(() => {
    if (activeConversationId) {
      const updated = conversations.find(c => c.id === activeConversationId);
      if (updated) {
        setActiveConversationData(updated);
      }
    }
  }, [conversations, activeConversationId]);

  // ── Mark messages as read (BATCHED) ────────────────────────────────────────
  // Old: N socket events for N unread messages = N DB upserts.
  // New: ONE event with all unread message IDs = ONE batch transaction.
  // This reduces socket + DB load by up to 50x on busy conversations.
  const markMessagesAsRead = useCallback((conversationId: string, msgs: any[]) => {
    if (!socket || !isConnected || !user) return;

    const unreadIds = msgs
      .filter(m => !m.isMe && m.status !== 'read')
      .map(m => m.id)
      // Only mark real IDs (not temp-* optimistic IDs)
      .filter(id => !id.startsWith('temp-'));

    if (unreadIds.length === 0) return;

    // Single batched event to the server
    socket.emit('mark_conversation_read', {
      conversationId,
      userId: user.id,
      messageIds: unreadIds,
    });

    // Optimistic local update
    setMessagesByConversation(prev => ({
      ...prev,
      [conversationId]: prev[conversationId].map(m =>
        !m.isMe && m.status !== 'read' ? { ...m, status: 'read' } : m
      ),
    }));
  }, [socket, isConnected, user]);

  useEffect(() => {
    if (activeConversationId) {
      if (typeof window !== 'undefined') {
        (window as any).activeConversationId = activeConversationId;
      }
      const msgs = messagesByConversation[activeConversationId];
      if (msgs && msgs.length > 0) {
        // Locate first unread message before marking them as read
        const firstUnread = msgs.find(m => !m.isMe && (m.isRead === false || m.status !== 'read'));
        if (firstUnread) {
          setUnreadSeparatorMessageId(firstUnread.id);
        }

        markMessagesAsRead(activeConversationId, msgs);
        markConversationRead(activeConversationId);

        // Telegram-style: Remove unread separator pill smoothly after messages are marked read
        const timer = setTimeout(() => {
          setUnreadSeparatorMessageId(null);
        }, 2500);

        return () => clearTimeout(timer);
      }
    } else {
      if (typeof window !== 'undefined') {
        (window as any).activeConversationId = null;
      }
      setUnreadSeparatorMessageId(null);
    }
  }, [activeConversationId, messagesByConversation, markMessagesAsRead, markConversationRead]);

  // ── Socket: listen for new messages ───────────────────────────
  useEffect(() => {
    if (!socket || !user) return;

    const handleNewMessage = (message: any) => {
      const clientReceivedAt = Date.now();
      const convId: string = message.conversationId;
      const currentUser = userRef.current;

      // ── E2E Latency Logging ───────────────────────────────────────────────
      if (message.performance?.clientSent) {
        const e2eMs = clientReceivedAt - message.performance.clientSent;
        const dbMs = message.performance.dbWriteTime;
        const transitMs = message.performance.serverReceived - message.performance.clientSent;
        console.log(
          `[Messaging Latency] new_message received:\n` +
          `  - Client→Server Transit: ${transitMs}ms\n` +
          `  - DB Write: ${dbMs}ms\n` +
          `  - End-to-End (Client→Client): ${e2eMs}ms`
        );
        if (e2eMs > 500) {
          console.warn(`[Messaging Latency] ⚠️ High latency detected: ${e2eMs}ms E2E for conversation ${convId}`);
        }
      }

      const formatted = {
        id: message.id || Date.now().toString(),
        senderId: message.senderId,
        senderName: message.sender?.full_name || 'Unknown',
        content: message.content,
        timestamp: formatLocalizedTime(message.createdAt || new Date(), language),
        status: 'sent',
        type: message.type || 'TEXT',
        attachments: message.attachments,
        isMe: message.senderId === currentUser?.id,
        tempId: message.tempId,
        metadata: message.metadata || null,
        isPinned: message.isPinned || false,
        replyTo: message.replyTo
          ? {
              id: message.replyTo.id,
              content: message.replyTo.content,
              senderName: message.replyTo.sender?.full_name || 'Unknown',
              type: message.replyTo.type || 'TEXT',
            }
          : null,
        forwardedFrom: message.forwardedFrom || null,
      };

      // Append ONLY to the correct conversation bucket
      setMessagesByConversation(prev => {
        const existing = prev[convId] || [];
        
        // If we find a message with the same tempId, it means this is the confirmation of our optimistic message
        if (formatted.tempId) {
          const index = existing.findIndex(m => m.id === formatted.tempId);
          if (index !== -1) {
            const updated = [...existing];
            updated[index] = { ...formatted };
            // Also update in IndexedDB cache
            cacheMessages(convId, updated).catch(() => {});
            return { ...prev, [convId]: updated };
          }
        }

        // Deduplicate by id
        if (existing.some(m => m.id === formatted.id)) return prev;

        // ── Persist new message to IndexedDB for offline access ──
        appendCachedMessage(convId, formatted).catch(() => {});

        return { ...prev, [convId]: [...existing, formatted] };
      });

      // Update sidebar last-message preview and re-sort (most recent at top, like Telegram)
      setConversations(prev => {
        const nowTs = Date.now();
        const updated = prev.map(c =>
          c.id === convId
            ? {
                ...c,
                lastMessage: message.content,
                timestamp: t("just_now"),
                updatedAt: nowTs,
                unreadCount:
                  convId !== activeConversationIdRef.current
                    ? (c.unreadCount || 0) + 1
                    : 0,
              }
            : c
        );

        // Separate and re-sort: active chats by recency, directory contacts stay at bottom
        const activeChats = updated.filter(c => !c.isNewContact).sort((a, b) => b.updatedAt - a.updatedAt);
        const directory = updated.filter(c => c.isNewContact);
        return [...activeChats, ...directory];
      });
    };

    const handleMessageRead = (data: { messageId: string; userId: string; conversationId: string }) => {
      const { messageId, conversationId } = data;
      setMessagesByConversation(prev => {
        const msgs = prev[conversationId];
        if (!msgs) return prev;
        // Update IndexedDB cache too
        updateCachedMessage(conversationId, messageId, m => ({ ...m, status: 'read' })).catch(() => {});
        return {
          ...prev,
          [conversationId]: msgs.map(m => m.id === messageId ? { ...m, status: 'read' } : m)
        };
      });
    };

    const handleInitialOnlineUsers = (userIds: string[]) => {
      setConversations(prev => prev.map(c => ({
        ...c,
        isOnline: !c.isGroup && c.memberIds?.some((id: string) => id !== userRef.current?.id && userIds.includes(id))
      })));
    };

    const handleUserOnline = (userId: string) => {
      setConversations(prev => prev.map(c => 
        !c.isGroup && c.memberIds?.includes(userId) ? { ...c, isOnline: true } : c
      ));
    };

    const handleUserOffline = (userId: string) => {
      setConversations(prev => prev.map(c => 
        !c.isGroup && c.memberIds?.includes(userId) ? { ...c, isOnline: false, lastActive: new Date() } : c
      ));
    };

    const handleMessageEdited = (data: { messageId: string, content: string, conversationId: string }) => {
      setMessagesByConversation(prev => {
        const msgs = prev[data.conversationId];
        if (!msgs) return prev;
        // Update IndexedDB cache
        updateCachedMessage(data.conversationId, data.messageId, m => ({ ...m, content: data.content, editedAt: new Date() })).catch(() => {});
        return {
          ...prev,
          [data.conversationId]: msgs.map(m => m.id === data.messageId ? { ...m, content: data.content, editedAt: new Date() } : m)
        };
      });
    };

    const handleMessageDeleted = (data: { messageId: string, conversationId: string }) => {
      setMessagesByConversation(prev => {
        const msgs = prev[data.conversationId];
        if (!msgs) return prev;
        const filtered = msgs.filter(m => m.id !== data.messageId);
        // Update IndexedDB cache
        cacheMessages(data.conversationId, filtered).catch(() => {});
        return {
          ...prev,
          [data.conversationId]: filtered
        };
      });
    };

    const handleMessageDeletedForMe = (data: { messageId: string, conversationId: string }) => {
      setMessagesByConversation(prev => {
        const msgs = prev[data.conversationId];
        if (!msgs) return prev;
        const filtered = msgs.filter(m => m.id !== data.messageId);
        // Update IndexedDB cache
        cacheMessages(data.conversationId, filtered).catch(() => {});
        return {
          ...prev,
          [data.conversationId]: filtered
        };
      });
    };

    const handleMessagePinned = (data: { messageId: string; conversationId: string; isPinned: boolean; messageContent?: string; senderName?: string; messageType?: string }) => {
      setPinnedByConversation(prev => {
        if (!data.isPinned) {
          const next = { ...prev };
          // Only remove if it's the message being unpinned
          if (next[data.conversationId]?.messageId === data.messageId) {
            delete next[data.conversationId];
          }
          return next;
        }
        return {
          ...prev,
          [data.conversationId]: {
            messageId: data.messageId,
            content: data.messageContent,
            senderName: data.senderName,
            type: data.messageType,
          },
        };
      });
      // Also update the isPinned flag on the message in state
      setMessagesByConversation(prev => {
        const msgs = prev[data.conversationId];
        if (!msgs) return prev;
        return {
          ...prev,
          [data.conversationId]: msgs.map(m =>
            m.id === data.messageId ? { ...m, isPinned: data.isPinned } : m
          ),
        };
      });
    };

    const handleReactionUpdated = (data: { messageId: string, emoji: string, userId: string, action: 'added' | 'removed', conversationId: string }) => {
      setMessagesByConversation(prev => {
        const msgs = prev[data.conversationId];
        if (!msgs) return prev;
        return {
          ...prev,
          [data.conversationId]: msgs.map(m => {
            if (m.id !== data.messageId) return m;
            const existing = m.reactions || [];
            const updated = data.action === 'added' 
              ? [...existing, { emoji: data.emoji, userId: data.userId }]
              : existing.filter((r: any) => !(r.emoji === data.emoji && r.userId === data.userId));
            return { ...m, reactions: updated };
          })
        };
      });
    };

    // ── message_sent: server ACK — swap temp ID for real DB ID, status: sending→sent
    const handleMessageSent = (data: { tempId: string; messageId: string }) => {
      if (!data.tempId || !data.messageId) return;
      setMessagesByConversation(prev => {
        const updated: Record<string, any[]> = {};
        for (const [convId, msgs] of Object.entries(prev)) {
          updated[convId] = msgs.map(m =>
            m.id === data.tempId
              ? { ...m, id: data.messageId, status: 'sent' }
              : m
          );
        }
        return updated;
      });
    };

    // ── messages_delivered: recipient opened conversation — mark as delivered
    const handleMessagesDelivered = (data: { conversationId: string; userId: string; messageIds: string[] }) => {
      if (!data.messageIds?.length) return;
      const idSet = new Set(data.messageIds);
      setMessagesByConversation(prev => {
        const msgs = prev[data.conversationId];
        if (!msgs) return prev;
        return {
          ...prev,
          [data.conversationId]: msgs.map(m =>
            idSet.has(m.id) && m.isMe && m.status === 'sent'
              ? { ...m, status: 'delivered' }
              : m
          ),
        };
      });
    };

    // ── messages_read (batch): all messages read at once — one sweep
    const handleMessagesRead = (data: { conversationId: string; userId: string; messageIds: string[] }) => {
      if (!data.messageIds?.length) return;
      const idSet = new Set(data.messageIds);
      setMessagesByConversation(prev => {
        const msgs = prev[data.conversationId];
        if (!msgs) return prev;
        return {
          ...prev,
          [data.conversationId]: msgs.map(m =>
            idSet.has(m.id) && m.isMe ? { ...m, status: 'read' } : m
          ),
        };
      });
    };

    const handleMessageError = (data: { message: string; code?: string; tempId?: string }) => {
      // Mark the optimistic message as failed
      if (data.tempId) {
        setMessagesByConversation(prev => {
          const updated: Record<string, any[]> = {};
          for (const [convId, msgs] of Object.entries(prev)) {
            updated[convId] = msgs.map(m =>
              m.id === data.tempId ? { ...m, status: 'failed' } : m
            );
          }
          return updated;
        });
      }
      let displayTitle = t("error");
      let displayDescription = data.code === 'SCHOOL_EXPIRED' ? t("plan_expired_error") : data.message;
      if (data.code === 'SCHOOL_SUSPENDED' || (data.message && data.message.toLowerCase().includes('suspended'))) {
        displayTitle = "Portal Read-Only";
        displayDescription = "Your school account is suspended. Write actions are disabled, but historical records remain fully visible.";
      }
      toast({
        title: displayTitle,
        description: displayDescription,
        variant: 'destructive',
      });
    };

    const handleUserTyping = (data: { userId: string, full_name: string, conversationId: string }) => {
      if (data.userId === userRef.current?.id) return;
      setTypingUsers(prev => ({
        ...prev,
        [data.conversationId]: `${data.full_name} ${(t as any)("is_typing")}...`
      }));
    };


    const handleUserStopTyping = (data: { userId: string, conversationId: string }) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[data.conversationId];
        return next;
      });
    };

    socket.on('message_pinned', handleMessagePinned);
    socket.on('new_message', handleNewMessage);
    socket.on('message_read', handleMessageRead);
    socket.on('message_sent', handleMessageSent);
    socket.on('messages_delivered', handleMessagesDelivered);
    socket.on('messages_read', handleMessagesRead);
    socket.on('initial_online_users', handleInitialOnlineUsers);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_deleted_for_me', handleMessageDeletedForMe);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('message_error', handleMessageError);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);

    return () => {
      socket.off('message_pinned', handleMessagePinned);
      socket.off('new_message', handleNewMessage);
      socket.off('message_read', handleMessageRead);
      socket.off('message_sent', handleMessageSent);
      socket.off('messages_delivered', handleMessagesDelivered);
      socket.off('messages_read', handleMessagesRead);
      socket.off('initial_online_users', handleInitialOnlineUsers);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_deleted_for_me', handleMessageDeletedForMe);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('message_error', handleMessageError);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
    };
  }, [socket, user]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    (content: string, options?: {
      type?: string;
      attachment?: any;
      replyToId?: string;
      isOptimistic?: boolean;
      tempId?: string;
      replaceTempId?: string;
    }) => {
      if (!activeConversationId || !user) return;

      // Case A: Upload finished — swap local-preview bubble with real attachment
      if (options?.replaceTempId) {
        const realTempId = options.replaceTempId;
        const updatedMessage = {
          id: realTempId,
          senderId: user.id,
          senderName: user.full_name || 'Me',
          content,
          timestamp: formatLocalizedTime(new Date(), language),
          status: 'sending' as const,
          type: options?.type || 'FILE',
          attachments: options?.attachment ? [options.attachment] : undefined,
          isMe: true,
        };
        setMessagesByConversation(prev => ({
          ...prev,
          [activeConversationId]: (prev[activeConversationId] || []).map(m =>
            m.id === realTempId ? updatedMessage : m
          ),
        }));
        if (!socket || !isConnected) return;
        socket.emit('send_message', {
          conversationId: activeConversationId,
          senderId: user.id,
          content,
          type: options?.type || 'FILE',
          attachment: options?.attachment,
          replyToId: options?.replyToId,
          tempId: realTempId,
          clientTimestamp: Date.now(),
        });
        return;
      }

      // Case B: Add new optimistic message
      const tempId = options?.tempId || `temp-${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        senderId: user.id,
        senderName: user.full_name || 'Me',
        content,
        timestamp: formatLocalizedTime(new Date(), language),
        status: 'sending' as const,
        type: options?.type || 'TEXT',
        attachments: options?.attachment ? [options.attachment] : undefined,
        isMe: true,
      };
      setMessagesByConversation(prev => ({
        ...prev,
        [activeConversationId]: [...(prev[activeConversationId] || []), optimisticMessage],
      }));

      // Update sidebar preview and bubble to top (even before server confirms)
      setConversations(prev => {
        const nowTs = Date.now();
        const updated = prev.map(c =>
          c.id === activeConversationId
            ? { ...c, lastMessage: content, timestamp: formatLocalizedTime(new Date(), language), updatedAt: nowTs, isNewContact: false }
            : c
        );
        const activeChats = updated.filter(c => !c.isNewContact).sort((a, b) => b.updatedAt - a.updatedAt);
        const directory = updated.filter(c => c.isNewContact);
        return [...activeChats, ...directory];
      });

      // Persist optimistic message to IndexedDB cache so it compiles offline and survives reload
      appendCachedMessage(activeConversationId, optimisticMessage).catch(() => {});

      // isOptimistic = local preview only, don't emit to socket yet
      if (options?.isOptimistic) return;

      // Case C: Send via socket if connected, otherwise queue to offline outbox
      if (socket && isConnected) {
        socket.emit('send_message', {
          conversationId: activeConversationId,
          senderId: user.id,
          content,
          type: options?.type || 'TEXT',
          attachment: options?.attachment,
          replyToId: options?.replyToId,
          tempId,
          clientTimestamp: Date.now(),
        });
      } else {
        // Offline-first: persist to outbox so the message survives disconnections.
        // The outbox drain effect will re-emit this when the socket reconnects.
        enqueueOutboxMessage({
          tempId,
          conversationId: activeConversationId,
          senderId: user.id,
          content,
          type: options?.type || 'TEXT',
          attachment: options?.attachment,
          replyToId: options?.replyToId,
          createdAt: Date.now(),
          retries: 0,
        }).catch(() => {});
        console.log('[Messaging] Offline — message queued to outbox:', tempId);
      }
    },
    [socket, isConnected, activeConversationId, user, language]
  );

  // ── Derive the messages to display for the active conversation ───────────────
  const currentMessages = activeConversationId
    ? messagesByConversation[activeConversationId] || []
    : [];

  const conversationsWithUnreadState = React.useMemo(() => {
    return conversations.map(c => ({
      ...c,
      unreadCount: unreadMap[c.id] !== undefined ? unreadMap[c.id] : (c.unreadCount || 0),
    }));
  }, [conversations, unreadMap]);

  return (
    <div className="h-full relative overflow-hidden">
      <ChatLayout
        showContentOnMobile={!!activeConversationId || showSavedMessages}
        sidebar={
          <ChatSidebar
            conversations={conversationsWithUnreadState}
            activeConversationId={showSavedMessages ? 'saved-messages' : (activeConversationId || undefined)}
            onSelectConversation={id => {
              setShowSavedMessages(false);
              const chat = conversations.find(c => c.id === id);
              handleSelectConversation(id, chat);
            }}
            onOpenSavedMessages={() => {
              setShowSavedMessages(true);
              setActiveConversationId(null);
              setActiveConversationData(null);
              setIsInfoPanelOpen(false);
            }}
            isLoading={isLoadingSidebar || !user}
            currentUser={user}
          />
        }
        content={
          <div className="flex h-full overflow-hidden">
            {showSavedMessages ? (
              <SavedMessagesPanel
                onClose={() => setShowSavedMessages(false)}
              />
            ) : (
              <>
                <ChatWindow
                  activeConversation={activeConversationData}
                  messages={currentMessages}
                  typingStatus={activeConversationId ? typingUsers[activeConversationId] : undefined}
                  onSendMessage={handleSendMessage}
                  isLoading={isFetchingMessages}
                  onBack={() => {
                    setActiveConversationId(null);
                    setActiveConversationData(null);
                  }}
                  onToggleInfo={() => setIsInfoPanelOpen(!isInfoPanelOpen)}
                  onAction={handleAction}
                  onDeleteChat={handleDeleteChat}
                  onClearHistory={handleClearHistory}
                  onToggleBlock={handleToggleBlock}
                  isMuted={isMuted}
                  isBlocked={isBlocked}
                  onToggleMute={handleToggleMute}
                  pinnedMessage={activeConversationId ? pinnedByConversation[activeConversationId] : undefined}
                  unreadSeparatorMessageId={unreadSeparatorMessageId}
                />
                {isInfoPanelOpen && activeConversationData?.isGroup && (
                  <GroupInfoPanel 
                    group={activeConversationData}
                    currentUser={user}
                    onClose={() => setIsInfoPanelOpen(false)}
                    onUpdateRole={handleUpdateRole}
                    onRemoveMember={handleRemoveMember}
                    onGroupUpdated={(updated) => {
                      setActiveConversationData(updated);
                    }}
                    onLeaveGroup={() => {
                      setActiveConversationId(null);
                      setActiveConversationData(null);
                      setIsInfoPanelOpen(false);
                      loadData();
                    }}
                    onSendMessage={() => {
                      setIsInfoPanelOpen(false);
                    }}
                    onNavigateToMessage={(mid) => {
                      setIsInfoPanelOpen(false);
                      setTimeout(() => {
                        const el = document.getElementById(`msg-${mid}`);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2', 'transition-all');
                          setTimeout(() => {
                            el.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-2');
                          }, 2500);
                        }
                      }, 150);
                    }}
                  />
                )}
                {isInfoPanelOpen && !activeConversationData?.isGroup && (
                  <UserInfoPanel 
                    user={activeConversationData}
                    currentUser={user}
                    conversationId={activeConversationId}
                    onClose={() => setIsInfoPanelOpen(false)}
                    onAction={handleAction}
                    onNavigateToMessage={(mid) => {
                      setIsInfoPanelOpen(false);
                      setTimeout(() => {
                        const el = document.getElementById(`msg-${mid}`);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2', 'transition-all');
                          setTimeout(() => {
                            el.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-2');
                          }, 2500);
                        }
                      }, 150);
                    }}
                  />
                )}

              </>
            )}
          </div>
        }
      />

      <CreateGroupModal 
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onCreated={(group) => {
          setConversations(prev => [group, ...prev]);
          handleSelectConversation(group.id, group);
        }}
        currentUser={user}
      />

      {/* Target Conversation Selector Modal for Forwarding */}
      <AnimatePresence>
        {forwardDialogData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setForwardDialogData(null); setForwardSearchQuery(''); }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-background border border-border/60 shadow-2xl rounded-3xl w-full max-w-md overflow-hidden relative z-10 flex flex-col max-h-[80vh]"
            >
              <div className="p-5 border-b border-border/40 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg tracking-tight text-foreground">Forward Message</h3>
                  <p className="text-xs text-muted-foreground">Select a chat to send message</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setForwardDialogData(null); setForwardSearchQuery(''); }} className="h-8 w-8 rounded-full">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Search Box */}
              <div className="p-3 border-b border-border/30 bg-secondary/20">
                <input
                  type="text"
                  placeholder="Search chats or contacts..."
                  value={forwardSearchQuery}
                  onChange={(e) => setForwardSearchQuery(e.target.value)}
                  className="w-full bg-background border border-border/50 rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/60"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {/* Pinned Saved Messages option */}
                {(!forwardSearchQuery || 'saved messages'.includes(forwardSearchQuery.toLowerCase())) && (
                  <button
                    onClick={() => handleForwardTo('saved-messages')}
                    className="w-full flex items-center gap-3.5 p-3 rounded-2xl transition-colors hover:bg-emerald-600/10 hover:text-emerald-700 active:scale-[98] text-left group"
                  >
                    <div className="h-11 w-11 rounded-full bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <Bookmark className="h-5 w-5 text-emerald-600 group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground group-hover:text-emerald-750 transition-colors">Saved Messages</p>
                      <p className="text-xs text-muted-foreground/60">Forward to your private notes</p>
                    </div>
                  </button>
                )}

                <div className="h-px bg-border/40 mx-2 my-1" />

                {conversations
                  .filter(conv => !forwardSearchQuery || conv.name?.toLowerCase().includes(forwardSearchQuery.toLowerCase()))
                  .map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleForwardTo(conv.id)}
                      className="w-full flex items-center gap-3.5 p-3 rounded-2xl transition-colors hover:bg-secondary active:scale-[98] text-left"
                    >
                      <Avatar className="h-11 w-11 border border-border/20">
                        <AvatarImage src={conv.avatar || undefined} />
                        <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                          {conv.name?.slice(0, 2)?.toUpperCase() || 'CH'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{conv.name}</p>
                        <p className="text-xs text-muted-foreground/60 truncate">
                          {conv.isGroup ? `${conv.members?.length || 0} members` : conv.role || 'Chat'}
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
