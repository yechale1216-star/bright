"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConversationShared = exports.createConversation = exports.getMessages = exports.getConversations = void 0;
const db_1 = __importDefault(require("../config/db"));
const getConversations = async (req, res) => {
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const { limit = '30', cursor } = req.query;
    if (!schoolId) {
        return res.status(401).json({ error: 'Unauthorized: School ID missing' });
    }
    const take = Math.min(Math.max(Number(limit) || 30, 1), 50);
    try {
        const conversations = await db_1.default.conversation.findMany({
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
        res.status(200).json(conversations);
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
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    if (!schoolId || !userId) {
        return res.status(401).json({ error: 'Unauthorized: School ID missing' });
    }
    const take = Math.min(Math.max(Number(limit) || 30, 1), 50); // Default 30, cap at 50
    try {
        const [membership, messages] = await Promise.all([
            db_1.default.conversationMember.findFirst({
                where: { conversationId, userId },
                select: { id: true },
            }),
            db_1.default.message.findMany({
                where: { conversationId, schoolId },
                take: take + 1, // fetch one extra to determine if there's a next page
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
                        where: { schoolId, userId: { not: userId } },
                        take: 1,
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
        const hasMore = messages.length > take;
        const page = hasMore ? messages.slice(0, take) : messages;
        const nextCursor = hasMore ? page[page.length - 1]?.id : null;
        // Return in chronological order (oldest first)
        res.status(200).json({
            messages: page.reverse(),
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
const createConversation = async (req, res) => {
    const { name, isGroup, memberIds, avatar } = req.body;
    // Use x-school-id header as the authoritative school context.
    // req.user.schoolId can fall back to the JWT's default school (which may be suspended/wrong)
    // when tenantMiddleware cannot resolve the role for the /api/messages path.
    const headerSchoolId = req.headers['x-school-id'];
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
        const staffInSchool = await db_1.default.user.findMany({
            where: {
                id: { in: memberIds },
                schoolId,
                is_active: true,
            },
            select: { id: true }
        });
        const parentLinksInSchool = await db_1.default.parentStudentLink.findMany({
            where: {
                parentId: { in: memberIds },
                schoolId,
            },
            select: { parentId: true }
        });
        const parentIds = new Set(parentLinksInSchool.map((l) => l.parentId));
        const staffIds = new Set(staffInSchool.map((u) => u.id));
        const validMemberIds = memberIds.filter((id) => staffIds.has(id) || parentIds.has(id));
        if (validMemberIds.length !== memberIds.length) {
            return res.status(403).json({
                error: 'Forbidden: One or more users are not found in your school or are not authorized for communication'
            });
        }
        // If not a group, check if a 1:1 conversation already exists in THIS school
        if (!isGroup && memberIds.length === 2) {
            const existingConversation = await db_1.default.conversation.findFirst({
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
        const conversation = await db_1.default.conversation.create({
            data: {
                name,
                isGroup,
                avatar,
                schoolId,
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
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        let targetConvId = conversationId;
        // Verify membership or direct contact conversation
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
        // 1. Fetch Media & File messages
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
        // 2. Fetch Text messages containing links
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
        // 3. Fetch Saved Bookmarks for this conversation
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
        // Categorize Media vs Files
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
                // File categorization
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
        // Extract Links from text messages
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
    }
    catch (error) {
        console.error('[SharedContent] error:', error);
        return res.status(500).json({ error: 'Failed to fetch shared content' });
    }
};
exports.getConversationShared = getConversationShared;
