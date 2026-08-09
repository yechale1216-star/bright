import { Response } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * POST /api/messages/:messageId/bookmark
 * Toggle bookmark state for a specific message.
 */
export const toggleBookmark = async (req: AuthenticatedRequest, res: Response) => {
  const { messageId } = req.params;
  const userId = req.user?.id;
  const schoolId = req.user?.schoolId;

  if (!userId || !schoolId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const message = await prisma.message.findFirst({
      where: { id: messageId, isDeleted: false },
      select: { id: true, conversationId: true },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Verify membership
    const isMember = await prisma.conversationMember.findFirst({
      where: { conversationId: message.conversationId, userId },
      select: { id: true },
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this conversation' });
    }

    // Check existing bookmark
    const existing = await prisma.savedBookmark.findUnique({
      where: {
        userId_messageId: { userId, messageId },
      },
    });

    if (existing) {
      await prisma.savedBookmark.delete({
        where: { id: existing.id },
      });
      return res.status(200).json({ isBookmarked: false, messageId });
    }

    await prisma.savedBookmark.create({
      data: {
        userId,
        messageId,
        conversationId: message.conversationId,
      },
    });

    return res.status(200).json({ isBookmarked: true, messageId });
  } catch (error) {
    console.error('[Bookmark] toggleBookmark error:', error);
    return res.status(500).json({ error: 'Failed to toggle bookmark' });
  }
};

/**
 * GET /api/messages/:conversationId/bookmarks
 * Get all bookmarked messages for a specific conversation.
 */
export const getConversationBookmarks = async (req: AuthenticatedRequest, res: Response) => {
  const { conversationId } = req.params;
  const userId = req.user?.id;
  const schoolId = req.user?.schoolId;
  const { limit = '30', cursor } = req.query;

  if (!userId || !schoolId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const take = Math.min(Math.max(Number(limit) || 30, 1), 100);

  try {
    // Verify membership
    const isMember = await prisma.conversationMember.findFirst({
      where: { conversationId, userId },
      select: { id: true },
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this conversation' });
    }

    const bookmarks = await prisma.savedBookmark.findMany({
      where: { userId, conversationId },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: String(cursor) } } : {}),
      orderBy: { createdAt: 'desc' },
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
            replyToId: true,
            attachments: true,
            metadata: true,
            sender: {
              select: {
                id: true,
                full_name: true,
                profile_photo: true,
              },
            },
          },
        },
      },
    });

    const hasNextPage = bookmarks.length > take;
    const page = hasNextPage ? bookmarks.slice(0, take) : bookmarks;
    const nextCursor = hasNextPage ? page[page.length - 1]?.id : null;

    // Filter out deleted messages if any
    const items = page
      .filter((b) => b.message && !b.message.isDeleted)
      .map((b) => ({
        bookmarkId: b.id,
        savedAt: b.createdAt,
        ...b.message,
      }));

    return res.status(200).json({
      items,
      nextCursor,
      hasNextPage,
    });
  } catch (error) {
    console.error('[Bookmark] getConversationBookmarks error:', error);
    return res.status(500).json({ error: 'Failed to fetch conversation bookmarks' });
  }
};
