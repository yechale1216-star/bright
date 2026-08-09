import { Request, Response } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// ── Create Group ─────────────────────────────────────────────────────────────
export const createGroup = async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, groupType, isAnnouncement, memberIds, avatar } = req.body;
  const schoolId = req.user?.schoolId;
  const creatorId = req.user?.id;

  if (!schoolId || !creatorId) return res.status(401).json({ error: 'Unauthorized' });
  if (!name?.trim()) return res.status(400).json({ error: 'Group name is required' });

  try {
    // Ensure all members belong to this school
    const allMemberIds = Array.from(new Set([creatorId, ...(memberIds || [])]));
    const users = await prisma.user.findMany({
      where: { id: { in: allMemberIds }, schoolId },
      select: { id: true },
    });
    const validIds = new Set(users.map((u) => u.id));
    const filteredIds = allMemberIds.filter((id) => validIds.has(id));

    const group = await prisma.conversation.create({
      data: {
        name: name.trim(),
        description: description || null,
        groupType: groupType || 'CUSTOM',
        isAnnouncement: isAnnouncement || false,
        isGroup: true,
        avatar: avatar || null,
        schoolId,
        createdBy: creatorId,
        members: {
          create: filteredIds.map((userId: string) => ({
            userId,
            role: userId === creatorId ? 'OWNER' : 'MEMBER',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, full_name: true, profile_photo: true, role: true } },
          },
        },
      },
    });

    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
};

