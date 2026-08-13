import { Request, Response } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getConversations = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const schoolId = req.user?.schoolId;
  const { limit = '30', cursor } = req.query;

  if (!schoolId) {
    return res.status(401).json({ error: 'Unauthorized: School ID missing' });
  }

  const take = Math.min(Math.max(Number(limit) || 30, 1), 50);

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        schoolId,
        members: {
          some: { userId },
        },
      },
      take,
      ...(cursor ? { skip: 1, cursor: { id: String(cursor) } } : {}),
      select: {
        id: true,
        name: true,
        isGroup: true,
        avatar: true,
        description: true,
        groupType: true,
        isAnnouncement: true,
        isSavedMessages: true,
        createdAt: true,
        updatedAt: true,
        members: {
          take: 10,
          select: {
            id: true,
            userId: true,
            role: true,
            isMuted: true,
            user: {
              select: {
                id: true,
                full_name: true,
                profile_photo: true,
                phone: true,
                role: true,
                lastActive: true,
              },
            },
          },
        },
        messages: {
          where: { schoolId },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            type: true,
            createdAt: true,
            senderId: true,
            sender: {
              select: { full_name: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Calculate unread message count per conversation for the requesting user
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            schoolId,
            senderId: { not: userId },
            isDeleted: false,
            readBy: { none: { userId } },
          },
        });
        return { ...conv, unreadCount };
      })
    );

    res.status(200).json(conversationsWithUnread);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

