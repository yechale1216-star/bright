'use client';

import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils/utils';

interface IncomingCallModalProps {
  isOpen: boolean;
  caller: {
    name: string;
    avatar?: string;
  };
  type: 'VOICE' | 'VIDEO';
  isConnecting?: boolean; // Show feedback if network is resolving offer
  onAccept: () => void;
  onReject: () => void;
}

// ── Native-like Pulse Rings ───────────────────────────────────────────────
const PulseRing = ({ delay }: { delay: number }) => (
  <motion.div
    className="absolute inset-0 rounded-full border border-white/20 pointer-events-none"
    initial={{ scale: 1, opacity: 0.6 }}
    animate={{ scale: 2.2, opacity: 0 }}
    transition={{
      duration: 2.4,
      repeat: Infinity,
      delay,
      ease: 'easeOut',
    }}
  />
);

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  isOpen,
  caller,
  type,
  isConnecting = false,
  onAccept,
  onReject,
}) => {
  // Vibration logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOpen) {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([1000, 500, 1000, 500, 1000]);
        interval = setInterval(() => {
          navigator.vibrate([1000, 500, 1000]);
        }, 4000);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(0);
      }
    };
  }, [isOpen]);

  const initials = caller.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="incoming-call-fullscreen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          className="fixed inset-0 z-[200] flex flex-col overflow-hidden"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* ── Gradient Background matching native activity_incoming_call ── */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-[#1a2a3a] via-[#0f1f2e] to-[#061018]" />
            {/* Soft ambient green glow in video call helper */}
            <motion.div
              animate={{
                scale: [1, 1.12, 1],
                opacity: [0.25, 0.4, 0.25],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[320px] h-[320px] rounded-full blur-[80px]"
              style={{ background: 'radial-gradient(circle, rgba(37,211,102,0.3) 0%, rgba(29,185,84,0.08) 60%, transparent 100%)' }}
            />
            <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
          </div>

          {/* ── Top Header Call Type ───────────────────────────────────── */}
          <div className="relative z-10 flex items-center justify-center pt-20 pb-4">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-2"
            >
              <span className="text-[#25D366] text-xs font-semibold tracking-[0.16em] uppercase">
                {type === 'VIDEO' ? 'INCOMING VIDEO CALL' : 'INCOMING VOICE CALL'}
              </span>
            </motion.div>
          </div>

          {/* ── Center Area: Avatar, Name, App Label ───────────────────── */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 220 }}
              className="relative flex items-center justify-center h-[144dp] w-[144dp]"
            >
              {/* Pulse rings */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {[0, 0.9, 1.8].map((delay, i) => (
                  <PulseRing key={i} delay={delay} />
                ))}
              </div>

              {/* Avatar circle */}
              <Avatar
                className={cn(
                  'relative h-32 w-32 md:h-36 md:w-36 border-[3px] shadow-2xl transition-all duration-700',
                  'border-white/20 ring-[12px] ring-white/5'
                )}
              >
                <AvatarImage src={caller.avatar || (caller as any).profile_photo || (caller as any).avatar_url || (caller as any).image || (caller as any).photo || undefined} className="object-cover" />
                <AvatarFallback
                  className="text-4xl font-bold bg-gradient-to-br from-slate-700 to-slate-900 text-white"
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
            </motion.div>

            {/* Caller Name Block */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <h1 className="text-white text-3.5xl md:text-4xl font-light tracking-wide drop-shadow-lg px-8 max-w-md">
                {caller.name}
              </h1>

              {/* Subheading Label matching native "Bright Path" */}
              <span className="text-white/50 text-[13px] tracking-widest font-normal uppercase">
                Bright Path
              </span>
            </motion.div>
          </div>

          {/* ── Bottom controls row: Decline, Msg, Accept ───────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, type: 'spring', stiffness: 180 }}
            className="relative z-10 pb-16 px-8 max-w-sm w-full mx-auto"
          >
            <div className="flex items-end justify-between w-full">

              {/* ── Decline ── */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative h-20 w-20 flex items-center justify-center">
                  <motion.div
                    className="absolute inset-0 rounded-full bg-red-500/15 pointer-events-none"
                    animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.88 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReject();
                    }}
                    className="relative z-10 h-[72px] w-[72px] rounded-full bg-red-500 hover:bg-red-600 shadow-xl flex items-center justify-center text-white focus:outline-none transition-colors border border-red-400/20 cursor-pointer"
                  >
                    <PhoneOff className="h-7 w-7 text-white" />
                  </motion.button>
                </div>
                <span className="text-white/50 text-[10px] font-semibold uppercase tracking-[0.122em] mt-1">
                  DECLINE
                </span>
              </div>

              {/* ── Message (Msg) ── */}
              <div className="flex flex-col items-center gap-2 pb-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center focus:outline-none transition-colors cursor-pointer"
                >
                  <Mail className="h-5 w-5 text-white/80" />
                </motion.button>
                <span className="text-white/40 text-[9px] font-semibold uppercase tracking-[0.122em]">
                  MSG
                </span>
              </div>

              {/* ── Accept ── */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative h-20 w-20 flex items-center justify-center">
                  <motion.div
                    className="absolute inset-0 rounded-full bg-green-500/15 pointer-events-none"
                    animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.88 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAccept();
                    }}
                    disabled={isConnecting}
                    className={cn(
                      "relative z-10 h-[72px] w-[72px] rounded-full bg-green-500 hover:bg-green-600 shadow-xl flex items-center justify-center text-white focus:outline-none transition-all border border-green-400/20 cursor-pointer",
                      isConnecting && "opacity-75 cursor-not-allowed"
                    )}
                  >
                    {isConnecting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="h-6 w-6 border-2 border-white border-t-transparent rounded-full"
                      />
                    ) : type === 'VIDEO' ? (
                      <Video className="h-7 w-7 text-white" />
                    ) : (
                      <Phone className="h-7 w-7 text-white" />
                    )}
                  </motion.button>
                </div>
                <span className="text-white/50 text-[10px] font-semibold uppercase tracking-[0.122em] mt-1">
                  {isConnecting ? 'CONNECTING...' : 'ACCEPT'}
                </span>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
