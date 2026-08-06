'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import { NativeBridge } from '@/lib/utils/native-bridge';

interface WebRTCOptions {
  userId: string;
  onIncomingCall?: (data: { from: string; profile: any; type: 'VOICE' | 'VIDEO' }) => void;
  onCallAccepted?: (userId: string) => void;
  onCallRejected?: (userId: string) => void;
  onCallEnded?: (userId: string) => void;
  onRemoteStream?: (userId: string, stream: MediaStream) => void;
  isAppActive?: () => boolean;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Open-relay TURN servers for NAT traversal (free tier, replace with paid for production)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

/** Returns a human-readable reason for getUserMedia errors. */
function describeMediaError(err: unknown): string {
  if (!(err instanceof Error)) return 'Could not access camera or microphone.';
  switch (err.name) {
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Camera or microphone is already in use by another app. Close it and try again.';
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera/microphone permission was denied. Please allow access in your browser settings.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera or microphone was found on this device.';
    case 'OverconstrainedError':
      return 'The requested media settings are not supported by your device.';
    default:
      return err.message || 'Could not access camera or microphone.';
  }
}

/**
 * Acquires a fresh MediaStream with the requested constraints.
 * Stops any tracks on an existing stream first so the OS releases
 * the device before we try to re-open it (prevents NotReadableError).
 */
async function acquireStream(
  existing: MediaStream | null,
  constraints: MediaStreamConstraints,
): Promise<MediaStream> {
  if (existing) {
    existing.getTracks().forEach((t) => t.stop());
  }
  return navigator.mediaDevices.getUserMedia(constraints);
}

export type CallStatus =
  | 'IDLE'
  | 'RINGING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'DECLINED'
  | 'MISSED'
  | 'CANCELLED'
  | 'FAILED'
  | 'BUSY';

export interface CallStats {
  audioBitrate: number;      // in kbps
  videoBitrate: number;      // in kbps
  packetLoss: number;        // in %
  rtt: number;               // in ms
  jitter: number;            // in ms
  quality: 'EXCELLENT' | 'GOOD' | 'POOR' | 'BAD';
  resolution?: string;       // e.g. "1280x720"
  frameRate?: number;        // e.g. 30
}

/** HD Audio constraints tailored for Opus voice with advanced browser Acoustic Echo Cancellation (AEC/NS/AGC) */
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  // Advanced Chromium / WebKit AEC constraints to eliminate speaker feedback loop
  googEchoCancellation: true,
  googAutoGainControl: true,
  googNoiseSuppression: true,
  googHighpassFilter: true,
  googAudioMirroring: false,
} as any;

/** Adaptive HD Video constraints (720p 30fps default) */
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1920, min: 480 },
  height: { ideal: 720, max: 1080, min: 360 },
  frameRate: { ideal: 30, max: 30, min: 15 },
  facingMode: 'user',
};

/**
 * Optimizes WebRTC SDP offer/answer for Opus voice FEC + 64kbps HD voice
 * and VP8/H.264 video codec priority (Telegram-style SDP munging).
 */
function optimizeSDP(sdp: string, isVideo: boolean): string {
  let modified = sdp;

  // 1. Opus Audio Optimization
  // minptime=10 (10ms low latency frames), useinbandfec=1 (In-Band Forward Error Correction for packet loss recovery),
  // usedtx=1 (discontinuous transmission during silence), maxaveragebitrate=64000 (64kbps HD voice prevents speaker clipping feedback).
  if (modified.includes('opus/48000')) {
    modified = modified.replace(
      /(a=fmtp:\d+ .*opus\/48000.*)/g,
      '$1;useinbandfec=1;usedtx=1;minptime=10;maxaveragebitrate=64000;stereo=0;sprop-stereo=0;sprop-maxcapturerate=48000'
    );
    if (!modified.includes('maxaveragebitrate=')) {
      modified = modified.replace(
        /(a=rtpmap:(\d+) opus\/48000\/2)/g,
        '$1\r\na=fmtp:$2 minptime=10;useinbandfec=1;usedtx=1;maxaveragebitrate=64000;stereo=0;sprop-stereo=0;sprop-maxcapturerate=48000'
      );
    }
  }

  // 2. Video Codec Prioritization (Prefer VP8 or H264 for mobile efficiency)
  if (isVideo && modified.includes('m=video')) {
    // Prefer VP8 payload if present
    const vp8Match = modified.match(/a=rtpmap:(\d+) VP8\/90000/);
    if (vp8Match) {
      const payload = vp8Match[1];
      modified = modified.replace(
        /(m=video \d+ [A-Z\/]+)(.*)/,
        (match, mLine, pList) => {
          const reordered = [payload, ...pList.split(' ').filter((p: string) => p && p !== payload)].join(' ');
          return `${mLine} ${reordered}`;
        }
      );
    }
  }

  return modified;
}