export const getMessages = async (req: AuthenticatedRequest, res: Response) => {
  const { conversationId } = req.params;
  const { limit = '30', cursor } = req.query;
  const schoolId = req.user?.schoolId;
  const userId = req.user?.id;

  if (!schoolId || !userId) {
    return res.status(401).json({ error: 'Unauthorized: School ID missing' });
  }

  const take = Math.min(Math.max(Number(limit) || 30, 1), 50); // Default 30, cap at 50

  try {
    const [membership, messages] = await Promise.all([
      prisma.conversationMember.findFirst({
        where: { conversationId, userId },
        select: { id: true, clearedAt: true },
      }),
      prisma.message.findMany({
        where: { conversationId, schoolId },
        take: take + 1,
        ...(cursor ? { skip: 1, cursor: { id: String(cursor) } } : {}),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          content: true,
          type: true,
          createdAt: true,
          updatedAt: true,
          editedAt: true,
          isDeleted: true,
          replyToId: true,
          forwardedFromId: true,
          attachments: true,
          metadata: true,
          sender: {
            select: {
              id: true,
              full_name: true,
              profile_photo: true,
            },
          },
          readBy: {
            where: { schoolId },
            take: 20,
            select: {
              userId: true,
            },
          },
          reactions: {
            where: { schoolId },
            select: {
              id: true,
              userId: true,
              emoji: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              type: true,
              sender: {
                select: {
                  full_name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!membership) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this conversation' });
    }

    // Filter out messages that were cleared by this user
    const clearedAt = membership.clearedAt;
    const visibleMessages = clearedAt
      ? messages.filter((m) => m.createdAt > clearedAt)
      : messages;

    const hasMore = visibleMessages.length > take;
    const page = hasMore ? visibleMessages.slice(0, take) : visibleMessages;
    const nextCursor = hasMore ? page[page.length - 1]?.id : null;

    const formattedMessages = page.map((m) => {
      const isMe = m.senderId === userId;
      const isRead = isMe
        ? m.readBy.some((r) => r.userId !== userId)
        : m.readBy.some((r) => r.userId === userId);
      return {
        ...m,
        isRead,
      };
    });

    // Return in chronological order (oldest first)
    res.status(200).json({
      messages: formattedMessages.reverse(),
      nextCursor,
      hasMore,
      hasNextPage: hasMore,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// ── Toggle Mute / Unmute Conversation ─────────────────────────────────────────
export const toggleMuteConversation = async (req: AuthenticatedRequest, res: Response) => {
  const { id: conversationId } = req.params;
  const userId = req.user?.id;
  const schoolId = req.user?.schoolId;

  if (!userId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const membership = await prisma.conversationMember.findFirst({
      where: { conversationId, userId },
      select: { id: true, isMuted: true },
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this conversation' });
    }

    const updated = await prisma.conversationMember.update({
      where: { id: membership.id },
      data: { isMuted: !membership.isMuted },
      select: { isMuted: true },
    });

    return res.status(200).json({ isMuted: updated.isMuted });
  } catch (error) {
    console.error('[toggleMuteConversation] error:', error);
    return res.status(500).json({ error: 'Failed to toggle mute' });
  }
};

// ── Get Mute Status ───────────────────────────────────────────────────────────
export const getMuteStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { id: conversationId } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const membership = await prisma.conversationMember.findFirst({
      where: { conversationId, userId },
      select: { isMuted: true },
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this conversation' });
    }

    return res.status(200).json({ isMuted: membership.isMuted });
  } catch (error) {
    console.error('[getMuteStatus] error:', error);
    return res.status(500).json({ error: 'Failed to get mute status' });
  }
};

// ── Clear Chat History (per-user) ─────────────────────────────────────────────
export const clearChatHistory = async (req: AuthenticatedRequest, res: Response) => {
  const { id: conversationId } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const membership = await prisma.conversationMember.findFirst({
      where: { conversationId, userId },
      select: { id: true },
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this conversation' });
    }

    // Set clearedAt to NOW — getMessages will filter out all messages before this point
    await prisma.conversationMember.update({
      where: { id: membership.id },
      data: { clearedAt: new Date() },
    });

    return res.status(200).json({ success: true, clearedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[clearChatHistory] error:', error);
    return res.status(500).json({ error: 'Failed to clear chat history' });
  }
};

// ── Delete Conversation (remove user's membership) ───────────────────────────
export const deleteConversation = async (req: AuthenticatedRequest, res: Response) => {
  const { id: conversationId } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const membership = await prisma.conversationMember.findFirst({
      where: { conversationId, userId },
      select: { id: true },
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this conversation' });
    }

    // Delete only this user's membership — the conversation itself and the other user's
    // history remain completely untouched.
    await prisma.conversationMember.delete({
      where: { id: membership.id },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[deleteConversation] error:', error);
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
};

// ── Block User ────────────────────────────────────────────────────────────────
export const blockUser = async (req: AuthenticatedRequest, res: Response) => {
  const { targetUserId } = req.params;
  const blockerId = req.user?.id;
  const schoolId = req.user?.schoolId;

  if (!blockerId) return res.status(401).json({ error: 'Unauthorized' });
  if (blockerId === targetUserId) return res.status(400).json({ error: 'Cannot block yourself' });

  try {
    // Verify target user exists and belongs to same school
    const target = await prisma.user.findFirst({
      where: { id: targetUserId, schoolId },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Upsert to prevent duplicate block records
    const block = await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId: targetUserId } },
      create: { blockerId, blockedId: targetUserId, schoolId },
      update: {},
    });

    return res.status(200).json({ blocked: true, blockId: block.id });
  } catch (error) {
    console.error('[blockUser] error:', error);
    return res.status(500).json({ error: 'Failed to block user' });
  }
};

// ── Unblock User ──────────────────────────────────────────────────────────────
export const unblockUser = async (req: AuthenticatedRequest, res: Response) => {
  const { targetUserId } = req.params;
  const blockerId = req.user?.id;

  if (!blockerId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    await prisma.userBlock.deleteMany({
      where: { blockerId, blockedId: targetUserId },
    });

    return res.status(200).json({ blocked: false });
  } catch (error) {
    console.error('[unblockUser] error:', error);
    return res.status(500).json({ error: 'Failed to unblock user' });
  }
};

// ── Get Block Status ──────────────────────────────────────────────────────────
export const getBlockStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { targetUserId } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const [iBlockedThem, theyBlockedMe] = await Promise.all([
      prisma.userBlock.findFirst({
        where: { blockerId: userId, blockedId: targetUserId },
        select: { id: true },
      }),
      prisma.userBlock.findFirst({
        where: { blockerId: targetUserId, blockedId: userId },
        select: { id: true },
      }),
    ]);

    return res.status(200).json({
      iBlockedThem: !!iBlockedThem,
      theyBlockedMe: !!theyBlockedMe,
    });
  } catch (error) {
    console.error('[getBlockStatus] error:', error);
    return res.status(500).json({ error: 'Failed to get block status' });
  }
};



export const createConversation = async (req: AuthenticatedRequest, res: Response) => {
  const { name, isGroup, memberIds, avatar } = req.body;

  // Use x-school-id header as the authoritative school context.
  // req.user.schoolId can fall back to the JWT's default school (which may be suspended/wrong)
  // when tenantMiddleware cannot resolve the role for the /api/messages path.
  const headerSchoolId = req.headers['x-school-id'] as string | undefined;
  const schoolId = headerSchoolId || req.user?.schoolId;

  if (!schoolId) {
    return res.status(401).json({ error: 'Unauthorized: School ID missing' });
  }

  try {
    // Verify all members are either:
    // a) Staff/Teachers/Admins in this school (via User.schoolId)
    // b) Parents linked to this school (via ParentStudentLink)
    // This handles the case of a parent (whose User.schoolId = SchoolA) messaging
    // a teacher in SchoolB (their child's school).
    const staffInSchool = await prisma.user.findMany({
      where: {
        id: { in: memberIds },
        schoolId,
        is_active: true,
      },
      select: { id: true }
    });

    const parentLinksInSchool = await prisma.parentStudentLink.findMany({
      where: {
        parentId: { in: memberIds },
        schoolId,
      },
      select: { parentId: true }
    });
    const parentIds = new Set(parentLinksInSchool.map((l: any) => l.parentId));
    const staffIds = new Set(staffInSchool.map((u: any) => u.id));

    const validMemberIds: string[] = memberIds.filter((id: string) => staffIds.has(id) || parentIds.has(id));

    if (validMemberIds.length !== memberIds.length) {
      return res.status(403).json({ 
        error: 'Forbidden: One or more users are not found in your school or are not authorized for communication' 
      });
    }

    // If not a group, check if a 1:1 conversation already exists in THIS school
    if (!isGroup && memberIds.length === 2) {
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          schoolId,
          isGroup: false,
          AND: [
            { members: { some: { userId: memberIds[0] } } },
            { members: { some: { userId: memberIds[1] } } },
          ],
        },
      });

      if (existingConversation) {
        return res.status(200).json(existingConversation);
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        name,
        isGroup,
        avatar,
        schoolId,
        members: {
          create: memberIds.map((userId: string) => ({
            userId,
            role: 'MEMBER',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                profile_photo: true,
                phone: true,
                role: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
};

export const getConversationShared = async (req: AuthenticatedRequest, res: Response) => {
  const { conversationId } = req.params;
  const schoolId = req.user?.schoolId;
  const userId   = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let targetConvId = conversationId;

    // Verify membership or direct contact conversation
    const isMember = await prisma.conversationMember.findFirst({
      where: { conversationId: targetConvId, userId },
      select: { id: true },
    });

    if (!isMember) {
      const directConv = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: conversationId } } },
          ],
        },
        select: { id: true },
      });

      if (!directConv) {
        return res.status(200).json({ media: [], files: [], links: [], saved: [] });
      }
      targetConvId = directConv.id;
    }

    // 1. Fetch Media & File messages
    const mediaAndFiles = await prisma.message.findMany({
      where: {
        conversationId: targetConvId,
        isDeleted: false,
        OR: [
          { type: { in: ['IMAGE', 'VIDEO', 'FILE', 'VOICE', 'AUDIO', 'DOCUMENT'] } },
          { type: { not: 'TEXT' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        sender: { select: { id: true, full_name: true, profile_photo: true } },
      },
    });


    // 2. Fetch Text messages containing links
    const textMessages = await prisma.message.findMany({
      where: {
        conversationId: targetConvId,
        isDeleted: false,
        OR: [
          { content: { contains: 'http://', mode: 'insensitive' } },
          { content: { contains: 'https://', mode: 'insensitive' } },
          { content: { contains: 'www.', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        content: true,
        createdAt: true,
        metadata: true,
        sender: { select: { id: true, full_name: true, profile_photo: true } },
      },
    });

    // 3. Fetch Saved Bookmarks for this conversation
    const savedBookmarks = await prisma.savedBookmark.findMany({
      where: { userId, conversationId: targetConvId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        message: {
          select: {
            id: true,
            conversationId: true,
            senderId: true,
            content: true,
            type: true,
            createdAt: true,
            updatedAt: true,
            editedAt: true,
            isDeleted: true,
            attachments: true,
            sender: { select: { id: true, full_name: true, profile_photo: true } },
          },
        },
      },
    });

    // Categorize Media vs Files
    const media: any[] = [];
    const files: any[] = [];

    const MEDIA_EXTS = /\.(jpg|jpeg|png|webp|gif|svg|mp4|mov|webm|mkv|avi)$/i;

    for (const m of mediaAndFiles) {
      const rawAtts = Array.isArray(m.attachments) ? m.attachments : (m.attachments ? [m.attachments] : []);
      if (rawAtts.length === 0 && !m.content) continue;

      const att: any = rawAtts[0] || {};
      const mime = (att.type || att.mimeType || '').toLowerCase();
      const url = att.url || m.content || '';
      const cleanUrl = url.split('?')[0].split('#')[0];

      const isMediaMime = mime.startsWith('image/') || mime.startsWith('video/');
      const isMediaExt = MEDIA_EXTS.test(cleanUrl);
      const isMediaType = m.type === 'IMAGE' || m.type === 'VIDEO';

      const isVideo = mime.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(cleanUrl) || m.type === 'VIDEO';

      if (isMediaType || isMediaMime || isMediaExt) {
        media.push({
          id: m.id,
          messageId: m.id,
          type: isVideo ? 'VIDEO' : 'IMAGE',
          mediaUrl: url,
          fileName: att.name || att.fileName || (isVideo ? 'Video' : 'Photo'),
          fileSize: att.size || null,
          mimeType: mime || (isVideo ? 'video/mp4' : 'image/jpeg'),
          createdAt: m.createdAt,
          sender: m.sender,
          attachments: rawAtts,
        });
      } else {
        // File categorization
        const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
        let fileCategory = 'other';
        if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext) || mime.includes('pdf') || mime.includes('word') || mime.includes('text')) {
          fileCategory = 'document';
        } else if (['xls', 'xlsx', 'csv', 'ods'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) {
          fileCategory = 'spreadsheet';
        } else if (['ppt', 'pptx', 'key'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) {
          fileCategory = 'presentation';
        } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed') || mime.includes('archive')) {
          fileCategory = 'archive';
        } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext) || mime.startsWith('audio/') || m.type === 'VOICE' || m.type === 'AUDIO') {
          fileCategory = 'audio';
        }

        files.push({
          id: m.id,
          messageId: m.id,
          fileName: att.name || att.fileName || (m.content?.split('/').pop()) || 'Attachment',
          fileSize: att.size || null,
          fileUrl: url,
          extension: ext,
          category: fileCategory,
          mimeType: mime,
          createdAt: m.createdAt,
          sender: m.sender,
          attachments: rawAtts,
        });
      }
    }

    // Extract Links from text messages
    const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
    const links: any[] = [];
    const seenUrls = new Set<string>();

    for (const msg of textMessages) {
      const matches = msg.content?.match(URL_REGEX) || [];
      for (let rawUrl of matches) {
        let fullUrl = rawUrl;
        if (fullUrl.startsWith('www.')) fullUrl = `https://${fullUrl}`;
        if (seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);

        let domain = '';
        try {
          domain = new URL(fullUrl).hostname.replace('www.', '');
        } catch {
          domain = fullUrl;
        }

        const meta = (msg.metadata as any)?.linkPreview || {};

        links.push({
          id: `${msg.id}-${fullUrl}`,
          messageId: msg.id,
          url: fullUrl,
          domain,
          title: meta.title || domain,
          description: meta.description || null,
          previewImage: meta.image || meta.previewImage || null,
          createdAt: msg.createdAt,
          sender: msg.sender,
        });
      }
    }

    // Process Saved Bookmarks
    const saved = savedBookmarks
      .filter((b) => b.message && !b.message.isDeleted)
      .map((b) => ({
        bookmarkId: b.id,
        savedAt: b.createdAt,
        messageId: b.message.id,
        content: b.message.content,
        type: b.message.type,
        createdAt: b.message.createdAt,
        sender: b.message.sender,
        attachments: b.message.attachments,
      }));

    return res.status(200).json({ media, files, links, saved });
  } catch (error) {
    console.error('[SharedContent] error:', error);
    return res.status(500).json({ error: 'Failed to fetch shared content' });
  }
};


