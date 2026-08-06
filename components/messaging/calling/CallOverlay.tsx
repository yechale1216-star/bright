'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneOff, Mic, MicOff, Video, VideoOff,
  Maximize2, Minimize2, Volume2, SwitchCamera,
  PhoneCall, SignalHigh, AlertTriangle, AlertCircle, CheckCircle, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils/utils';

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  stream?: MediaStream | null;
  isLocal?: boolean;
}

import { CallStats } from '@/lib/hooks/use-webrtc';

interface CallOverlayProps {
  status:
    | 'RINGING'
    | 'CONNECTING'
    | 'CONNECTED'
    | 'RECONNECTING'
    | 'DECLINED'
    | 'MISSED'
    | 'CANCELLED'
    | 'FAILED'
    | 'BUSY';
  type: 'VOICE' | 'VIDEO';
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn?: boolean;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  remoteMediaStates: Record<string, { isCameraOff: boolean; isMuted: boolean }>;
  participants: Participant[];
  caller: { name: string; avatar?: string };
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlipCamera?: () => void;
  onToggleSpeaker?: () => void;
  connectionQuality?: 'GOOD' | 'POOR' | 'BAD';
  duration?: number;
  callStats?: CallStats;
}

// ── Stable video element that attaches the stream via ref ────────────────────
const VideoStream = React.memo(
  ({ stream, isLocal = false, className }: { stream: MediaStream | null; isLocal?: boolean; className?: string }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      const el = videoRef.current;
      if (!el) return;
      if (stream) {
        el.srcObject = stream;
        el.play().catch(() => {}); // autoplay may be deferred on mobile
      } else {
        el.srcObject = null;
      }
    }, [stream]);

    if (!stream) return null;

    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline       // CRITICAL for iOS/Android
        muted={isLocal}   // avoid echo on own stream
        className={cn('w-full h-full object-cover', isLocal && 'scale-x-[-1]', className)}
      />
    );
  }
);
VideoStream.displayName = 'VideoStream';

// ── Stable audio element that attaches the stream via ref ────────────────────
const AudioStream = React.memo(({ stream }: { stream: MediaStream | null }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch((e) => console.log('[AudioStream] auto-play blocked or failed:', e));
      }
    } else if (el.srcObject) {
      el.srcObject = null;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      data-remote-audio="true"
      className="sr-only" // Hide visually without display:none so media engine keeps track active
    />
  );
});
AudioStream.displayName = 'AudioStream';

// Animated pulsing dot for "ringing" / "connecting" state
const StatusDot = () => (
  <span className="flex items-center gap-1">
    {[0, 0.2, 0.4].map((d, i) => (
      <motion.span
        key={i}
        className="h-1.5 w-1.5 rounded-full bg-green-400"
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: d }}
      />
    ))}
  </span>
);

// ── Control Button ────────────────────────────────────────────────────────────
const CtrlBtn = ({
  onClick,
  active,
  danger,
  large,
  label,
  children,
}: {
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  large?: boolean;
  label?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col items-center gap-2">
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center rounded-full shadow-lg transition-colors focus:outline-none',
        large ? 'h-[68px] w-[68px]' : 'h-[58px] w-[58px]',
        danger
          ? 'bg-red-500 hover:bg-red-600 text-white'
          : active
          ? 'bg-white text-slate-900'
          : 'bg-white/15 backdrop-blur-xl border border-white/10 text-white hover:bg-white/25'
      )}
    >
      {children}
    </motion.button>
    {label && (
      <span className="text-white/70 text-[11px] tracking-wide font-medium drop-shadow-md">
        {label}
      </span>
    )}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
