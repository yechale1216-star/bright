'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useWebRTC } from '@/lib/hooks/use-webrtc';
import { IncomingCallModal } from '@/components/messaging/calling/IncomingCallModal';
import { CallOverlay } from '@/components/messaging/calling/CallOverlay';
import { authService } from '@/lib/auth/auth';
import { useToast } from '@/hooks/use-toast';
import { NativeBridge } from '@/lib/utils/native-bridge';
import { App } from '@capacitor/app';
import { useAuth } from '@/lib/context/auth-context';
import { useSocket } from '@/components/providers/socket-provider';

interface CallContextType {
  initiateCall: (toId: string, type: 'VOICE' | 'VIDEO', profile: any) => void;
  endCall: () => void;
  status:
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
  callDuration: number;
  isSpeakerOn: boolean;
  toggleSpeaker: () => void;
  callStats?: any;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: currentUser } = useAuth();
  const { socket } = useSocket();
  const [incomingCallData, setIncomingCallData] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [callType, setCallType] = useState<'VOICE' | 'VIDEO'>('VOICE');
  const [isWaitingForOffer, setIsWaitingForOffer] = useState(false);
  const { toast } = useToast();
  const isSuspended = false; // Single-School Edition — never suspended

  const [isAppActive, setIsAppActive] = useState(true);
  const isAppActiveRef = useRef(true);
  const pendingAnswerRef = useRef<{ callId: string; callerId?: string; callerName?: string; callType?: string } | null>(null);

  // Sync ref with state
  useEffect(() => {
    isAppActiveRef.current = isAppActive;
  }, [isAppActive]);

  // ── Refs for values needed inside event-listener closures (no stale state) ─
  const incomingCallRef = useRef<any>(null);
  const isWaitingForOfferRef = useRef(false);
  // Stable ref to webrtc.endCall — avoids listing `webrtc` as a useEffect dep
  // (useWebRTC returns a new object ref on every render, which would cause
  // the logout cleanup effect to loop infinitely if webrtc were a dep).
  const webrtcEndCallRef = useRef<() => void>(() => {});

  // Keep the refs in sync with state/latest values
  useEffect(() => { incomingCallRef.current = incomingCallData; }, [incomingCallData]);
  useEffect(() => { isWaitingForOfferRef.current = isWaitingForOffer; }, [isWaitingForOffer]);

  // ── Helper to resolve avatar/profile_photo from various property names ──
  const getAvatarUrl = (profile: any): string => {
    if (!profile) return '';
    return profile.avatar || profile.profile_photo || profile.avatar_url || profile.image || profile.photo || '';
  };

  // ── onIncomingCall: socket 'incoming_call' event ─────────────────────────
  const onIncomingCall = useCallback((data: any) => {
    if (isSuspended) {
      console.log('[CallProvider] Rejecting incoming call signal — school suspended');
      return;
    }
    console.log('[CallProvider] ✅ incoming_call received. callId:', data.callId, '| offer present:', !!data.offer);

    const isAnswering = isWaitingForOfferRef.current || !!pendingAnswerRef.current;
    const incomingAvatar = getAvatarUrl(data.profile);

    if (NativeBridge.isNative() && !isAnswering) {
      console.log('[CallProvider] → Launching native CallService (HUN + IncomingCallActivity)');
      NativeBridge.startNativeRinging(
        data.profile?.name || data.profile?.full_name || 'Unknown User',
        data.callId,
        data.from,
        data.type,
        data.serverUrl || '',
        incomingAvatar
      );
    }

    setIncomingCallData(data);
    setCallType(data.type);
    setParticipants(prev => [
      ...prev.filter(p => p.isLocal),
      { id: data.from, name: data.profile?.name || data.profile?.full_name || 'Unknown', avatar: incomingAvatar }
    ]);
  }, [isSuspended]);

  const onCallAccepted = useCallback((userId: string) => {
    console.log('[CallProvider] ✅ Call accepted by remote peer:', userId);
  }, []);

  const onCallRejected = useCallback((userId: string) => {
    const name = participants.find(p => p.id === userId)?.name || 'The other person';
    toast({
      title: '📵 Call Declined',
      description: `${name} declined your call.`,
      variant: 'destructive',
    });
  }, [participants, toast]);

  const onCallEnded = useCallback((userId: string) => {
    console.log('[CallProvider] Call ended by:', userId);
    NativeBridge.dismissCallBanner();
    NativeBridge.endNativeCall();
    NativeBridge.setAudioModeNormal(); // Restore audio routing after call
    setParticipants(prev => {
      const next = prev.filter(p => p.id !== userId);
      if (next.length <= 1) setIncomingCallData(null);
      return next;
    });
  }, []);

  const webrtc = useWebRTC({
    userId: currentUser?.id || '',
    onIncomingCall,
    onCallAccepted,
    onCallRejected,
    onCallEnded,
    isAppActive: () => isAppActiveRef.current,
  });

  // Keep webrtcEndCallRef always pointing at the latest endCall implementation
  // (runs after every render — no dep array — so it is always fresh)
  useEffect(() => { webrtcEndCallRef.current = webrtc.endCall; });

  // ── Sync local participant when auth changes ──────────────────────────────
  // IMPORTANT: `webrtc` is intentionally NOT in the dep array here.
  // useWebRTC returns a new object reference on every render, so including it
  // would cause this effect to re-run → setState → re-render → new ref → loop.
  // We use webrtcEndCallRef (a stable ref) to call endCall without the dep.
  useEffect(() => {
    if (currentUser) {
      setParticipants(prev => {
        const local = { id: currentUser.id || 'local', name: 'You', avatar: currentUser.profile_photo || '', isLocal: true };
        return [local, ...prev.filter(p => !p.isLocal)];
      });
    } else {
      console.log('[CallProvider] User logged out — tearing down call state');
      setParticipants([]);
      setIncomingCallData(null);
      setIsWaitingForOffer(false);
      NativeBridge.dismissCallBanner();
      NativeBridge.endNativeCall();
      try { webrtcEndCallRef.current(); } catch (e) {}
    }
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Media-error toast ─────────────────────────────────────────────────────
  useEffect(() => {
    if (webrtc.mediaError) {
      toast({ title: 'Camera / Microphone Error', description: webrtc.mediaError, variant: 'destructive' });
    }
  }, [webrtc.mediaError, toast]);

  // ── Ringing sound / auto-dismiss ─────────────────────────────────────────
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let audioCtx: AudioContext | null = null;
    let gainNode: GainNode | null = null;
    let ringInterval: NodeJS.Timeout;
    const activeOscillators: any[] = [];

    if (webrtc.callStatus === 'RINGING') {
      const isIncoming = !!incomingCallData;
      timeout = setTimeout(() => { handleReject(true); }, 30000);

      if (!(isIncoming && NativeBridge.isNative())) {
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          audioCtx = new AudioContext();
          gainNode = audioCtx.createGain();
          gainNode.connect(audioCtx.destination);

          const playTone = () => {
            if (!audioCtx || !gainNode) return;
            if (!isIncoming) {
              const osc1 = audioCtx.createOscillator(); const osc2 = audioCtx.createOscillator();
              const ringGain = audioCtx.createGain();
              osc1.type = 'sine'; osc2.type = 'sine';
              osc1.frequency.setValueAtTime(440, audioCtx.currentTime);
              osc2.frequency.setValueAtTime(480, audioCtx.currentTime);
              osc1.connect(ringGain); osc2.connect(ringGain); ringGain.connect(gainNode!);
              const now = audioCtx.currentTime;
              ringGain.gain.setValueAtTime(0, now);
              ringGain.gain.linearRampToValueAtTime(0.08, now + 0.1);
              ringGain.gain.setValueAtTime(0.08, now + 1.5);
              ringGain.gain.linearRampToValueAtTime(0, now + 1.6);
              osc1.start(); osc2.start();
              activeOscillators.push(osc1, osc2);
              setTimeout(() => { try { osc1.stop(); osc2.stop(); osc1.disconnect(); osc2.disconnect(); ringGain.disconnect(); } catch (e) {} }, 1800);
            } else {
              const playPulse = (delay: number) => {
                if (!audioCtx || !gainNode) return;
                const o1 = audioCtx.createOscillator(); const o2 = audioCtx.createOscillator();
                const rg = audioCtx.createGain();
                o1.type = 'triangle'; o2.type = 'sine';
                o1.frequency.setValueAtTime(550, audioCtx.currentTime + delay);
                o2.frequency.setValueAtTime(750, audioCtx.currentTime + delay);
                o1.connect(rg); o2.connect(rg); rg.connect(gainNode!);
                const now = audioCtx.currentTime + delay;
                rg.gain.setValueAtTime(0, now);
                rg.gain.linearRampToValueAtTime(0.15, now + 0.05);
                rg.gain.setValueAtTime(0.15, now + 0.4);
                rg.gain.linearRampToValueAtTime(0, now + 0.45);
                o1.start(now); o2.start(now);
                activeOscillators.push(o1, o2);
                setTimeout(() => { try { o1.stop(); o2.stop(); o1.disconnect(); o2.disconnect(); rg.disconnect(); } catch (e) {} }, (delay + 0.6) * 1000);
              };
              playPulse(0); playPulse(0.6);
            }
          };
          playTone();
          ringInterval = setInterval(playTone, isIncoming ? 3200 : 4500);
        } catch (e) { console.warn('AudioContext not supported:', e); }
      }
    }

    return () => {
      clearTimeout(timeout);
      clearInterval(ringInterval);
      activeOscillators.forEach(osc => { try { osc.stop(); osc.disconnect(); } catch (e) {} });
      activeOscillators.length = 0;
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, [webrtc.callStatus, incomingCallData]);

  // ── Android audio mode: activate hardware AEC/NS when call connects ───────
  // Setting MODE_IN_COMMUNICATION enables the hardware Acoustic Echo Canceler
  // (AEC) and Noise Suppressor (NS) at the driver level — this is the primary
  // cause of echo, howling, and background noise disruption in WebRTC calls.
  // Must be restored to MODE_NORMAL when call ends so other apps work normally.
  useEffect(() => {
    if (!NativeBridge.isNative()) return;
    if (webrtc.callStatus === 'CONNECTED') {
      // Use earpiece by default for voice; video usually prefers speakerphone
      const useSpeaker = callType === 'VIDEO';
      NativeBridge.setAudioModeInCall(useSpeaker);
    } else if (webrtc.callStatus === 'IDLE') {
      NativeBridge.setAudioModeNormal();
    }
  }, [webrtc.callStatus, callType]);

  // ── handleAccept: called by the in-app modal (foreground only) ────────────
  const handleAccept = useCallback(() => {
    const current = incomingCallRef.current || incomingCallData;
    if (!current) {
      console.warn('[CallProvider] handleAccept: no incomingCallData');
      return;
    }
    NativeBridge.dismissCallBanner();
    if (!current.offer) {
      console.log('[CallProvider] handleAccept: offer not yet received — waiting for offer');
      setIsWaitingForOffer(true);
      return;
    }
    console.log('[CallProvider] handleAccept: answering immediately');
    NativeBridge.endNativeCall();
    webrtc.answerCall(current.from, current.offer, current.type, current.callId, current.conversationId);
    setIncomingCallData(null);
    setIsWaitingForOffer(false);
  }, [incomingCallData, webrtc]);

  const handleReject = useCallback((isMissed: boolean = false) => {
    const current = incomingCallRef.current || incomingCallData;
    NativeBridge.dismissCallBanner();
    NativeBridge.endNativeCall();
    NativeBridge.setAudioModeNormal(); // Ensure audio is restored on decline
    setIsWaitingForOffer(false);
    if (current) {
      webrtc.rejectCall(current.from, isMissed, current.callId);
    } else {
      webrtc.endCall();
    }
    setIncomingCallData(null);
    setParticipants(prev => prev.filter(p => p.isLocal));
  }, [incomingCallData, webrtc]);

  // ── Auto-answer when offer finally arrives while waiting ──────────────────
  useEffect(() => {
    if (incomingCallData && incomingCallData.offer && isWaitingForOffer) {
      console.log('[CallProvider] Offer arrived while waiting — answering now');
      NativeBridge.endNativeCall();
      webrtc.answerCall(
        incomingCallData.from,
        incomingCallData.offer,
        incomingCallData.type,
        incomingCallData.callId,
        incomingCallData.conversationId
      );
      setIncomingCallData(null);
      setIsWaitingForOffer(false);
    }
  }, [incomingCallData, isWaitingForOffer, webrtc]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ANSWER FLOW — complete rewrite
  //
  // When the user taps Answer from:
  //   A) The foreground CallManager banner  → onBannerAccept → JS 'ANSWER' action
  //   B) The system notification action     → BroadcastReceiver → ANSWER intent → MainActivity
  //   C) The IncomingCallActivity           → startActivity(MainActivity, callAction=ANSWER)
  //
  // In cases B and C the app may have been backgrounded/killed.  The socket
  // may not yet be authenticated, and incomingCallData may be null because
  // we never received the socket 'incoming_call' event in-process.
  //
  // Strategy:
  //   1. Store the ANSWER intent in a stable ref immediately.
  //   2. If incomingCallData is already present AND has an offer → answer right away.
  //   3. Otherwise set isWaitingForOffer=true so that when the socket
  //      'incoming_call' fires (on reconnect/resume) we auto-answer.
  //   4. If incomingCallData is present but has NO offer → wait for the updated
  //      event that carries the offer (the re-delivery on socket auth).
  // ═══════════════════════════════════════════════════════════════════════════

  // Ref that carries the pending ANSWER intent across renders/re-connects
  // Ref that carries the pending ANSWER intent across renders/re-connects

  const executePendingAnswer = useCallback(async () => {
    const pending = pendingAnswerRef.current;
    const current = incomingCallRef.current;

    if (!pending) return;

    console.log('[CallProvider] executePendingAnswer: pending=', pending, '| incomingCallData=', current ? `{callId:${current.callId}, hasOffer:${!!current.offer}}` : 'null');

    if (current && current.callId === pending.callId && current.offer) {
      // Perfect condition: data + offer both present
      console.log('[CallProvider] ✅ Executing ANSWER — all data present');
      NativeBridge.endNativeCall();
      NativeBridge.dismissCallBanner();
      pendingAnswerRef.current = null;
      // Wait for the native MediaPlayer / AudioManager to fully release audio focus
      // before getUserMedia() claims the microphone. Without this delay, Android
      // can grant the mic but deliver silence because the ringtone still holds focus.
      await new Promise(resolve => setTimeout(resolve, 300));
      webrtc.answerCall(current.from, current.offer, current.type, current.callId, current.conversationId);
      setIncomingCallData(null);
      setIsWaitingForOffer(false);
    } else if (current && current.callId === pending.callId && !current.offer) {
      // Data arrived but offer not yet included → wait
      console.log('[CallProvider] incomingCallData present but no offer yet → isWaitingForOffer=true');
      setIsWaitingForOffer(true);
    } else {
      // incomingCallData not received (app was backgrounded during signaling)
      // Build a synthetic stub so the WebRTC hook is ready to receive the offer
      const stubName = pending.callerName && pending.callerName.trim() ? pending.callerName : 'Caller';
      console.log(`[CallProvider] No incomingCallData. Building stub with name "${stubName}" and waiting for socket offer`);
      const stub = {
        from: pending.callerId || 'unknown',
        callId: pending.callId,
        type: (pending.callType === 'VIDEO' ? 'VIDEO' : 'VOICE') as 'VOICE' | 'VIDEO',
        profile: { name: stubName, avatar: '' },
        offer: null,
      };
      setIncomingCallData(stub);
      setCallType(stub.type);
      setParticipants(prev => [...prev.filter(p => p.isLocal), { id: stub.from, name: stub.profile.name, avatar: '' }]);
      setIsWaitingForOffer(true);
    }
  }, [webrtc]);

  // Re-run executePendingAnswer whenever incomingCallData changes (offer may now be available)
  useEffect(() => {
    if (pendingAnswerRef.current) {
      executePendingAnswer();
    }
  }, [incomingCallData, executePendingAnswer]);

  // ── Handle native/push call actions ───────────────────────────────────────
  const handlePendingCallAction = useCallback((action: string, callId: string, callerId?: string, callerName?: string, callType?: string) => {
    console.log(`[CallProvider] handlePendingCallAction: action=${action}, callId=${callId}, callerId=${callerId}, callerName=${callerName}, callType=${callType}`);

    if (action === 'INCOMING_CALL') {
      // Native bridge told us about an incoming call (e.g. app was in background, FCM woke it)
      const resolvedName = callerName && callerName.trim() ? callerName : 'Unknown Caller';
      const activeCall = {
        from: callerId || 'unknown',
        callId,
        type: (callType === 'VIDEO' ? 'VIDEO' : 'VOICE') as 'VOICE' | 'VIDEO',
        profile: { name: resolvedName, avatar: '' },
        offer: null, // offer will arrive via socket
      };
      console.log('[CallProvider] INCOMING_CALL stub created, awaiting socket offer');
      setIncomingCallData(activeCall);
      setCallType(activeCall.type);
      setParticipants(prev => [
        ...prev.filter(p => p.isLocal),
        { id: activeCall.from, name: resolvedName, avatar: '' }
      ]);

    } else if (action === 'ANSWER') {
      console.log('[CallProvider] ANSWER action received from native bridge');
      // Store in ref so it survives re-renders and socket reconnects
      pendingAnswerRef.current = { callId, callerId, callerName, callType };
      executePendingAnswer();


    } else if (action === 'DECLINE') {
      console.log('[CallProvider] DECLINE action received from native bridge');
      pendingAnswerRef.current = null;
      if (callerId) webrtc.rejectCall(callerId, false, callId);
      setIncomingCallData(null);
      setParticipants(prev => prev.filter(p => p.isLocal));
      NativeBridge.endNativeCall();
    }
  }, [webrtc, executePendingAnswer]);

  // ── call_stop_ringing: answered on another device ─────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handleStopRinging = ({ callId }: { callId: string }) => {
      console.log(`[CallProvider] call_stop_ringing received for callId=${callId}`);
      const current = incomingCallRef.current;
      if (current && current.callId === callId) {
        setIncomingCallData(null);
        setParticipants(prev => prev.filter(p => p.isLocal));
      }
      pendingAnswerRef.current = null;
      setIsWaitingForOffer(false);
      NativeBridge.dismissCallBanner();
      NativeBridge.endNativeCall();
    };
    socket.on('call_stop_ringing', handleStopRinging);
    return () => { socket.off('call_stop_ringing', handleStopRinging); };
  }, [socket]);

  // ── socket:authed — socket reconnected and re-authenticated ───────────────
  // Re-run executePendingAnswer after the socket becomes ready.
  // This handles the case where the user tapped Answer while the socket
  // was disconnected (app was backgrounded), so by the time the socket
  // reconnects and authenticates, we retry the pending answer.
  useEffect(() => {
    const onSocketAuthed = () => {
      console.log('[CallProvider] socket:authed received — re-running executePendingAnswer');
      if (pendingAnswerRef.current) {
        executePendingAnswer();
      }
    };
    window.addEventListener('socket:authed', onSocketAuthed);
    return () => window.removeEventListener('socket:authed', onSocketAuthed);
  }, [executePendingAnswer]);


  // ── Poll pending intents on startup / app-resume ──────────────────────────
  useEffect(() => {
    if (!NativeBridge.isNative()) return;

    // Get initial app state
    App.getState().then((state) => {
      setIsAppActive(state.isActive);
      isAppActiveRef.current = state.isActive;
    }).catch(e => console.warn('[CallProvider] Failed to get initial app state:', e));

    const checkPending = async () => {
      try {
        const res = await NativeBridge.getPendingCall();
        console.log('[CallProvider] getPendingCall result:', JSON.stringify(res));
        if (res && res.hasPending && res.action) {
          if (res.action === 'NAVIGATE') {
            window.dispatchEvent(new CustomEvent('zetime:navigate', {
              detail: { type: res.type, route: res.route, conversationId: res.conversationId, studentId: res.studentId, schoolId: res.schoolId }
            }));
          } else {
            handlePendingCallAction(res.action, res.callId || '', res.callerId, res.callerName, res.callType);
          }
        }
      } catch (e) {
        console.warn('[CallProvider] checkPending failed:', e);
      }
    };

    checkPending();

    const sub = App.addListener('appStateChange', ({ isActive }) => {
      setIsAppActive(isActive);
      isAppActiveRef.current = isActive;
      if (isActive) {
        console.log('[CallProvider] App foregrounded — re-checking pending call intents');
        checkPending();
      }
    });

    return () => { sub.then(s => s.remove()); };
  }, [handlePendingCallAction]);

  // ── Listen for real-time native call action events ────────────────────────
  useEffect(() => {
    if (!NativeBridge.isNative()) return;

    const sub = NativeBridge.addCallActionListener((data: any) => {
      console.log('[CallProvider] Native call action event:', JSON.stringify(data));
      handlePendingCallAction(
        data.action,
        data.callId || '',
        data.callerId,
        data.callerName,
        data.callType
      );
    });

    return () => { (sub as any)?.then((s: any) => s.remove()); };
  }, [handlePendingCallAction]);

  const initiateCall = (toId: string, type: 'VOICE' | 'VIDEO', profile: any) => {
    if (isSuspended) {
      toast({ title: 'Portal Read-Only', description: 'Voice and video calls are disabled under school suspension.', variant: 'destructive' });
      return;
    }
    const targetAvatar = getAvatarUrl(profile);
    setCallType(type);
    setParticipants(prev => [
      ...prev.filter(p => p.isLocal),
      { id: toId, name: profile.name || profile.full_name || 'Unknown', avatar: targetAvatar }
    ]);
    const callerProfile = {
      name: currentUser?.name || (currentUser as any)?.full_name || 'Unknown User',
      avatar: getAvatarUrl(currentUser)
    };
    webrtc.startCall(toId, type, callerProfile, currentUser?.schoolId);
  };

  const remoteParticipant = participants.find(p => !p.isLocal);
  const activeCaller = remoteParticipant ? {
    ...remoteParticipant,
    avatar: remoteParticipant.avatar || getAvatarUrl(incomingCallData?.profile) || getAvatarUrl(incomingCallData?.callerProfile) || ''
  } : (incomingCallData ? {
    name: incomingCallData.profile?.name || incomingCallData.profile?.full_name || 'Unknown User',
    avatar: getAvatarUrl(incomingCallData.profile) || getAvatarUrl(incomingCallData.callerProfile) || ''
  } : { name: 'Unknown User', avatar: '' });

  return (
    <CallContext.Provider
      value={{
        initiateCall,
        endCall: webrtc.endCall,
        status: webrtc.callStatus,
        callDuration: webrtc.callDuration,
        isSpeakerOn: webrtc.isSpeakerOn,
        toggleSpeaker: webrtc.toggleSpeaker,
        callStats: webrtc.callStats,
      }}
    >
      {children}

      {/* Global Modals */}
      <IncomingCallModal
        isOpen={!!incomingCallData && !NativeBridge.isNative()}
        caller={activeCaller || { name: 'Unknown' }}
        type={callType}
        isConnecting={isWaitingForOffer}
        onAccept={handleAccept}
        onReject={handleReject}
      />

      {/* CallOverlay: only show once the incoming modal is fully dismissed (incomingCallData=null) */}
      {(webrtc.callStatus !== 'IDLE' || isWaitingForOffer) && !incomingCallData && (
        <CallOverlay
          status={isWaitingForOffer || webrtc.callStatus === 'IDLE' ? 'CONNECTING' : webrtc.callStatus}
          type={callType}
          isMuted={webrtc.isMuted}
          isCameraOff={webrtc.isCameraOff}
          isSpeakerOn={webrtc.isSpeakerOn}
          localStream={webrtc.localStream}
          remoteStreams={webrtc.remoteStreams}
          remoteMediaStates={webrtc.remoteMediaStates}
          participants={participants}
          caller={activeCaller || { name: 'Unknown' }}
          onEndCall={webrtc.endCall}
          onToggleMute={webrtc.toggleMute}
          onToggleCamera={webrtc.toggleCamera}
          onFlipCamera={webrtc.flipCamera}
          onToggleSpeaker={webrtc.toggleSpeaker}
          connectionQuality={webrtc.connectionQuality}
          duration={webrtc.callDuration}
          callStats={webrtc.callStats}
        />
      )}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within a CallProvider');
  return context;
};
