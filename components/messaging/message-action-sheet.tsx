'use client';

import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Reply, Edit, Pin, Forward, Trash2, X, Bookmark,
} from 'lucide-react';
import { cn } from '@/lib/utils/utils';

export interface MessageActionSheetMessage {
  id: string;
  content: string | null;
  isMe: boolean;
  isDeleted?: boolean;
  editedAt?: Date | string | null;
  type: string;
  senderName?: string;
  isPinned?: boolean;
  attachments?: any[];
}

export interface MessageActionSheetProps {
  message: MessageActionSheetMessage | null;
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
  onReply: () => void;
  onEdit: () => void;
  onPin: () => void;
  onForward: () => void;
  /** Called with deleteForEveryone flag */
  onDelete: (deleteForEveryone: boolean) => void;
  onBookmark?: () => void;
  /** Whether the current user can delete for everyone (own message or admin) */
  canDeleteForEveryone?: boolean;
  /** Name of the other person in the chat (DM) or undefined for groups */
  otherPersonName?: string;
  /** True if this is a group conversation */
  isGroup?: boolean;
}

// ── Action button item type ───────────────────────────────────────────────────
interface ActionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  isDestructive?: boolean;
  hidden?: boolean;
}

export const MessageActionSheet: React.FC<MessageActionSheetProps> = ({
  message,
  isOpen,
  onClose,
  onCopy,
  onReply,
  onEdit,
  onPin,
  onForward,
  onDelete,
  onBookmark,
  canDeleteForEveryone = false,
  otherPersonName,
  isGroup = false,
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on back-gesture / Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Reset inner dialog when sheet closes
  useEffect(() => {
    if (!isOpen) setShowDeleteDialog(false);
  }, [isOpen]);

  if (!message) return null;

  const isText = message.type === 'TEXT';
  const isPinned = !!(message as any).isPinned;

  const actions: ActionItem[] = [
    {
      id: 'copy',
      label: 'Copy Text',
      icon: <Copy className="h-5 w-5" />,
      hidden: message.isDeleted || !message.content,
      onClick: () => { onCopy(); onClose(); },
    },
    {
      id: 'reply',
      label: 'Reply',
      icon: <Reply className="h-5 w-5" />,
      hidden: !!message.isDeleted,
      onClick: () => { onReply(); onClose(); },
    },
    {
      id: 'edit',
      label: 'Edit Message',
      icon: <Edit className="h-5 w-5" />,
      // Only show for own text messages that aren't deleted
      hidden: !message.isMe || message.isDeleted || !isText,
      onClick: () => { onEdit(); onClose(); },
    },
    {
      id: 'pin',
      label: isPinned ? 'Unpin Message' : 'Pin Message',
      icon: isPinned
        ? <Pin className="h-5 w-5 rotate-45" />
        : <Pin className="h-5 w-5" />,
      hidden: !!message.isDeleted,
      onClick: () => { onPin(); onClose(); },
    },
    {
      id: 'forward',
      label: 'Forward',
      icon: <Forward className="h-5 w-5" />,
      hidden: !!message.isDeleted,
      onClick: () => { onForward(); onClose(); },
    },
    {
      id: 'bookmark',
      label: 'Save Message',
      icon: <Bookmark className="h-5 w-5 text-emerald-500" />,
      hidden: !!message.isDeleted,
      onClick: () => { if (onBookmark) onBookmark(); onClose(); },
    },

    {
      id: 'delete',
      label: message.isMe
        ? 'Delete'
        : 'Delete for Me',
      icon: <Trash2 className="h-5 w-5" />,
      isDestructive: true,
      onClick: () => setShowDeleteDialog(true),
    },
  ].filter(a => !a.hidden);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[300] flex items-end justify-center">
            {/* Blurred dim backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-[3px]"
              onClick={onClose}
            />

            {/* Bottom Sheet */}
            <motion.div
              key="sheet"
              ref={sheetRef}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 380, mass: 0.8 }}
              className="relative z-10 w-full max-w-lg mx-auto"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Message preview chip at top of sheet */}
              {!message.isDeleted && (message.content || (message.attachments && message.attachments.length > 0)) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04, duration: 0.16 }}
                  className="mx-3 mb-2 bg-background/95 backdrop-blur-xl border border-border/60 rounded-2xl px-4 py-3 shadow-lg"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                      {message.isMe ? 'You' : (message.senderName || 'Message')}
                    </span>
                    {message.editedAt && (
                      <span className="text-[9px] text-muted-foreground/60 italic">edited</span>
                    )}
                  </div>
                  <p className="text-[13px] text-foreground/90 line-clamp-3 leading-relaxed">
                    {message.content ||
                      (message.attachments?.[0]?.type?.startsWith('image/') ? '📷 Photo'
                        : message.type === 'VIDEO' ? '🎥 Video'
                        : message.type === 'FILE' ? '📎 File'
                        : '📎 Attachment')}
                  </p>
                </motion.div>
              )}

              {/* Action list */}
              <div className="mx-3 mb-3 bg-background/98 backdrop-blur-xl border border-border/60 rounded-3xl shadow-2xl overflow-hidden">
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 bg-muted-foreground/20 rounded-full" />
                </div>

                <div className="py-1">
                  {actions.map((action, index) => (
                    <React.Fragment key={action.id}>
                      {/* Separator before Delete */}
                      {action.isDestructive && index > 0 && (
                        <div className="mx-4 h-px bg-border/50 my-1" />
                      )}
                      <ActionButton action={action} />
                    </React.Fragment>
                  ))}
                </div>

                {/* Bottom safe area padding */}
                <div className="h-2" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirmation dialog — rendered via portal at root level to avoid z-index clipping */}
      {typeof document !== 'undefined' && ReactDOM.createPortal(
        <AnimatePresence>
          {isOpen && showDeleteDialog && (
            <DeleteConfirmDialog
              isMe={message.isMe}
              canDeleteForEveryone={message.isMe || canDeleteForEveryone}
              otherPersonName={otherPersonName}
              isGroup={isGroup}
              onCancel={() => setShowDeleteDialog(false)}
              onDeleteForMe={() => {
                setShowDeleteDialog(false);
                onDelete(false);
                onClose();
              }}
              onDeleteForEveryone={() => {
                setShowDeleteDialog(false);
                onDelete(true);
                onClose();
              }}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

// ── Individual action row ────────────────────────────────────────────────────
const ActionButton = ({ action }: { action: ActionItem }) => {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors duration-150 relative overflow-hidden select-none active:scale-[0.98]',
        action.isDestructive
          ? 'text-destructive hover:bg-destructive/8 active:bg-destructive/15'
          : 'text-foreground hover:bg-secondary/60 active:bg-secondary'
      )}
      onClick={action.onClick}
    >
      {/* Icon */}
      <span className={cn(
        'shrink-0',
        action.isDestructive ? 'text-destructive' : 'text-foreground/70'
      )}>
        {action.icon}
      </span>

      {/* Label */}
      <span className={cn(
        'text-[15px] font-medium tracking-tight',
        action.isDestructive ? 'text-destructive' : 'text-foreground'
      )}>
        {action.label}
      </span>
    </button>
  );
};

// ── Telegram Android-style delete confirmation dialog ───────────────────────
interface DeleteConfirmDialogProps {
  isMe: boolean;
  canDeleteForEveryone: boolean;
  otherPersonName?: string;
  isGroup?: boolean;
  onCancel: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isMe,
  canDeleteForEveryone,
  otherPersonName,
  isGroup = false,
  onCancel,
  onDeleteForMe,
  onDeleteForEveryone,
}) => {
  // Default: checked (delete for everyone) if user can do so
  const [alsoDeleteForOther, setAlsoDeleteForOther] = useState(canDeleteForEveryone);

  const checkboxLabel = isGroup
    ? 'Also delete for everyone'
    : otherPersonName
      ? `Also delete for ${otherPersonName}`
      : 'Also delete for everyone';

  const handleDelete = () => {
    if (alsoDeleteForOther && canDeleteForEveryone) {
      onDeleteForEveryone();
    } else {
      onDeleteForMe();
    }
  };

  return (
    <motion.div
      key="delete-dialog"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-center justify-center px-6"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Scrim */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/55"
        onClick={onCancel}
      />

      {/* Card */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 380 }}
        className="relative z-10 bg-background rounded-2xl shadow-2xl w-full max-w-[320px] overflow-hidden"
      >
        {/* Title + body */}
        <div className="px-6 pt-6 pb-5">
          <h3 className="text-[18px] font-bold text-foreground mb-2">
            Delete message
          </h3>
          <p className="text-[14px] text-muted-foreground leading-relaxed">
            Are you sure you want to delete this message?
          </p>

          {/* Checkbox row — only for own messages that can be deleted for others */}
          {canDeleteForEveryone && (
            <button
              className="mt-5 flex items-center gap-3 w-full text-left select-none active:opacity-70 transition-opacity"
              onClick={() => setAlsoDeleteForOther(v => !v)}
            >
              {/* Animated checkbox */}
              <motion.div
                animate={{
                  backgroundColor: alsoDeleteForOther
                    ? 'hsl(var(--primary))'
                    : 'transparent',
                  borderColor: alsoDeleteForOther
                    ? 'hsl(var(--primary))'
                    : 'hsl(var(--border))',
                }}
                transition={{ duration: 0.13 }}
                className="h-[22px] w-[22px] shrink-0 rounded-[5px] border-2 flex items-center justify-center"
              >
                <AnimatePresence>
                  {alsoDeleteForOther && (
                    <motion.svg
                      key="check"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      viewBox="0 0 12 10"
                      className="w-[13px] h-[11px]"
                      fill="none"
                    >
                      <path
                        d="M1 5l3.5 3.5L11 1"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </motion.svg>
                  )}
                </AnimatePresence>
              </motion.div>
              <span className="text-[15px] text-foreground">
                {checkboxLabel}
              </span>
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50" />

        {/* Cancel | Delete buttons */}
        <div className="flex">
          <button
            className="flex-1 py-[15px] text-[16px] font-semibold text-foreground hover:bg-secondary/50 active:bg-secondary transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <div className="w-px bg-border/50" />
          <button
            className="flex-1 py-[15px] text-[16px] font-bold text-destructive hover:bg-destructive/8 active:bg-destructive/15 transition-colors"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
