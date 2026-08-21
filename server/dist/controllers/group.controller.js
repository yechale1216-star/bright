"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleMute = exports.toggleReaction = exports.deleteMessage = exports.editMessage = exports.unpinMessage = exports.pinMessage = exports.getGroupMedia = exports.updateMemberRole = exports.removeMember = exports.addMembers = exports.deleteGroup = exports.updateGroup = exports.getGroup = exports.createGroup = void 0;
const db_1 = __importDefault(require("../config/db"));
// ── Create Group ─────────────────────────────────────────────────────────────
const createGroup = async (req, res) => {
    const { name, description, groupType, isAnnouncement, memberIds, avatar } = req.body;
    const creatorId = req.user?.id;
    if (!creatorId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!name?.trim())
        return res.status(400).json({ error: 'Group name is required' });
    try {
        const allMemberIds = Array.from(new Set([creatorId, ...(memberIds || [])]));
        const users = await db_1.default.user.findMany({
            where: { id: { in: allMemberIds } },
            select: { id: true },
        });
        const validIds = new Set(users.map((u) => u.id));
        const filteredIds = allMemberIds.filter((id) => validIds.has(id));
        const group = await db_1.default.conversation.create({
            data: {
                name: name.trim(),
                description: description || null,
                groupType: groupType || 'CUSTOM',
                isAnnouncement: isAnnouncement || false,
                isGroup: true,
                avatar: avatar || null,
                createdBy: creatorId,
                members: {
                    create: filteredIds.map((userId) => ({
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
    }
    catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
};
exports.createGroup = createGroup;
// ── Get Group Details ─────────────────────────────────────────────────────────
const getGroup = async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    try {
        const group = await db_1.default.conversation.findFirst({
            where: {
                id,
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
        if (!group)
            return res.status(404).json({ error: 'Group not found' });
        res.json(group);
    }
    catch (error) {
        console.error('Error fetching group:', error);
        res.status(500).json({ error: 'Failed to fetch group' });
    }
};
exports.getGroup = getGroup;
// ── Update Group ──────────────────────────────────────────────────────────────
const updateGroup = async (req, res) => {
    const { id } = req.params;
    const { name, description, avatar, isAnnouncement } = req.body;
    const userId = req.user?.id;
    try {
        const member = await db_1.default.conversationMember.findFirst({
            where: { conversationId: id, userId, role: { in: ['OWNER', 'ADMIN'] } },
        });
        if (!member)
            return res.status(403).json({ error: 'Only admins can update group settings' });
        const updated = await db_1.default.conversation.update({
            where: { id },
            data: {
                ...(name ? { name: name.trim() } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(avatar !== undefined ? { avatar } : {}),
                ...(isAnnouncement !== undefined ? { isAnnouncement } : {}),
            },
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Error updating group:', error);
        res.status(500).json({ error: 'Failed to update group' });
    }
};
exports.updateGroup = updateGroup;
// ── Delete Group ──────────────────────────────────────────────────────────────
const deleteGroup = async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    try {
        const member = await db_1.default.conversationMember.findFirst({
            where: { conversationId: id, userId, role: 'OWNER' },
        });
        if (!member)
            return res.status(403).json({ error: 'Only group owner can delete the group' });
        await db_1.default.conversation.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({ error: 'Failed to delete group' });
    }
};
exports.deleteGroup = deleteGroup;
// ── Add Members ───────────────────────────────────────────────────────────────
const addMembers = async (req, res) => {
    const { id } = req.params;
    const { memberIds } = req.body;
    const userId = req.user?.id;
    try {
        const requester = await db_1.default.conversationMember.findFirst({
            where: { conversationId: id, userId, role: { in: ['OWNER', 'ADMIN'] } },
        });
        if (!requester)
            return res.status(403).json({ error: 'Only admins can add members' });
        const validUsers = await db_1.default.user.findMany({
            where: { id: { in: memberIds } },
            select: { id: true },
        });
        for (const uid of validUsers.map((u) => u.id)) {
            await db_1.default.conversationMember.upsert({
                where: { conversationId_userId: { conversationId: id, userId: uid } },
                create: { conversationId: id, userId: uid, role: 'MEMBER' },
                update: {},
            });
        }
        const updated = await db_1.default.conversation.findFirst({
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
    }
    catch (error) {
        console.error('Error adding members:', error);
        res.status(500).json({ error: 'Failed to add members' });
    }
};
exports.addMembers = addMembers;
// ── Remove Member ─────────────────────────────────────────────────────────────
const removeMember = async (req, res) => {
    const { id, userId: targetUserId } = req.params;
    const requesterId = req.user?.id;
    try {
        if (requesterId !== targetUserId) {
            const requester = await db_1.default.conversationMember.findFirst({
                where: { conversationId: id, userId: requesterId, role: { in: ['OWNER', 'ADMIN'] } },
            });
            if (!requester)
                return res.status(403).json({ error: 'Insufficient permissions' });
            const target = await db_1.default.conversationMember.findFirst({
                where: { conversationId: id, userId: targetUserId },
            });
            if (target?.role === 'OWNER')
                return res.status(403).json({ error: 'Cannot remove the group owner' });
        }
        await db_1.default.conversationMember.deleteMany({
            where: { conversationId: id, userId: targetUserId },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
};
exports.removeMember = removeMember;
// ── Update Member Role ────────────────────────────────────────────────────────
const updateMemberRole = async (req, res) => {
    const { id, userId: targetUserId } = req.params;
    const { role } = req.body;
    const requesterId = req.user?.id;
    if (!['ADMIN', 'MEMBER'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be ADMIN or MEMBER' });
    }
    try {
        const requester = await db_1.default.conversationMember.findFirst({
            where: { conversationId: id, userId: requesterId, role: 'OWNER' },
        });
        if (!requester)
            return res.status(403).json({ error: 'Only group owner can change roles' });
        const updated = await db_1.default.conversationMember.updateMany({
            where: { conversationId: id, userId: targetUserId },
            data: { role },
        });
        res.json({ success: true, updated });
    }
    catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
};
exports.updateMemberRole = updateMemberRole;
// ── Get Group Media ───────────────────────────────────────────────────────────
const getGroupMedia = async (req, res) => {
    const { getConversationShared } = await Promise.resolve().then(() => __importStar(require('./message.controller')));
    return getConversationShared(req, res);
};
exports.getGroupMedia = getGroupMedia;
// ── Pin/Unpin Message ─────────────────────────────────────────────────────────
const pinMessage = async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user?.id;
    try {
        const message = await db_1.default.message.findUnique({
            where: { id: messageId },
        });
        if (!message)
            return res.status(404).json({ error: 'Message not found' });
        const conversation = await db_1.default.conversation.findUnique({
            where: { id: message.conversationId },
        });
        if (!conversation)
            return res.status(404).json({ error: 'Conversation not found' });
        if (conversation.isGroup) {
            const member = await db_1.default.conversationMember.findFirst({
                where: {
                    conversationId: message.conversationId,
                    userId,
                    role: { in: ['OWNER', 'ADMIN'] },
                },
            });
            if (!member)
                return res.status(403).json({ error: 'Only admins can pin messages in groups' });
        }
        else {
            const member = await db_1.default.conversationMember.findFirst({
                where: { conversationId: message.conversationId, userId },
            });
            if (!member)
                return res.status(403).json({ error: 'Not a member of this conversation' });
        }
        await db_1.default.pinnedMessage.upsert({
            where: {
                conversationId_messageId: {
                    conversationId: message.conversationId,
                    messageId,
                },
            },
            create: { conversationId: message.conversationId, messageId, pinnedBy: userId },
            update: { pinnedBy: userId, pinnedAt: new Date() },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error pinning message:', error);
        res.status(500).json({ error: 'Failed to pin message' });
    }
};
exports.pinMessage = pinMessage;
const unpinMessage = async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user?.id;
    try {
        const message = await db_1.default.message.findUnique({ where: { id: messageId } });
        if (!message)
            return res.status(404).json({ error: 'Message not found' });
        const conversation = await db_1.default.conversation.findUnique({
            where: { id: message.conversationId },
        });
        if (!conversation)
            return res.status(404).json({ error: 'Conversation not found' });
        if (conversation.isGroup) {
            const member = await db_1.default.conversationMember.findFirst({
                where: {
                    conversationId: message.conversationId,
                    userId,
                    role: { in: ['OWNER', 'ADMIN'] },
                },
            });
            if (!member)
                return res.status(403).json({ error: 'Only admins can unpin messages in groups' });
        }
        else {
            const member = await db_1.default.conversationMember.findFirst({
                where: { conversationId: message.conversationId, userId },
            });
            if (!member)
                return res.status(403).json({ error: 'Not a member of this conversation' });
        }
        await db_1.default.pinnedMessage.deleteMany({
            where: { conversationId: message.conversationId, messageId },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error unpinning message:', error);
        res.status(500).json({ error: 'Failed to unpin message' });
    }
};
exports.unpinMessage = unpinMessage;
// ── Edit Message ──────────────────────────────────────────────────────────────
const editMessage = async (req, res) => {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;
    if (!content?.trim())
        return res.status(400).json({ error: 'Content cannot be empty' });
    try {
        const message = await db_1.default.message.findFirst({
            where: { id: messageId, senderId: userId },
        });
        if (!message)
            return res.status(404).json({ error: 'Message not found or not yours' });
        const updated = await db_1.default.message.update({
            where: { id: messageId },
            data: { content: content.trim(), editedAt: new Date() },
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Error editing message:', error);
        res.status(500).json({ error: 'Failed to edit message' });
    }
};
exports.editMessage = editMessage;
// ── Delete Message ────────────────────────────────────────────────────────────
const deleteMessage = async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user?.id;
    try {
        const message = await db_1.default.message.findUnique({
            where: { id: messageId },
        });
        if (!message)
            return res.status(404).json({ error: 'Message not found' });
        if (message.senderId !== userId) {
            const member = await db_1.default.conversationMember.findFirst({
                where: {
                    conversationId: message.conversationId,
                    userId,
                    role: { in: ['OWNER', 'ADMIN'] },
                },
            });
            if (!member)
                return res.status(403).json({ error: 'Cannot delete this message' });
        }
        await db_1.default.message.update({
            where: { id: messageId },
            data: { isDeleted: true, content: null },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
};
exports.deleteMessage = deleteMessage;
// ── Toggle Reaction ───────────────────────────────────────────────────────────
const toggleReaction = async (req, res) => {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user?.id;
    if (!emoji)
        return res.status(400).json({ error: 'Emoji is required' });
    try {
        const existing = await db_1.default.messageReaction.findFirst({
            where: { messageId, userId, emoji },
        });
        if (existing) {
            await db_1.default.messageReaction.delete({ where: { id: existing.id } });
            return res.json({ action: 'removed', emoji });
        }
        await db_1.default.messageReaction.create({
            data: { messageId, userId: userId, emoji },
        });
        res.json({ action: 'added', emoji });
    }
    catch (error) {
        console.error('Error toggling reaction:', error);
        res.status(500).json({ error: 'Failed to toggle reaction' });
    }
};
exports.toggleReaction = toggleReaction;
// ── Mute/Unmute Member ────────────────────────────────────────────────────────
const toggleMute = async (req, res) => {
    const { id } = req.params;
    const { muted, mutedUntil } = req.body;
    const userId = req.user?.id;
    try {
        await db_1.default.conversationMember.updateMany({
            where: { conversationId: id, userId },
            data: {
                isMuted: muted,
                mutedUntil: mutedUntil ? new Date(mutedUntil) : null,
            },
        });
        res.json({ success: true, muted });
    }
    catch (error) {
        console.error('Error toggling mute:', error);
        res.status(500).json({ error: 'Failed to update mute settings' });
    }
};
exports.toggleMute = toggleMute;