// ── Get Group Details ─────────────────────────────────────────────────────────
export const getGroup = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const schoolId = req.user?.schoolId;
  const userId = req.user?.id;

  try {
    const group = await prisma.conversation.findFirst({
      where: {
        id,
        schoolId,
        isGroup: true,
        members: { some: { userId } },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true, full_name: true, profile_photo: true,
                role: true, lastActive: true,
              },
            },
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
        pinnedMessages: {
          include: {
            message: {
              include: {
                sender: { select: { id: true, full_name: true } },
              },
            },
          },
          orderBy: { pinnedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
};

// ── Update Group ──────────────────────────────────────────────────────────────
export const updateGroup = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, avatar, isAnnouncement } = req.body;
  const schoolId = req.user?.schoolId;
  const userId = req.user?.id;

  try {
    const member = await prisma.conversationMember.findFirst({
      where: { conversationId: id, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!member) return res.status(403).json({ error: 'Only admins can update group settings' });

    const updated = await prisma.conversation.update({
      where: { id, schoolId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
        ...(isAnnouncement !== undefined ? { isAnnouncement } : {}),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
};

// ── Delete Group ──────────────────────────────────────────────────────────────
export const deleteGroup = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const schoolId = req.user?.schoolId;
  const userId = req.user?.id;

  try {
    const member = await prisma.conversationMember.findFirst({
      where: { conversationId: id, userId, role: 'OWNER' },
    });
    if (!member) return res.status(403).json({ error: 'Only group owner can delete the group' });

    await prisma.conversation.delete({ where: { id, schoolId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
};

// ── Add Members ───────────────────────────────────────────────────────────────
export const addMembers = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { memberIds } = req.body;
  const schoolId = req.user?.schoolId;
  const userId = req.user?.id;

  try {
    const requester = await prisma.conversationMember.findFirst({
      where: { conversationId: id, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!requester) return res.status(403).json({ error: 'Only admins can add members' });

    // Validate new members belong to school
    const validUsers = await prisma.user.findMany({
      where: { id: { in: memberIds }, schoolId },
      select: { id: true },
    });

    const toAdd = validUsers
      .map((u) => u.id)
      .filter(async (uid) => {
        const existing = await prisma.conversationMember.findFirst({
          where: { conversationId: id, userId: uid },
        });
        return !existing;
      });

    // Upsert to avoid duplicates
    for (const uid of validUsers.map((u) => u.id)) {
      await prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: id, userId: uid } },
        create: { conversationId: id, userId: uid, role: 'MEMBER' },
        update: {},
      });
    }

    const updated = await prisma.conversation.findFirst({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, full_name: true, profile_photo: true, role: true } },
          },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error adding members:', error);
    res.status(500).json({ error: 'Failed to add members' });
  }
};

// ── Remove Member ─────────────────────────────────────────────────────────────
export const removeMember = async (req: AuthenticatedRequest, res: Response) => {
  const { id, userId: targetUserId } = req.params;
  const schoolId = req.user?.schoolId;
  const requesterId = req.user?.id;

  try {
    // Can remove self, or admin/owner can remove others
    if (requesterId !== targetUserId) {
      const requester = await prisma.conversationMember.findFirst({
        where: { conversationId: id, userId: requesterId, role: { in: ['OWNER', 'ADMIN'] } },
      });
      if (!requester) return res.status(403).json({ error: 'Insufficient permissions' });

      // Owners cannot be removed by admins
      const target = await prisma.conversationMember.findFirst({
        where: { conversationId: id, userId: targetUserId },
      });
      if (target?.role === 'OWNER') return res.status(403).json({ error: 'Cannot remove the group owner' });
    }

    await prisma.conversationMember.deleteMany({
      where: { conversationId: id, userId: targetUserId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
};

// ── Update Member Role ────────────────────────────────────────────────────────
export const updateMemberRole = async (req: AuthenticatedRequest, res: Response) => {
  const { id, userId: targetUserId } = req.params;
  const { role } = req.body; // 'ADMIN' | 'MEMBER'
  const requesterId = req.user?.id;

  if (!['ADMIN', 'MEMBER'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be ADMIN or MEMBER' });
  }

  try {
    const requester = await prisma.conversationMember.findFirst({
      where: { conversationId: id, userId: requesterId, role: 'OWNER' },
    });
    if (!requester) return res.status(403).json({ error: 'Only group owner can change roles' });

    const updated = await prisma.conversationMember.updateMany({
      where: { conversationId: id, userId: targetUserId },
      data: { role },
    });

    res.json({ success: true, updated });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
};

// ── Get Group Media ───────────────────────────────────────────────────────────
export const getGroupMedia = async (req: AuthenticatedRequest, res: Response) => {
  const { getConversationShared } = await import('./message.controller');
  return getConversationShared(req, res);
};


// ── Pin/Unpin Message ─────────────────────────────────────────────────────────
export const pinMessage = async (req: AuthenticatedRequest, res: Response) => {
  const { messageId } = req.params;
  const userId = req.user?.id;
  const schoolId = req.user?.schoolId;

  try {
    const message = await prisma.message.findFirst({
      where: { id: messageId, schoolId },
    });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const conversation = await prisma.conversation.findUnique({
      where: { id: message.conversationId },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    if (conversation.isGroup) {
      const member = await prisma.conversationMember.findFirst({
        where: {
          conversationId: message.conversationId,
          userId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });
      if (!member) return res.status(403).json({ error: 'Only admins can pin messages in groups' });
    } else {
      const member = await prisma.conversationMember.findFirst({
        where: { conversationId: message.conversationId, userId },
      });
      if (!member) return res.status(403).json({ error: 'Not a member of this conversation' });
    }

    await prisma.pinnedMessage.upsert({
      where: {
        conversationId_messageId: {
          conversationId: message.conversationId,
          messageId,
        },
      },
      create: { conversationId: message.conversationId, messageId, pinnedBy: userId! },
      update: { pinnedBy: userId!, pinnedAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error pinning message:', error);
    res.status(500).json({ error: 'Failed to pin message' });
  }
};

export const unpinMessage = async (req: AuthenticatedRequest, res: Response) => {
  const { messageId } = req.params;
  const userId = req.user?.id;
  const schoolId = req.user?.schoolId;

  try {
    const message = await prisma.message.findFirst({ where: { id: messageId, schoolId } });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const conversation = await prisma.conversation.findUnique({
      where: { id: message.conversationId },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    if (conversation.isGroup) {
      const member = await prisma.conversationMember.findFirst({
        where: {
          conversationId: message.conversationId,
          userId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });
      if (!member) return res.status(403).json({ error: 'Only admins can unpin messages in groups' });
    } else {
      const member = await prisma.conversationMember.findFirst({
        where: { conversationId: message.conversationId, userId },
      });
      if (!member) return res.status(403).json({ error: 'Not a member of this conversation' });
    }

    await prisma.pinnedMessage.deleteMany({
      where: { conversationId: message.conversationId, messageId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error unpinning message:', error);
    res.status(500).json({ error: 'Failed to unpin message' });
  }
};

// ── Edit Message ──────────────────────────────────────────────────────────────
export const editMessage = async (req: AuthenticatedRequest, res: Response) => {
  const { messageId } = req.params;
  const { content } = req.body;
  const userId = req.user?.id;
  const schoolId = req.user?.schoolId;

  if (!content?.trim()) return res.status(400).json({ error: 'Content cannot be empty' });

  try {
    const message = await prisma.message.findFirst({
      where: { id: messageId, schoolId, senderId: userId },
    });
    if (!message) return res.status(404).json({ error: 'Message not found or not yours' });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content: content.trim(), editedAt: new Date() },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
};

// ── Delete Message ────────────────────────────────────────────────────────────
export const deleteMessage = async (req: AuthenticatedRequest, res: Response) => {
  const { messageId } = req.params;
  const userId = req.user?.id;
  const schoolId = req.user?.schoolId;

  try {
    const message = await prisma.message.findFirst({
      where: { id: messageId, schoolId },
    });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    // Allow sender to delete their own, admins can delete anyone's
    if (message.senderId !== userId) {
      const member = await prisma.conversationMember.findFirst({
        where: {
          conversationId: message.conversationId,
          userId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });
      if (!member) return res.status(403).json({ error: 'Cannot delete this message' });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, content: null },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

// ── Toggle Reaction ───────────────────────────────────────────────────────────
export const toggleReaction = async (req: AuthenticatedRequest, res: Response) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const userId = req.user?.id;
  const schoolId = req.user?.schoolId;

  if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

  try {
    const existing = await prisma.messageReaction.findFirst({
      where: { messageId, userId, emoji },
    });

    if (existing) {
      await prisma.messageReaction.delete({ where: { id: existing.id } });
      return res.json({ action: 'removed', emoji });
    }

    await prisma.messageReaction.create({
      data: { messageId, userId: userId!, emoji, schoolId },
    });

    res.json({ action: 'added', emoji });
  } catch (error) {
    console.error('Error toggling reaction:', error);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
};

// ── Mute/Unmute Member ────────────────────────────────────────────────────────
export const toggleMute = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params; // conversationId
  const { muted, mutedUntil } = req.body;
  const userId = req.user?.id;

  try {
    await prisma.conversationMember.updateMany({
      where: { conversationId: id, userId },
      data: {
        isMuted: muted,
        mutedUntil: mutedUntil ? new Date(mutedUntil) : null,
      },
    });

    res.json({ success: true, muted });
  } catch (error) {
    console.error('Error toggling mute:', error);
    res.status(500).json({ error: 'Failed to update mute settings' });
  }
};