export const CallOverlay: React.FC<CallOverlayProps> = ({
  status,
  type,
  isMuted,
  isCameraOff,
  isSpeakerOn = false,
  localStream,
  remoteStreams,
  remoteMediaStates,
  participants,
  caller,
  onEndCall,
  onToggleMute,
  onToggleCamera,
  onFlipCamera,
  onToggleSpeaker,
  connectionQuality = 'GOOD',
  duration = 0,
  callStats,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [dotCount, setDotCount] = useState(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let dotInterval: NodeJS.Timeout;
    if (status === 'CONNECTING' || status === 'RINGING' || status === 'RECONNECTING') {
      dotInterval = setInterval(() => {
        setDotCount((prev) => (prev + 1) % 4);
      }, 500);
    }
    return () => clearInterval(dotInterval);
  }, [status]);

  const getAnimatedStatus = (baseText: string) => {
    return baseText + '.'.repeat(dotCount);
  };

  // Auto-hide controls in video call after inactivity
  useEffect(() => {
    if (type !== 'VIDEO') return;
    const resetTimer = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 5000);
    };
    resetTimer();
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [type]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const firstRemote = participants.find(p => !p.isLocal);
  const firstRemoteStream = firstRemote ? remoteStreams[firstRemote.id] : null;
  const isRemoteCameraOff = !!(firstRemote && remoteMediaStates[firstRemote.id]?.isCameraOff);
  const hasRemoteVideo =
    firstRemoteStream &&
    firstRemoteStream.getVideoTracks().length > 0 &&
    firstRemoteStream.getVideoTracks()[0].enabled &&
    !isRemoteCameraOff;

  const initials = caller.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // ── Helper: check if we are in an end-call terminal state ───────────────────
  const isTerminalState = ['DECLINED', 'MISSED', 'CANCELLED', 'FAILED', 'BUSY'].includes(status);

  // ── Minimized bubble ─────────────────────────────────────────────────────────
  if (isMinimized) {
    return (
      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={{ left: -300, right: 300, top: -500, bottom: 500 }}
        className="fixed bottom-24 right-4 z-[110] w-44 h-60 bg-slate-900 rounded-2xl shadow-2xl overflow-hidden cursor-move border border-white/10"
      >
        {type === 'VIDEO' && firstRemoteStream ? (
          <VideoStream stream={firstRemoteStream} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 gap-3">
            <Avatar className="h-16 w-16 border-2 border-white/20">
              <AvatarImage src={caller.avatar} />
              <AvatarFallback className="bg-slate-700 text-white text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-[10px] text-white/70 text-center px-2 truncate w-full">{caller.name}</span>
            {status === 'CONNECTED' && (
              <span className="text-[10px] text-green-400 font-mono">{formatTime(duration)}</span>
            )}
          </div>
        )}
        {/* Expand button */}
        <button
          onClick={() => setIsMinimized(false)}
          className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/40 flex items-center justify-center text-white"
        >
          <Maximize2 className="h-3 w-3" />
        </button>
        {/* End call */}
        <button
          onClick={onEndCall}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 h-9 w-9 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
        >
          <PhoneOff className="h-4 w-4 text-white" />
        </button>
      </motion.div>
    );
  }

  // ── Terminal state full-screen card overlay ────────────────────────────────
  if (isTerminalState) {
    const getTerminalUI = () => {
      switch (status) {
        case 'DECLINED':
          return { icon: <PhoneOff className="h-12 w-12 text-red-400" />, label: 'Call Declined' };
        case 'MISSED':
          return { icon: <AlertCircle className="h-12 w-12 text-slate-400" />, label: 'Missed Call' };
        case 'CANCELLED':
          return { icon: <XCircle className="h-12 w-12 text-slate-400" />, label: 'Call Cancelled' };
        case 'BUSY':
          return { icon: <AlertTriangle className="h-12 w-12 text-yellow-400 animate-pulse" />, label: 'User is Busy' };
        case 'FAILED':
        default:
          return { icon: <XCircle className="h-12 w-12 text-red-500" />, label: 'Call Failed' };
      }
    };
    const { icon, label } = getTerminalUI();

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-slate-950/95 flex flex-col items-center justify-center gap-6"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="flex flex-col items-center gap-4 bg-white/5 border border-white/10 backdrop-blur-xl p-8 rounded-3xl w-72 shadow-2xl text-center"
        >
          {icon}
          <div>
            <h3 className="text-white text-xl font-bold">{label}</h3>
            <p className="text-white/40 text-xs mt-1">{caller.name}</p>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // ── Full screen ──────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex flex-col overflow-hidden select-none"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      onPointerDown={() => {
        if (type === 'VIDEO') {
          setShowControls(true);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 5000);
        }
      }}
    >
      {/* Hidden audio outputs for all remote participants who don't have an active video stream */}
      {participants.map(p => {
        if (p.isLocal) return null;
        const stream = remoteStreams[p.id];
        const isShowingVideo = type === 'VIDEO' && hasRemoteVideo && p.id === firstRemote?.id;
        if (isShowingVideo) return null;
        return <AudioStream key={p.id} stream={stream} />;
      })}

      {/* ── Reconnecting Ambient Banner ─────────────────────────────── */}
      <AnimatePresence>
        {status === 'RECONNECTING' && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-4 left-4 right-4 z-40 bg-amber-500/90 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center justify-between backdrop-blur-lg border border-amber-400/25"
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="h-5 w-5 border-2 border-white border-t-transparent rounded-full"
              />
              <div>
                <p className="text-sm font-semibold tracking-wide">Connecting...</p>
                <p className="text-[10px] text-white/70">Weak connection or switching networks</p>
              </div>
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold animate-pulse">
              Reconnecting
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Background ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0" style={{ pointerEvents: 'none' }}>
        {type === 'VIDEO' && hasRemoteVideo ? (
          <>
            <VideoStream stream={firstRemoteStream!} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70 pointer-events-none" />
          </>
        ) : type === 'VIDEO' && firstRemote && !hasRemoteVideo ? (
          <>
            {localStream && !isCameraOff ? (
              <VideoStream stream={localStream} isLocal={true} className="absolute inset-0" />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-[#1a2a3a] via-[#0f1f2e] to-[#061018]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
          </>
        ) : (
          // Voice call: deep gradient background
          <div className="w-full h-full bg-gradient-to-b from-[#1a2a3a] via-[#0f1f2e] to-[#061018]">
            {/* Ambient green glow */}
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.45, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(37,211,102,0.25) 0%, transparent 70%)' }}
            />
          </div>
        )}
      </div>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(type === 'VOICE' || showControls) && (
          <motion.div
            initial={type === 'VIDEO' ? { opacity: 0 } : {}}
            animate={{ opacity: 1 }}
            exit={type === 'VIDEO' ? { opacity: 0 } : {}}
            className="relative z-20 flex items-center justify-between px-5 pt-5 pb-2 animate-fade-in"
          >
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2 text-white active:scale-90 transition-transform drop-shadow-md"
            >
              <Minimize2 className="h-6 w-6" />
            </button>

            {/* Center: Timer & Interactive Live Stats Badge (Only shown when connected or reconnecting) */}
            {status === 'CONNECTED' || status === 'RECONNECTING' ? (
              <button
                onClick={() => setShowStatsModal(prev => !prev)}
                className="flex flex-col items-center min-w-[100px] hover:opacity-90 transition-opacity active:scale-95 cursor-pointer focus:outline-none"
              >
                <span className="text-white/40 text-[10px] uppercase tracking-[0.25em] font-semibold flex items-center gap-1.5">
                  <SignalHigh className={cn(
                    "h-3 w-3",
                    connectionQuality === 'BAD' ? "text-red-500 animate-pulse" :
                    connectionQuality === 'POOR' ? "text-yellow-400" :
                    "text-green-500"
                  )} />
                  {callStats?.quality === 'EXCELLENT' ? 'HD Crystal' :
                   connectionQuality === 'BAD' ? 'Bad Call' :
                   connectionQuality === 'POOR' ? 'Weak Signal' :
                   'HD Encrypted'}
                </span>
                <span className="text-white font-mono text-base font-bold">{formatTime(duration)}</span>
              </button>
            ) : (
              <div className="min-w-[100px]" />
            )}

            {/* Speaker icon in the top right for video mode or as toggle */}
            <button
              onClick={onToggleSpeaker}
              className={cn(
                "p-2 text-white active:scale-90 transition-transform drop-shadow-md rounded-full",
                isSpeakerOn && "bg-white/10"
              )}
            >
              <Volume2 className={cn("h-6 w-6", isSpeakerOn && "text-green-400")} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Voice Call Center ───────────────────────────────────────── */}
      {type === 'VOICE' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="relative flex items-center justify-center">
            {/* Pulse rings — green when connected, white when ringing */}
            <div className="absolute inset-0 flex items-center justify-center">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: [1, 2.8], opacity: [0.4, 0] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: [0.33, 1, 0.68, 1],
                    delay: i * 1,
                  }}
                  className={cn(
                    'absolute inset-0 rounded-full border',
                    status === 'CONNECTED'
                      ? 'border-green-500/40 bg-green-500/8'
                      : 'border-white/20 bg-white/5'
                  )}
                />
              ))}
            </div>

            <Avatar
              className={cn(
                'relative h-36 w-36 md:h-44 md:w-44 border-[3px] shadow-2xl transition-all duration-700',
                status === 'CONNECTED'
                  ? 'border-green-500 ring-[14px] ring-green-500/10'
                  : 'border-white/30 ring-[14px] ring-white/5'
              )}
            >
              <AvatarImage src={caller.avatar || (caller as any).profile_photo || (caller as any).avatar_url} className="object-cover" />
              <AvatarFallback
                className={cn(
                  'text-5xl font-black transition-colors duration-700',
                  status === 'CONNECTED' ? 'bg-green-700 text-white' : 'bg-slate-700 text-white'
                )}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="text-center">
            <h2 className="text-white text-3xl md:text-4xl font-light tracking-wide">{caller.name}</h2>
            <div className="flex items-center justify-center gap-2 mt-2">
              <p className="text-white/60 text-sm uppercase tracking-[0.2em] font-medium flex items-center gap-2">
                {status === 'CONNECTED'
                  ? 'IN CALL'
                  : status === 'RECONNECTING'
                  ? 'RECONNECTING'
                  : status === 'RINGING'
                  ? 'RINGING'
                  : 'CALLING'}
              </p>
              {status !== 'CONNECTED' && status !== 'RECONNECTING' && <StatusDot />}
            </div>
          </div>
        </div>
      )}

      {/* ── Video call: waiting for remote (show local full) ────────── */}
      {type === 'VIDEO' && firstRemote && !hasRemoteVideo && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
          <motion.div className="flex flex-col items-center gap-4">
            <Avatar className="h-28 w-28 border-3 border-white/30 shadow-2xl">
              <AvatarImage src={caller.avatar || (caller as any).profile_photo || (caller as any).avatar_url} className="object-cover" />
              <AvatarFallback className="text-4xl font-black bg-slate-700 text-white">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h1 className="text-white text-3xl font-light tracking-wide">{firstRemote.name}</h1>
              <div className="flex items-center justify-center gap-2 mt-2">
                <p className="text-white/60 text-sm uppercase tracking-[0.2em] font-medium">
                  {status === 'RINGING' ? 'RINGING' : status === 'CONNECTING' ? 'CALLING' : 'WAITING FOR VIDEO'}
                </p>
                {status !== 'CONNECTED' && <StatusDot />}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Local PIP (Video mode — remote video is playing) ────────── */}
      {type === 'VIDEO' && hasRemoteVideo && (
        <>
          <div className="relative z-20 flex-1" />
          <motion.div
            drag
            dragMomentum={false}
            className={cn(
              'fixed z-30 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-900 cursor-move',
              'w-[88px] h-[128px] sm:w-[108px] sm:h-[158px] md:w-[128px] md:h-[188px]',
              'bottom-36 right-4'
            )}
          >
            {!isCameraOff ? (
              <VideoStream stream={localStream} isLocal={true} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-850">
                <Avatar className="h-8 w-8 border border-white/10">
                  <AvatarFallback className="text-xs bg-white/10 text-white">You</AvatarFallback>
                </Avatar>
                <span className="text-[8px] text-white/40 uppercase font-bold">Cam Off</span>
              </div>
            )}
            {isMuted && (
              <div className="absolute bottom-1 right-1 bg-red-500/80 rounded-full p-0.5">
                <MicOff className="h-2 w-2 text-white" />
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* ── Technical Live Call Stats Modal / Overlay ──────────────── */}
      <AnimatePresence>
        {showStatsModal && callStats && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 border border-white/15 backdrop-blur-2xl rounded-2xl p-4 shadow-2xl w-80 text-white font-sans"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <SignalHigh className="h-4 w-4 text-green-400" />
                <span className="text-xs font-bold tracking-wider uppercase">Live Call Metrics</span>
              </div>
              <button
                onClick={() => setShowStatsModal(false)}
                className="text-white/50 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded bg-white/10"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-white/40 block text-[10px] uppercase font-semibold">Audio Bitrate</span>
                <span className="text-green-400 font-mono font-bold text-sm">{callStats.audioBitrate} kbps</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-white/40 block text-[10px] uppercase font-semibold">Video Bitrate</span>
                <span className="text-blue-400 font-mono font-bold text-sm">{callStats.videoBitrate} kbps</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-white/40 block text-[10px] uppercase font-semibold">Packet Loss</span>
                <span className={cn(
                  "font-mono font-bold text-sm",
                  callStats.packetLoss > 10 ? "text-red-400" : callStats.packetLoss > 3 ? "text-yellow-400" : "text-emerald-400"
                )}>
                  {callStats.packetLoss}%
                </span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-white/40 block text-[10px] uppercase font-semibold">Round Trip (RTT)</span>
                <span className="text-purple-300 font-mono font-bold text-sm">{callStats.rtt} ms</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg border border-white/5 col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-white/40 block text-[10px] uppercase font-semibold">Jitter / Codec</span>
                  <span className="text-white/80 font-mono text-xs">{callStats.jitter} ms (Opus HD)</span>
                </div>
                {callStats.resolution && (
                  <div className="text-right">
                    <span className="text-white/40 block text-[10px] uppercase font-semibold">Resolution</span>
                    <span className="text-green-400 font-mono text-xs font-bold">{callStats.resolution}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Controls ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(type === 'VOICE' || showControls) && (
          <motion.div
            initial={type === 'VIDEO' ? { opacity: 0, y: 20 } : {}}
            animate={{ opacity: 1, y: 0 }}
            exit={type === 'VIDEO' ? { opacity: 0, y: 20 } : {}}
            className="relative z-20 pb-10 pt-2 px-6 mt-auto"
          >
            {type === 'VIDEO' ? (
              <div className="flex items-end justify-between w-full max-w-sm mx-auto">
                <CtrlBtn onClick={onFlipCamera} label="Flip">
                  <SwitchCamera className="h-6 w-6" />
                </CtrlBtn>

                <CtrlBtn
                  onClick={onToggleCamera}
                  active={isCameraOff}
                  label={isCameraOff ? 'Video On' : 'Stop Video'}
                >
                  {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                </CtrlBtn>

                <CtrlBtn
                  onClick={onToggleMute}
                  active={isMuted}
                  label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </CtrlBtn>

                <CtrlBtn onClick={onEndCall} danger large label="End Call">
                  <PhoneOff className="h-7 w-7" />
                </CtrlBtn>
              </div>
            ) : (
              // Voice call controls — pill container
              <div className="bg-white/10 backdrop-blur-2xl rounded-full border border-white/10 shadow-2xl flex items-center justify-center gap-3 md:gap-5 px-6 md:px-8 py-3 mx-auto w-fit">
                {/* Mute */}
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={onToggleMute}
                  className={cn(
                    'h-[52px] w-[52px] md:h-14 md:w-14 rounded-full flex items-center justify-center transition-all',
                    isMuted ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/25'
                  )}
                >
                  {isMuted ? <MicOff className="h-5 w-5 md:h-6 md:w-6" /> : <Mic className="h-5 w-5 md:h-6 md:w-6" />}
                </motion.button>

                {/* Speaker */}
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={onToggleSpeaker}
                  className={cn(
                    'h-[52px] w-[52px] md:h-14 md:w-14 rounded-full flex items-center justify-center transition-all',
                    isSpeakerOn ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/25'
                  )}
                >
                  <Volume2 className={cn("h-5 w-5 md:h-6 md:w-6", isSpeakerOn && "text-green-500")} />
                </motion.button>

                {/* Divider */}
                <div className="w-px h-8 bg-white/15 mx-1" />

                {/* End Call — large red pill button */}
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={onEndCall}
                  className="h-[60px] w-[60px] md:h-[68px] md:w-[68px] rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition-all"
                >
                  <PhoneOff className="h-6 w-6 md:h-7 md:w-7 text-white" />
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