export const useWebRTC = (options: WebRTCOptions) => {
  const { socket } = useSocket();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteMediaStates, setRemoteMediaStates] = useState<Record<string, { isCameraOff: boolean; isMuted: boolean }>>({});
  const [callStatus, setCallStatus] = useState<CallStatus>('IDLE');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'GOOD' | 'POOR' | 'BAD'>('GOOD');
  const [callStats, setCallStats] = useState<CallStats>({
    audioBitrate: 0,
    videoBitrate: 0,
    packetLoss: 0,
    rtt: 0,
    jitter: 0,
    quality: 'EXCELLENT',
  });
  const [callDuration, setCallDuration] = useState(0);
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const callType = useRef<'VOICE' | 'VIDEO'>('VOICE');
  const callIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const iceRestartTimer = useRef<NodeJS.Timeout | null>(null);
  const seenCallIdsRef = useRef<Set<string>>(new Set());
  const answerTimeRef = useRef<number | null>(null);  // unix ms when call was answered
  const schoolIdRef = useRef<string | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep a ref to localStream so acquireStream always sees the latest value
  const localStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // Keep refs of media settings to prevent stale closures in async callbacks
  const isCameraOffRef = useRef(isCameraOff);
  const isMutedRef = useRef(isMuted);
  useEffect(() => { isCameraOffRef.current = isCameraOff; }, [isCameraOff]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // Queues
  const queuedCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const connectedAt = useRef<number | null>(null);
  const isInitiator = useRef<boolean>(false);

  const cleanupUser = useCallback((userId: string) => {
    const pc = peerConnections.current.get(userId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(userId);
    }
    queuedCandidates.current.delete(userId);
    setRemoteStreams(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    setRemoteMediaStates(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  const cleanupAll = useCallback(() => {
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    queuedCandidates.current.clear();
    const activeStream = localStreamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (iceRestartTimer.current) {
      clearTimeout(iceRestartTimer.current);
      iceRestartTimer.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    setRemoteStreams({});
    setRemoteMediaStates({});
    setCallStatus('IDLE');
    setConnectionQuality('GOOD');
    setCallDuration(0);
    setIsSpeakerOn(false);
    connectedAt.current = null;
    answerTimeRef.current = null;
    isInitiator.current = false;
    callIdRef.current = null;
    conversationIdRef.current = null;

    if (NativeBridge.isNative()) {
      NativeBridge.setAudioModeNormal().catch(() => {});
    }
  }, []);

  const initiateIceRestart = useCallback(async (targetUserId: string) => {
    const pc = peerConnections.current.get(targetUserId);
    if (!pc) return;
    try {
      console.log(`[WebRTC] Initiating ICE restart for user ${targetUserId}...`);
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      if (socket) {
        socket.emit('ice_restart', {
          to: targetUserId,
          from: options.userId,
          offer,
        });
      }
    } catch (err) {
      console.error('[WebRTC] ICE restart offer creation failed:', err);
    }
  }, [socket, options.userId]);

  const transitionToConnected = useCallback(() => {
    if (!connectedAt.current) {
      console.log('[WebRTC] ⚡ Transitioning call status to CONNECTED (media flowing or ICE candidates connected)');
      setCallStatus('CONNECTED');
      connectedAt.current = Date.now();
      answerTimeRef.current = answerTimeRef.current || Date.now();

      // Start live duration counter
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      const startMs = Date.now();
      durationTimerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startMs) / 1000));
      }, 1000);

      // Switch audio to in-call mode on native (earpiece for voice calls, speaker for video calls unless toggled)
      if (NativeBridge.isNative()) {
        const useSpeaker = callType.current === 'VIDEO' || isSpeakerOn;
        NativeBridge.setAudioModeInCall(useSpeaker).catch(() => {});
      }
    }
  }, []);

  const createPeerConnection = useCallback((userId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice_candidate', { to: userId, from: options.userId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      const stream = event.streams[0] || new MediaStream([event.track]);
      
      setRemoteStreams(prev => {
        const existing = prev[userId];
        if (existing) {
          const hasTrack = existing.getTracks().some(t => t.id === event.track.id);
          if (hasTrack) {
            // Track is already attached — preserve existing object reference to prevent audio buffer restarts
            return prev;
          }
          existing.addTrack(event.track);
          return {
            ...prev,
            [userId]: new MediaStream(existing.getTracks())
          };
        }
        return {
          ...prev,
          [userId]: stream
        };
      });

      if (options.onRemoteStream) options.onRemoteStream(userId, stream);
      transitionToConnected();
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE Connection State for ${userId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        // Show RECONNECTING state to the user immediately
        setCallStatus('RECONNECTING');
        if (isInitiator.current && !iceRestartTimer.current) {
          console.warn(`[WebRTC] ICE state ${pc.iceConnectionState}. Triggering ICE restart...`);
          initiateIceRestart(userId);
          iceRestartTimer.current = setTimeout(() => {
            console.error('[WebRTC] ICE restart timed out after 10s. Call FAILED.');
            setCallStatus('FAILED');
            setTimeout(() => {
              cleanupUser(userId);
              cleanupAll();
              if (options.onCallEnded) options.onCallEnded(userId);
            }, 2000);
          }, 10000);
        } else if (!isInitiator.current && !iceRestartTimer.current) {
          // Receiver: wait 10s for initiator to trigger ICE restart offer
          iceRestartTimer.current = setTimeout(() => {
            console.error('[WebRTC] Initiator did not trigger ICE restart. Call FAILED.');
            setCallStatus('FAILED');
            setTimeout(() => {
              cleanupUser(userId);
              cleanupAll();
              if (options.onCallEnded) options.onCallEnded(userId);
            }, 2000);
          }, 10000);
        }
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        if (iceRestartTimer.current) {
          console.log('[WebRTC] ICE connection restored. Clearing restart timer.');
          clearTimeout(iceRestartTimer.current);
          iceRestartTimer.current = null;
        }
        transitionToConnected();
      } else if (pc.iceConnectionState === 'closed') {
        cleanupUser(userId);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection State for ${userId}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        transitionToConnected();
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[WebRTC] ICE Gathering State for ${userId}: ${pc.iceGatheringState}`);
    };

    peerConnections.current.set(userId, pc);
    return pc;
  }, [socket, options, cleanupUser, cleanupAll, initiateIceRestart, transitionToConnected]);

  const startCall = useCallback(async (toId: string, type: 'VOICE' | 'VIDEO', profile: any, schoolId?: string) => {
    setCallStatus('CONNECTING');
    setMediaError(null);
    callType.current = type;
    isInitiator.current = true;
    if (schoolId) schoolIdRef.current = schoolId;
    const generatedCallId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    callIdRef.current = generatedCallId;
    conversationIdRef.current = (window as any).activeConversationId;
    try {
      if (NativeBridge.isNative()) {
        await NativeBridge.requestPermissions();
      }
      // acquireStream stops stale tracks first — prevents NotReadableError
      const stream = await acquireStream(localStreamRef.current, {
        audio: AUDIO_CONSTRAINTS,
        video: type === 'VIDEO' ? VIDEO_CONSTRAINTS : false,
      });
      setLocalStream(stream);

      const pc = createPeerConnection(toId);
      stream.getTracks().forEach(track => {
        const sender = pc.addTrack(track, stream);
        if (track.kind === 'video' && sender) {
          try {
            const params = sender.getParameters() as RTCRtpSendParameters & { degradationPreference?: RTCDegradationPreference };
            if (!params.encodings) params.encodings = [{}];
            params.degradationPreference = 'maintain-framerate';
            sender.setParameters(params).catch(() => {});
          } catch (e) {}
        }
      });

      const rawOffer = await pc.createOffer();
      const optimizedOffer = new RTCSessionDescription({
        type: rawOffer.type,
        sdp: optimizeSDP(rawOffer.sdp || '', type === 'VIDEO'),
      });
      await pc.setLocalDescription(optimizedOffer);

      if (socket) {
        socket.emit('call_user', {
          to: toId,
          offer: optimizedOffer,
          from: options.userId,
          profile,
          type,
          callId: generatedCallId,
          conversationId: conversationIdRef.current,
          schoolId: schoolIdRef.current,
        });
      }
    } catch (error) {
      console.error('Error starting call:', error);
      setMediaError(describeMediaError(error));
      cleanupAll();
    }
  }, [options.userId, socket, createPeerConnection, cleanupAll]);

  const answerCall = useCallback(async (fromId: string, offer: any, type: 'VOICE' | 'VIDEO', callId?: string, conversationId?: string) => {
    console.log(`[WebRTC] AnswerCall START — from=${fromId} type=${type} callId=${callId} hasOffer=${!!offer}`);

    if (!offer) {
      console.error('[WebRTC] answerCall called with no SDP offer! Aborting to prevent invalid state.');
      return;
    }

    setCallStatus('CONNECTING');
    setMediaError(null);
    callType.current = type;
    isInitiator.current = false;
    if (callId) callIdRef.current = callId;
    if (conversationId) conversationIdRef.current = conversationId;

    try {
      if (NativeBridge.isNative()) {
        console.log('[WebRTC] Requesting camera/mic permissions...');
        await NativeBridge.requestPermissions();
        console.log('[WebRTC] Permissions granted');
      }

      console.log('[WebRTC] Acquiring local media stream...');
      // acquireStream stops stale tracks first — prevents NotReadableError
      const stream = await acquireStream(localStreamRef.current, {
        audio: AUDIO_CONSTRAINTS,
        video: type === 'VIDEO' ? VIDEO_CONSTRAINTS : false,
      });
      console.log('[WebRTC] ✅ Local media stream acquired. tracks:', stream.getTracks().map(t => t.kind));
      setLocalStream(stream);

      console.log('[WebRTC] Creating RTCPeerConnection for', fromId);
      const pc = createPeerConnection(fromId);
      stream.getTracks().forEach(track => {
        const sender = pc.addTrack(track, stream);
        if (track.kind === 'video' && sender) {
          try {
            const params = sender.getParameters() as RTCRtpSendParameters & { degradationPreference?: RTCDegradationPreference };
            if (!params.encodings) params.encodings = [{}];
            params.degradationPreference = 'maintain-framerate';
            sender.setParameters(params).catch(() => {});
          } catch (e) {}
        }
        console.log('[WebRTC] → Added local track:', track.kind);
      });

      console.log('[WebRTC] Setting remote description (offer)...');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[WebRTC] ✅ Remote description set');

      // Drain queued ICE candidates that arrived before remote description was set
      const queue = queuedCandidates.current.get(fromId) || [];
      if (queue.length > 0) {
        console.log(`[WebRTC] Draining ${queue.length} queued ICE candidates`);
        for (const candidate of queue) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('[WebRTC] Error adding queued candidate:', e);
          }
        }
      }
      queuedCandidates.current.delete(fromId);

      console.log('[WebRTC] Creating SDP answer...');
      const rawAnswer = await pc.createAnswer();
      const optimizedAnswer = new RTCSessionDescription({
        type: rawAnswer.type,
        sdp: optimizeSDP(rawAnswer.sdp || '', type === 'VIDEO'),
      });
      console.log('[WebRTC] ✅ SDP answer created & optimized');

      console.log('[WebRTC] Setting local description (answer)...');
      await pc.setLocalDescription(optimizedAnswer);
      console.log('[WebRTC] ✅ Local description set');

      if (socket) {
        console.log('[WebRTC] Emitting answer_call to signaling server for callId=', callIdRef.current);
        socket.emit('answer_call', { to: fromId, from: options.userId, answer: optimizedAnswer, callId: callIdRef.current });

        // Emit media state immediately on connection
        socket.emit('media_state_change', {
          to: fromId,
          from: options.userId,
          isCameraOff: isCameraOffRef.current,
          isMuted: isMutedRef.current,
        });
        console.log('[WebRTC] ✅ answer_call emitted. Waiting for ICE to connect...');
      } else {
        console.error('[WebRTC] CRITICAL: socket is null at time of answer_call emission!');
      }

      // Wait for ICE/ontrack/connectionState to transition to CONNECTED natively.
      // We set a safety fallback timer of 4 seconds just in case WebRTC events get delayed.
      const currentCallId = callIdRef.current;
      setTimeout(() => {
        if (!connectedAt.current && callIdRef.current === currentCallId) {
          console.log('[WebRTC] Safety connected fallback triggered in answerCall');
          transitionToConnected();
        }
      }, 4000);
      console.log('[WebRTC] Waiting for ICE connection to establish...');
    } catch (error) {
      console.error('[WebRTC] Error answering call:', error);
      setMediaError(describeMediaError(error));
      cleanupAll();
    }
  }, [socket, options.userId, createPeerConnection, cleanupAll]);


  const endCall = useCallback(() => {
    let duration = 0;
    if (connectedAt.current) {
      duration = Math.floor((Date.now() - connectedAt.current) / 1000);
    }

    const reason = !connectedAt.current ? (isInitiator.current ? 'CANCELLED' : 'MISSED') : 'ENDED';

    peerConnections.current.forEach((_, userId) => {
      if (socket) socket.emit('end_call', { 
        to: userId, 
        from: options.userId,
        type: callType.current,
        callId: callIdRef.current,
        conversationId: conversationIdRef.current || (window as any).activeConversationId,
        schoolId: schoolIdRef.current,
        duration,
        answerTime: answerTimeRef.current,
        reason,
        networkQuality: connectionQuality,
      });
    });

    // Restore normal audio mode
    if (NativeBridge.isNative()) {
      NativeBridge.setAudioModeNormal().catch(() => {});
    }

    cleanupAll();
  }, [socket, options.userId, cleanupAll, connectionQuality]);

  // Emitted by the RECEIVER to notify the caller they were declined
  const rejectCall = useCallback((callerId: string, timeoutMissed: boolean = false, optionalCallId?: string) => {
    const targetCallId = optionalCallId || callIdRef.current;
    if (socket) {
      socket.emit('reject_call', {
        to: callerId,
        from: options.userId,
        type: callType.current,
        callId: targetCallId,
        conversationId: conversationIdRef.current || (window as any).activeConversationId,
        reason: timeoutMissed ? 'MISSED' : 'DECLINED'
      });
    }
    cleanupAll();
  }, [socket, options.userId, cleanupAll]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        const nextState = !audioTrack.enabled;
        audioTrack.enabled = nextState;
        setIsMuted(!nextState);

        // Notify active connections
        peerConnections.current.forEach((_, userId) => {
          if (socket) {
            socket.emit('media_state_change', {
              to: userId,
              from: options.userId,
              isCameraOff: isCameraOffRef.current,
              isMuted: !nextState,
            });
          }
        });
      }
    }
  }, [localStream, socket, options.userId]);

  const toggleSpeaker = useCallback(async () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    if (NativeBridge.isNative()) {
      try {
        await NativeBridge.setSpeakerphone(next);
      } catch (e) {
        console.warn('[WebRTC] toggleSpeaker native bridge error:', e);
      }
    } else {
      // Web: switch audio output if the browser supports it
      try {
        const audioEl = document.querySelector<HTMLAudioElement>('audio[data-remote-audio]');
        if (audioEl && 'setSinkId' in audioEl) {
          // If speaker is on use default (speaker), otherwise try to use earpiece
          // setSinkId('') restores to system default (usually speaker)
          await (audioEl as any).setSinkId(next ? '' : 'communications');
        }
      } catch (e) {
        // setSinkId not supported or no communications device; ignore
      }
    }
  }, [isSpeakerOn]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        const nextState = !videoTrack.enabled;
        videoTrack.enabled = nextState;
        setIsCameraOff(!nextState);

        // Notify active connections
        peerConnections.current.forEach((_, userId) => {
          if (socket) {
            socket.emit('media_state_change', {
              to: userId,
              from: options.userId,
              isCameraOff: !nextState,
              isMuted: isMutedRef.current,
            });
          }
        });
      }
    }
  }, [localStream, socket, options.userId]);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const flipCamera = useCallback(async () => {
    // Both caller AND callee can flip — check if there's an active local stream with a video track
    const currentStream = localStreamRef.current;
    if (!currentStream) {
      console.warn('[WebRTC] flipCamera: no local stream');
      return;
    }
    const hasVideoTrack = currentStream.getVideoTracks().length > 0;
    if (!hasVideoTrack) {
      console.warn('[WebRTC] flipCamera: no video track in local stream (voice call?)');
      return;
    }

    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    console.log('[WebRTC] flipCamera: switching to facingMode =', newFacingMode);

    try {
      // Stop ONLY the current video track — keep existing audio track alive to
      // avoid interrupting the active WebRTC audio sender during camera switch.
      currentStream.getVideoTracks().forEach(t => t.stop());

      // Request only a fresh video track using ideal (non-strict) facingMode
      // to prevent OverconstrainedError on single/multi-camera web and Android WebView.
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: newFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false, // audio track stays alive — do NOT re-acquire
      });

      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      if (!newVideoTrack) {
        console.error('[WebRTC] flipCamera: no video track from getUserMedia');
        return;
      }

      // Apply current camera-off state
      if (isCameraOffRef.current) {
        newVideoTrack.enabled = false;
      }

      // Build updated local stream: existing audio track + new video track
      const audioTracks = currentStream.getAudioTracks();
      const updatedStream = new MediaStream([...audioTracks, newVideoTrack]);
      setLocalStream(updatedStream);

      // Replace ONLY the video sender on all active peer connections
      peerConnections.current.forEach((pc) => {
        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack).catch(e =>
            console.error('[WebRTC] flipCamera replaceTrack error:', e)
          );
        }
      });

      console.log('[WebRTC] ✅ Camera flipped to', newFacingMode);
    } catch (err) {
      console.error('[WebRTC] flipCamera error:', err);
      if (err instanceof Error) {
        setMediaError(describeMediaError(err));
      }
    }
  }, [facingMode]);

  useEffect(() => {
    if (!socket) return;

    socket.on('incoming_call', (data) => {
      console.log('[WebRTC] ✅ incoming_call received. callId:', data.callId, '| from:', data.from, '| hasOffer:', !!data.offer);
      
      const appActive = options.isAppActive ? options.isAppActive() : true;
      if (!appActive) {
        console.log('[WebRTC] App is in background/inactive. Ignoring socket incoming_call.');
        return;
      }

      if (data.callId) {
        if (seenCallIdsRef.current.has(data.callId)) {
          console.log('[WebRTC] Duplicate callId ignored in socket incoming_call. callId:', data.callId);
          return;
        }
        seenCallIdsRef.current.add(data.callId);
        if (seenCallIdsRef.current.size > 50) {
          const first = Array.from(seenCallIdsRef.current)[0];
          seenCallIdsRef.current.delete(first);
        }
      }

      // Store callId in ref so we can match it against pending ANSWER intents
      if (data.callId) callIdRef.current = data.callId;
      // ── CRITICAL for callee camera flip: sync callType ref so flipCamera()
      // does not bail out early with callType.current !== 'VIDEO' on the receiver side.
      if (data.type) callType.current = data.type;
      if (options.onIncomingCall) options.onIncomingCall(data);
      setCallStatus('RINGING');
      socket.emit('call_ringing', { to: data.from, from: options.userId });
      console.log('[WebRTC] call_ringing emitted to', data.from);
    });

    const handleRinging = ({ from }: any) => {
      console.log('Call is ringing on remote device:', from);
      setCallStatus('RINGING');
    };

    // Redefining signaling events for multi-peer
    const handleAnswer = async ({ from, answer }: any) => {
      const pc = peerConnections.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        // Drain queued ICE candidates
        const queue = queuedCandidates.current.get(from) || [];
        for (const candidate of queue) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Error adding queued candidate:', e);
          }
        }
        queuedCandidates.current.delete(from);

        // Wait for ICE/ontrack/connectionState to transition to CONNECTED natively.
        // We set a safety fallback timer of 4 seconds just in case WebRTC events get delayed.
        const currentCallId = callIdRef.current;
        setTimeout(() => {
          if (!connectedAt.current && callIdRef.current === currentCallId) {
            console.log('[WebRTC] Safety connected fallback triggered in handleAnswer');
            transitionToConnected();
          }
        }, 4000);
        if (options.onCallAccepted) options.onCallAccepted(from);

        // Emit media state immediately on connection
        if (socket) {
          socket.emit('media_state_change', {
            to: from,
            from: options.userId,
            isCameraOff: isCameraOffRef.current,
            isMuted: isMutedRef.current,
          });
        }
      }
    };

    const handleIceCandidate = async ({ from, candidate }: any) => {
      const pc = peerConnections.current.get(from);
      if (pc) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Error adding ice candidate', e);
          }
        } else {
          if (!queuedCandidates.current.has(from)) {
            queuedCandidates.current.set(from, []);
          }
          queuedCandidates.current.get(from)!.push(candidate);
        }
      }
    };

    const handleMediaStateChanged = ({ from, isCameraOff: remoteCameraOff, isMuted: remoteMuted }: any) => {
      console.log('Remote media state changed:', from, { remoteCameraOff, remoteMuted });
      setRemoteMediaStates(prev => ({
        ...prev,
        [from]: { isCameraOff: remoteCameraOff, isMuted: remoteMuted }
      }));
    };

    const handleIceRestart = async ({ from, offer }: any) => {
      const pc = peerConnections.current.get(from);
      if (pc) {
        console.log(`[WebRTC] Received ICE restart offer from ${from}`);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (socket) {
            socket.emit('ice_restart_answer', {
              to: from,
              from: options.userId,
              answer,
            });
          }
        } catch (err) {
          console.error('[WebRTC] Failed to handle ICE restart offer:', err);
        }
      }
    };

    const handleIceRestartAnswer = async ({ from, answer }: any) => {
      const pc = peerConnections.current.get(from);
      if (pc) {
        console.log(`[WebRTC] Received ICE restart answer from ${from}`);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('[WebRTC] Failed to set ICE restart answer:', err);
        }
      }
    };

    socket.on('call_ringing', handleRinging);
    socket.on('call_answered', handleAnswer);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('media_state_changed', handleMediaStateChanged);
    socket.on('ice_restart', handleIceRestart);
    socket.on('ice_restart_answer', handleIceRestartAnswer);
    
    socket.on('call_ended', ({ from }: any) => {
      cleanupUser(from);
      if (peerConnections.current.size === 0) {
        cleanupAll();
        if (options.onCallEnded) options.onCallEnded(from);
      }
    });

    socket.on('call_rejected', ({ from }: any) => {
      // The callee rejected — show DECLINED briefly then clean up
      setCallStatus('DECLINED');
      setTimeout(() => {
        if (options.onCallRejected) options.onCallRejected(from);
        cleanupUser(from);
        cleanupAll();
      }, 2500);
    });

    socket.on('call_busy', ({ from }: any) => {
      // The callee is already on another call
      console.log('[WebRTC] call_busy received from', from);
      setCallStatus('BUSY');
      setTimeout(() => {
        cleanupAll();
      }, 2500);
    });

    socket.on('call_missed', ({ callId: _callId }: any) => {
      // Server timed out this call (no answer)
      console.log('[WebRTC] call_missed received, callId:', _callId);
      setCallStatus('MISSED');
      setTimeout(() => {
        cleanupAll();
      }, 2500);
    });

    socket.on('call_blocked', ({ message }: any) => {
      // Server rejected the call (e.g. school suspended)
      setMediaError(message || 'Call is not allowed at this time.');
      cleanupAll();
    });

    return () => {
      socket.off('incoming_call');
      socket.off('call_ringing', handleRinging);
      socket.off('call_answered', handleAnswer);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('media_state_changed', handleMediaStateChanged);
      socket.off('ice_restart', handleIceRestart);
      socket.off('ice_restart_answer', handleIceRestartAnswer);
      socket.off('call_ended');
      socket.off('call_rejected');
      socket.off('call_busy');
      socket.off('call_missed');
      socket.off('call_blocked');
    };
  }, [socket, options, cleanupUser, cleanupAll]);

  // Monitor connection quality & dynamic bitrate adaptation
  const prevStatsRef = useRef<{ bytesReceived: number; bytesSent: number; timestamp: number }>({
    bytesReceived: 0,
    bytesSent: 0,
    timestamp: Date.now(),
  });

  useEffect(() => {
    if (callStatus !== 'CONNECTED') {
      setConnectionQuality('GOOD');
      setCallStats({
        audioBitrate: 0,
        videoBitrate: 0,
        packetLoss: 0,
        rtt: 0,
        jitter: 0,
        quality: 'EXCELLENT',
      });
      return;
    }

    const interval = setInterval(async () => {
      peerConnections.current.forEach(async (pc, userId) => {
        try {
          const stats = await pc.getStats();
          let currentRtt = 0;
          let totalPacketsLost = 0;
          let totalPacketsReceived = 0;
          let totalAudioBytes = 0;
          let totalVideoBytes = 0;
          let currentJitter = 0;
          let frameWidth = 0;
          let frameHeight = 0;
          let framesPerSec = 0;

          const now = Date.now();
          const timeDiffSec = (now - prevStatsRef.current.timestamp) / 1000;

          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              currentRtt = Math.round((report.currentRoundTripTime || 0) * 1000); // ms
            }
            if (report.type === 'inbound-rtp') {
              if (report.kind === 'audio') {
                totalAudioBytes += report.bytesReceived || 0;
                currentJitter = Math.round((report.jitter || 0) * 1000); // ms
              } else if (report.kind === 'video') {
                totalVideoBytes += report.bytesReceived || 0;
                frameWidth = report.frameWidth || 0;
                frameHeight = report.frameHeight || 0;
                framesPerSec = report.framesPerSecond || 0;
              }
              totalPacketsLost += report.packetsLost || 0;
              totalPacketsReceived += report.packetsReceived || 0;
            }
          });

          // Compute bitrates (kbps)
          const totalBytesReceived = totalAudioBytes + totalVideoBytes;
          const audioKbps = timeDiffSec > 0
            ? Math.round(((totalAudioBytes - (prevStatsRef.current.bytesReceived || 0)) * 8) / (timeDiffSec * 1000))
            : 0;
          const videoKbps = timeDiffSec > 0
            ? Math.max(0, Math.round(((totalVideoBytes - (prevStatsRef.current.bytesSent || 0)) * 8) / (timeDiffSec * 1000)))
            : 0;

          prevStatsRef.current = {
            bytesReceived: totalAudioBytes,
            bytesSent: totalVideoBytes,
            timestamp: now,
          };

          const totalPackets = totalPacketsReceived + totalPacketsLost;
          const packetLossPct = totalPackets > 0
            ? parseFloat(((totalPacketsLost / totalPackets) * 100).toFixed(1))
            : 0;

          // Quality rating calculation
          let qRating: 'EXCELLENT' | 'GOOD' | 'POOR' | 'BAD' = 'EXCELLENT';
          let qualityGrade: 'GOOD' | 'POOR' | 'BAD' = 'GOOD';

          if (currentRtt > 400 || packetLossPct > 15) {
            qRating = 'BAD';
            qualityGrade = 'BAD';
          } else if (currentRtt > 200 || packetLossPct > 5) {
            qRating = 'POOR';
            qualityGrade = 'POOR';
          } else if (currentRtt > 100 || packetLossPct > 2) {
            qRating = 'GOOD';
            qualityGrade = 'GOOD';
          } else {
            qRating = 'EXCELLENT';
            qualityGrade = 'GOOD';
          }

          setConnectionQuality(qualityGrade);
          setCallStats({
            audioBitrate: Math.max(16, audioKbps),
            videoBitrate: Math.max(0, videoKbps),
            packetLoss: packetLossPct,
            rtt: currentRtt,
            jitter: currentJitter,
            quality: qRating,
            resolution: frameWidth > 0 ? `${frameWidth}x${frameHeight}` : undefined,
            frameRate: framesPerSec > 0 ? framesPerSec : undefined,
          });

          // ── Dynamic Network Adaptation (Adaptive Bitrate Control) ─────────
          const videoSenders = pc.getSenders().filter(s => s.track?.kind === 'video');
          for (const sender of videoSenders) {
            try {
              const params = sender.getParameters();
              if (params.encodings && params.encodings.length > 0) {
                if (packetLossPct > 15 || currentRtt > 350) {
                  // Degrade video maxBitrate to 250 kbps under bad network
                  params.encodings[0].maxBitrate = 250000;
                  console.warn('[WebRTC Adaptation] Network degraded: capping video maxBitrate to 250kbps');
                } else if (packetLossPct < 5 && currentRtt < 150) {
                  // Restore video maxBitrate to 1.5 Mbps for 720p HD
                  params.encodings[0].maxBitrate = 1500000;
                }
                await sender.setParameters(params);
              }
            } catch (e) {}
          }
        } catch (err) {
          console.error('[WebRTC] Error getting stats:', err);
        }
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [callStatus]);

  return {
    localStream,
    remoteStreams,
    callStatus,
    callDuration,
    isMuted,
    isCameraOff,
    isSpeakerOn,
    mediaError,
    remoteMediaStates,
    connectionQuality,
    callStats,
    startCall,
    answerCall,
    endCall,
    rejectCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    flipCamera,
  };
};
