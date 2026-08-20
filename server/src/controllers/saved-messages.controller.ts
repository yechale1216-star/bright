import { Response } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const SAVED_CONV_NAME = 'Saved Messages';

/**
 * GET /api/saved-messages/conversation
 * Get-or-create the user's Saved Messages conversation.
 */
export const getOrCreateSavedConversation = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let conversation = await prisma.conversation.findFirst({
      where: { savedMessagesFor: userId, isSavedMessages: true },
      include: {
        members: { include: { user: { select: { id: true, full_name: true, profile_photo: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          name: SAVED_CONV_NAME,
          isGroup: false,
          isSavedMessages: true,
          savedMessagesFor: userId,
          members: {
            create: [{ userId, role: 'OWNER' }],
          },
        },
        include: {
          members: { include: { user: { select: { id: true, full_name: true, profile_photo: true } } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
    }

    res.status(200).json(conversation);
  } catch (error) {
    console.error('[SavedMessages] getOrCreate error:', error);
    res.status(500).json({ error: 'Failed to get saved messages conversation' });
  }
};

/**
 * GET /api/saved-messages/messages?cursor=&limit=
 */
export const getSavedMessages = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { cursor, limit = '50', search } = req.query;
  const take = Math.min(Number(limit), 100);

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { savedMessagesFor: userId, isSavedMessages: true },
      select: { id: true },
    });
    if (!conversation) return res.status(200).json({ messages: [], hasNextPage: false, nextCursor: null });

    const where: any = {
      conversationId: conversation.id,
      isDeleted: false,
      ...(search ? { content: { contains: String(search), mode: 'insensitive' } } : {}),
    };

    const messages = await prisma.message.findMany({
      where,
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
        sender: { select: { id: true, full_name: true, profile_photo: true } },
        reactions: { select: { id: true, userId: true, emoji: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            sender: { select: { full_name: true } },
          },
        },
      },
    });

    const hasNextPage = messages.length > take;
    const page = hasNextPage ? messages.slice(0, take) : messages;
    const nextCursor = hasNextPage ? page[page.length - 1]?.id : null;

    res.status(200).json({ messages: page.reverse(), hasNextPage, nextCursor });
  } catch (error) {
    console.error('[SavedMessages] getMessages error:', error);
    res.status(500).json({ error: 'Failed to fetch saved messages' });
  }
};

/**
 * POST /api/saved-messages/messages
 */
export const saveSavedMessage = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { content, type = 'TEXT', attachment, forwardedFromId, replyToId } = req.body;

  try {
    let conversation = await prisma.conversation.findFirst({
      where: { savedMessagesFor: userId, isSavedMessages: true },
      select: { id: true },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          name: SAVED_CONV_NAME,
          isGroup: false,
          isSavedMessages: true,
          savedMessagesFor: userId,
          members: { create: [{ userId, role: 'OWNER' }] },
        },
        select: { id: true },
      });
    }

    let attachmentsJson: any = undefined;
    if (attachment) {
      const { isLocal, ...cleanAttachment } = attachment;
      if (cleanAttachment.url && !cleanAttachment.url.startsWith('blob:')) {
        attachmentsJson = [cleanAttachment];
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        content,
        type,
        forwardedFromId: forwardedFromId || null,
        replyToId: replyToId || null,
        attachments: attachmentsJson ?? undefined,
      },
      include: {
        sender: { select: { id: true, full_name: true, profile_photo: true } },
        reactions: true,
        replyTo: true,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('[SavedMessages] saveMessage error:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
};

/**
 * DELETE /api/saved-messages/messages/:messageId
 */
export const deleteSavedMessage = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { messageId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { savedMessagesFor: userId, isSavedMessages: true },
      select: { id: true },
    });
    if (!conversation) return res.status(404).json({ error: 'Saved Messages not found' });

    const message = await prisma.message.findFirst({
      where: { id: messageId, conversationId: conversation.id, senderId: userId },
    });
    if (!message) return res.status(404).json({ error: 'Message not found or unauthorized' });

    await prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, content: 'This message was deleted' },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[SavedMessages] deleteMessage error:', error);
    res.status(500).json({ error: 'Failed to delete saved message' });
  }
};
