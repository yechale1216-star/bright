'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import { authService } from '@/lib/auth/auth';
import { updateAppBadge } from '@/lib/utils/app-badge';
import { apiUrl } from '@/lib/api-config';

interface UnreadContextType {
  totalUnreadCount: number;
  unreadMap: Record<string, number>;
  getUnreadForConv: (conversationId: string | null | undefined) => number;
  getUnreadForUser: (userId: string | null | undefined) => number;
  markConversationRead: (conversationId: string) => void;
  setConversationUnread: (conversationId: string, count: number) => void;
  syncConversations: (conversations: any[]) => void;
  refetchUnreadSummary: () => Promise<void>;
}

const UnreadContext = createContext<UnreadContextType>({
  totalUnreadCount: 0,
  unreadMap: {},
  getUnreadForConv: () => 0,
  getUnreadForUser: () => 0,
  markConversationRead: () => {},
  setConversationUnread: () => {},
  syncConversations: () => {},
  refetchUnreadSummary: async () => {},
});

export const useUnread = () => useContext(UnreadContext);

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
  const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(schoolId ? { 'x-school-id': schoolId } : {}),
  };
}

export const UnreadProvider = ({ children }: { children: React.ReactNode }) => {
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  // Mapping of conversationId -> otherMemberUserId for 1:1 direct messages
  const [convUserMap, setConvUserMap] = useState<Record<string, string>>({});
  const { socket } = useSocket();

  // Total unread count across all conversations
  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadMap).reduce((sum, count) => sum + (count || 0), 0);
  }, [unreadMap]);

  // Synchronize Capacitor native launcher badge
  useEffect(() => {
    updateAppBadge(totalUnreadCount).catch(() => {});
  }, [totalUnreadCount]);

  // Sync state from fetched conversations
  const syncConversations = useCallback((conversations: any[]) => {
    if (!Array.isArray(conversations)) return;

    const user = authService.getCurrentUser();
    const currentUserId = user?.id;

    setUnreadMap((prev) => {
      const nextMap = { ...prev };
      conversations.forEach((c) => {
        if (c.id) {
          nextMap[c.id] = c.unreadCount || 0;
        }
      });
      return nextMap;
    });

    if (currentUserId) {
      setConvUserMap((prev) => {
        const nextUserMap = { ...prev };
        conversations.forEach((c) => {
          if (c.id && !c.isGroup && Array.isArray(c.members)) {
            const otherMember = c.members.find((m: any) => (m.userId || m.user?.id) !== currentUserId);
            const otherId = otherMember?.userId || otherMember?.user?.id || c.realContactId;
            if (otherId) {
              nextUserMap[c.id] = otherId;
            }
          } else if (c.id && !c.isGroup && c.realContactId) {
            nextUserMap[c.id] = c.realContactId;
          }
        });
        return nextUserMap;
      });
    }
  }, []);

  // Fetch unread summary from DB
  const refetchUnreadSummary = useCallback(async () => {
    const user = authService.getCurrentUser();
    if (!user) return;

    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${apiUrl}/api/messages/conversations/${user.id}`, {
        headers,
        cache: 'no-store',
      });
      if (res.ok) {
        const conversations = await res.json();
        if (Array.isArray(conversations)) {
          syncConversations(conversations);
        }
      }
    } catch (err) {
      console.warn('[UnreadProvider] Failed to refetch unread summary:', err);
    }
  }, [syncConversations]);

  // Initial load
  useEffect(() => {
    refetchUnreadSummary();
  }, [refetchUnreadSummary]);

  // Listen to WebSocket events for instant real-time sync
  useEffect(() => {
    const handleNewMessage = (e: Event) => {
      const { conversationId, senderId } = (e as CustomEvent).detail || {};
      const currentUser = authService.getCurrentUser();

      if (!conversationId || (currentUser && senderId === currentUser.id)) return;

      const activeChatId = typeof window !== 'undefined' ? localStorage.getItem('zetime:active_chat_id') : null;

      // If user is actively viewing this conversation, do not increase unread count
      if (activeChatId === conversationId) return;

      setUnreadMap((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || 0) + 1,
      }));
    };

    const handleReadAck = (data: { conversationId: string; userId: string }) => {
      const currentUser = authService.getCurrentUser();
      if (currentUser && data.userId === currentUser.id) {
        setUnreadMap((prev) => ({
          ...prev,
          [data.conversationId]: 0,
        }));
      }
    };

    window.addEventListener('zetime:new_message', handleNewMessage);

    if (socket) {
      socket.on('conversation_read_ack', handleReadAck);
    }

    return () => {
      window.removeEventListener('zetime:new_message', handleNewMessage);
      if (socket) {
        socket.off('conversation_read_ack', handleReadAck);
      }
    };
  }, [socket]);

  // Helper methods
  const getUnreadForConv = useCallback(
    (conversationId: string | null | undefined): number => {
      if (!conversationId) return 0;
      return unreadMap[conversationId] || 0;
    },
    [unreadMap]
  );

  const getUnreadForUser = useCallback(
    (userId: string | null | undefined): number => {
      if (!userId) return 0;
      // Find direct conversation matching target userId
      for (const [convId, targetId] of Object.entries(convUserMap)) {
        if (targetId === userId) {
          return unreadMap[convId] || 0;
        }
      }
      return 0;
    },
    [unreadMap, convUserMap]
  );

  const markConversationRead = useCallback((conversationId: string) => {
    if (!conversationId) return;
    setUnreadMap((prev) => {
      if (!prev[conversationId]) return prev;
      return {
        ...prev,
        [conversationId]: 0,
      };
    });
  }, []);

  const setConversationUnread = useCallback((conversationId: string, count: number) => {
    if (!conversationId) return;
    setUnreadMap((prev) => ({
      ...prev,
      [conversationId]: Math.max(0, count),
    }));
  }, []);

  return (
    <UnreadContext.Provider
      value={{
        totalUnreadCount,
        unreadMap,
        getUnreadForConv,
        getUnreadForUser,
        markConversationRead,
        setConversationUnread,
        syncConversations,
        refetchUnreadSummary,
      }}
    >
      {children}
    </UnreadContext.Provider>
  );
};
