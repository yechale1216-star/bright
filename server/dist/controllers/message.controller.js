"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConversationShared = exports.createConversation = exports.getBlockStatus = exports.unblockUser = exports.blockUser = exports.clearChatHistory = exports.getMuteStatus = exports.toggleMuteConversation = exports.getMessages = exports.getConversations = void 0;
const db_1 = __importDefault(require("../config/db"));
const getConversations = async (req, res) => {
    const userId = req.user?.id;
    const { limit = '30', cursor } = req.query;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const take = Math.min(Math.max(Number(limit) || 30, 1), 50);
    try {
        const conversations = await db_1.default.conversation.findMany({
            where: {
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
        const conversationsWithUnread = await Promise.all(conversations.map(async (conv) => {
            const unreadCount = await db_1.default.message.count({
                where: {
                    conversationId: conv.id,
                    senderId: { not: userId },
                    isDeleted: false,
                    readBy: { none: { userId } },
                },
            });
            return { ...conv, unreadCount };
        }));
        res.status(200).json(conversationsWithUnread);
    }
    catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
};
exports.getConversations = getConversations;
const getMessages = async (req, res) => {
    const { conversationId } = req.params;
    const { limit = '30', cursor } = req.query;
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const take = Math.min(Math.max(Number(limit) || 30, 1), 50);
    try {
        const [membership, messages] = await Promise.all([
            db_1.default.conversationMember.findFirst({
                where: { conversationId, userId },
                select: { id: true, clearedAt: true },
            }),
            db_1.default.message.findMany({
                where: { conversationId },
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
                        take: 20,
                        select: {
                            userId: true,
                        },
                    },
                    reactions: {
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
                ? m.readBy?.some((r) => r.userId !== userId)
                : m.readBy?.some((r) => r.userId === userId);
            return {
                ...m,
                isRead,
            };
        });
        res.status(200).json({
            messages: formattedMessages.reverse(),
            nextCursor,
            hasMore,
            hasNextPage: hasMore,
        });
    }
    catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};
exports.getMessages = getMessages;
const toggleMuteConversation = async (req, res) => {
    const { id: conversationId } = req.params;
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const membership = await db_1.default.conversationMember.findFirst({
            where: { conversationId, userId },
            select: { id: true, isMuted: true },
        });
        if (!membership) {
            return res.status(403).json({ error: 'You are not a member of this conversation' });
        }
        const updated = await db_1.default.conversationMember.update({
            where: { id: membership.id },
            data: { isMuted: !membership.isMuted },
            select: { isMuted: true },
        });
        return res.status(200).json({ isMuted: updated.isMuted });
    }
    catch (error) {
        console.error('[toggleMuteConversation] error:', error);
        return res.status(500).json({ error: 'Failed to toggle mute' });
    }
};
exports.toggleMuteConversation = toggleMuteConversation;
const getMuteStatus = async (req, res) => {
    const { id: conversationId } = req.params;
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const membership = await db_1.default.conversationMember.findFirst({
            where: { conversationId, userId },
            select: { isMuted: true },
        });
        if (!membership) {
            return res.status(403).json({ error: 'You are not a member of this conversation' });
        }
        return res.status(200).json({ isMuted: membership.isMuted });
    }
    catch (error) {
        console.error('[getMuteStatus] error:', error);
        return res.status(500).json({ error: 'Failed to get mute status' });
    }
};
exports.getMuteStatus = getMuteStatus;
const clearChatHistory = async (req, res) => {
    const { id: conversationId } = req.params;
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const membership = await db_1.default.conversationMember.findFirst({
            where: { conversationId, userId },
            select: { id: true },
        });
        if (!membership) {
            return res.status(403).json({ error: 'You are not a member of this conversation' });
        }
        await db_1.default.conversationMember.update({
            where: { id: membership.id },
            data: { clearedAt: new Date() },
        });
        return res.status(200).json({ success: true, clearedAt: new Date().toISOString() });
    }
    catch (error) {
        console.error('[clearChatHistory] error:', error);
        return res.status(500).json({ error: 'Failed to clear chat history' });
    }
};
exports.clearChatHistory = clearChatHistory;
const blockUser = async (req, res) => {
    const { targetUserId } = req.params;
    const blockerId = req.user?.id;
    if (!blockerId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (blockerId === targetUserId)
        return res.status(400).json({ error: 'Cannot block yourself' });
    try {
        const target = await db_1.default.user.findUnique({
            where: { id: targetUserId },
            select: { id: true },
        });
        if (!target)
            return res.status(404).json({ error: 'User not found' });
        const block = await db_1.default.userBlock.upsert({
            where: { blockerId_blockedId: { blockerId, blockedId: targetUserId } },
            create: { blockerId, blockedId: targetUserId },
            update: {},
        });
        return res.status(200).json({ blocked: true, blockId: block.id });
    }
    catch (error) {
        console.error('[blockUser] error:', error);
        return res.status(500).json({ error: 'Failed to block user' });
    }
};
exports.blockUser = blockUser;
const unblockUser = async (req, res) => {
    const { targetUserId } = req.params;
    const blockerId = req.user?.id;
    if (!blockerId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        await db_1.default.userBlock.deleteMany({
            where: { blockerId, blockedId: targetUserId },
        });
        return res.status(200).json({ blocked: false });
    }
    catch (error) {
        console.error('[unblockUser] error:', error);
        return res.status(500).json({ error: 'Failed to unblock user' });
    }
};
exports.unblockUser = unblockUser;
const getBlockStatus = async (req, res) => {
    const { targetUserId } = req.params;
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const [iBlockedThem, theyBlockedMe] = await Promise.all([
            db_1.default.userBlock.findFirst({
                where: { blockerId: userId, blockedId: targetUserId },
                select: { id: true },
            }),
            db_1.default.userBlock.findFirst({
                where: { blockerId: targetUserId, blockedId: userId },
                select: { id: true },
            }),
        ]);
        return res.status(200).json({
            iBlockedThem: !!iBlockedThem,
            theyBlockedMe: !!theyBlockedMe,
        });
    }
    catch (error) {
        console.error('[getBlockStatus] error:', error);
        return res.status(500).json({ error: 'Failed to get block status' });
    }
};
exports.getBlockStatus = getBlockStatus;
const createConversation = async (req, res) => {
    const { name, isGroup, memberIds, avatar } = req.body;
    try {
        const validUsers = await db_1.default.user.findMany({
            where: {
                id: { in: memberIds },
                is_active: true,
            },
            select: { id: true }
        });
        if (validUsers.length !== memberIds.length) {
            return res.status(403).json({
                error: 'Forbidden: One or more users are not found or not active'
            });
        }
        if (!isGroup && memberIds.length === 2) {
            const existingConversation = await db_1.default.conversation.findFirst({
                where: {
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
        const conversation = await db_1.default.conversation.create({
            data: {
                name,
                isGroup,
                avatar,
                members: {
                    create: memberIds.map((userId) => ({
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
    }
    catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
};
exports.createConversation = createConversation;
const getConversationShared = async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        let targetConvId = conversationId;
        const isMember = await db_1.default.conversationMember.findFirst({
            where: { conversationId: targetConvId, userId },
            select: { id: true },
        });
        if (!isMember) {
            const directConv = await db_1.default.conversation.findFirst({
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
        const mediaAndFiles = await db_1.default.message.findMany({
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
        const textMessages = await db_1.default.message.findMany({
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
        const savedBookmarks = await db_1.default.savedBookmark.findMany({
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
        const media = [];
        const files = [];
        const MEDIA_EXTS = /\.(jpg|jpeg|png|webp|gif|svg|mp4|mov|webm|mkv|avi)$/i;
        for (const m of mediaAndFiles) {
            const rawAtts = Array.isArray(m.attachments) ? m.attachments : (m.attachments ? [m.attachments] : []);
            if (rawAtts.length === 0 && !m.content)
                continue;
            const att = rawAtts[0] || {};
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
            }
            else {
                const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
                let fileCategory = 'other';
                if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext) || mime.includes('pdf') || mime.includes('word') || mime.includes('text')) {
                    fileCategory = 'document';
                }
                else if (['xls', 'xlsx', 'csv', 'ods'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) {
                    fileCategory = 'spreadsheet';
                }
                else if (['ppt', 'pptx', 'key'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) {
                    fileCategory = 'presentation';
                }
                else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed') || mime.includes('archive')) {
                    fileCategory = 'archive';
                }
                else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext) || mime.startsWith('audio/') || m.type === 'VOICE' || m.type === 'AUDIO') {
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
        const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
        const links = [];
        const seenUrls = new Set();
        for (const msg of textMessages) {
            const matches = msg.content?.match(URL_REGEX) || [];
            for (let rawUrl of matches) {
                let fullUrl = rawUrl;
                if (fullUrl.startsWith('www.'))
                    fullUrl = `https://${fullUrl}`;
                if (seenUrls.has(fullUrl))
                    continue;
                seenUrls.add(fullUrl);
                let domain = '';
                try {
                    domain = new URL(fullUrl).hostname.replace('www.', '');
                }
                catch {
                    domain = fullUrl;
                }
                const meta = msg.metadata?.linkPreview || {};
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
    }
    catch (error) {
        console.error('[SharedContent] error:', error);
        return res.status(500).json({ error: 'Failed to fetch shared content' });
    }
};
exports.getConversationShared = getConversationShared;
