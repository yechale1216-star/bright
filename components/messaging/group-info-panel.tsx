'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/utils/supabase';
import { 
  ArrowLeft, Key, UserPlus, Star, ClipboardList, Edit, MoreVertical,
  MessageSquare, Volume2, VolumeX, LogOut, Sliders, Shield,
  Trash2, Image as ImageIcon, FileText, Link as LinkIcon, Bookmark,
  Check, Search, Camera, CheckCircle2, X, Users, Info
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/utils';
import { notifications } from '@/lib/utils/notifications';
import { ConversationDetailsTabs } from '@/components/messaging/conversation-details-tabs';
import { getApiUrl } from '@/lib/api-config';

const API_URL = getApiUrl();

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : '';
  const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : '';
  return {
    'Authorization': `Bearer ${token}`,
    'x-school-id': schoolId || '',
    'Content-Type': 'application/json'
  };
};

interface GroupInfoPanelProps {
  group: any;
  onClose: () => void;
  currentUser: any;
  onUpdateRole?: (userId: string, role: string) => void;
  onRemoveMember?: (userId: string) => void;
  onAddMembers?: (memberIds: string[]) => void;
  onToggleMute?: () => void;
  onLeaveGroup?: () => void;
  onGroupUpdated?: (updatedGroup: any) => void;
  onSendMessage?: () => void;
  onNavigateToMessage?: (messageId: string) => void;
}

export const GroupInfoPanel: React.FC<GroupInfoPanelProps> = ({
  group,
  onClose,
  currentUser,
  onUpdateRole,
  onRemoveMember,
  onAddMembers,
  onToggleMute,
  onLeaveGroup,
  onGroupUpdated,
  onSendMessage,
  onNavigateToMessage
}) => {
  const [activeTab, setActiveTab] = useState('members');
  const [memberFilter, setMemberFilter] = useState<'all' | 'admins' | 'online' | 'members'>('all');
  const [isStarred, setIsStarred] = useState(false);
  const [isMuted, setIsMuted] = useState(Boolean(group?.isMuted));
  
  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Edit group form state
  const [editName, setEditName] = useState(group?.name || '');
  const [editDescription, setEditDescription] = useState(group?.description || '');
  const [editAvatar, setEditAvatar] = useState(group?.avatar || '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Add members state
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchContact, setSearchContact] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  // Shared media state
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);

  // Avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const members = group?.members || [];
  const myMember = members.find((m: any) => m.userId === currentUser?.id);
  const ownerMember = members.find((m: any) => m.role === 'OWNER');
  const ownerName = ownerMember?.user?.full_name || group?.createdBy || 'Unknown';
  const isAdminOrOwner = myMember?.role === 'OWNER' || myMember?.role === 'ADMIN';

  useEffect(() => {
    setIsMuted(Boolean(group?.isMuted));
    setEditName(group?.name || '');
    setEditDescription(group?.description || '');
    setEditAvatar(group?.avatar || '');
  }, [group]);

  // Fetch shared media on tab switch
  useEffect(() => {
    if (activeTab === 'media' || activeTab === 'files' || activeTab === 'links') {
      fetchSharedMedia();
    }
  }, [activeTab, group?.id]);

  const fetchSharedMedia = async () => {
    if (!group?.id) return;
    setIsLoadingMedia(true);
    try {
      const res = await fetch(`${API_URL}/api/groups/${group.id}/media`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json) 
          ? json 
          : Array.isArray(json?.data) 
            ? json.data 
            : Array.isArray(json?.media) 
              ? json.media 
              : [];
        setMediaItems(items);
      }
    } catch (err) {
      console.error('Failed to fetch group media:', err);
      setMediaItems([]);
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const fetchContacts = async () => {
    setIsLoadingContacts(true);
    try {
      const res = await fetch(`${API_URL}/api/users/contacts`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const existingIds = new Set(members.map((m: any) => m.userId));
        const available = (data.data || []).filter((c: any) => !existingIds.has(c.id));
        setContacts(available);
      }
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleOpenAddMembers = () => {
    setShowAddMemberModal(true);
    fetchContacts();
  };

  const handleAddSelectedMembers = async () => {
    if (selectedContacts.length === 0 || !group?.id) return;
    setIsAddingMembers(true);
    try {
      const res = await fetch(`${API_URL}/api/groups/${group.id}/members`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ memberIds: selectedContacts })
      });
      if (res.ok) {
        const updated = await res.json();
        notifications.success("Success", "Members added successfully");
        if (onGroupUpdated) onGroupUpdated(updated);
        if (onAddMembers) onAddMembers(selectedContacts);
        setShowAddMemberModal(false);
        setSelectedContacts([]);
      } else {
        const err = await res.json();
        notifications.error("Error", err.error || err.message || "Failed to add members");
      }
    } catch (err: any) {
      notifications.error("Error", err.message || "Failed to add members");
    } finally {
      setIsAddingMembers(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !group?.id) return;

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `group-${group.id}-${Date.now()}.${fileExt}`;
      const filePath = `group-avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = data.publicUrl;

      const res = await fetch(`${API_URL}/api/groups/${group.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: group.name,
          description: group.description,
          avatar: avatarUrl,
        }),
      });

      if (res.ok) {
        notifications.success('Avatar Updated', 'Group photo changed successfully');
        if (onGroupUpdated) onGroupUpdated({ ...group, avatar: avatarUrl });
      } else {
        const err = await res.json();
        notifications.error('Error', err.error || err.message || 'Failed to update avatar');
      }
    } catch (err: any) {
      notifications.error('Upload Failed', err.message || 'Failed to upload photo');
    } finally {
      setIsUploadingAvatar(false);
      // Reset so same file can be picked again
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !group?.id) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`${API_URL}/api/groups/${group.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          avatar: editAvatar
        })
      });
      if (res.ok) {
        const updated = await res.json();
        notifications.success("Group Updated", "Group information updated successfully");
        if (onGroupUpdated) onGroupUpdated({ ...group, ...updated });
        setShowEditModal(false);
      } else {
        const err = await res.json();
        notifications.error("Error", err.error || err.message || "Failed to update group");
      }
    } catch (err: any) {
      notifications.error("Error", err.message || "Failed to update group");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleMuteInternal = async () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    if (!group?.id) return;
    try {
      await fetch(`${API_URL}/api/groups/${group.id}/mute`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ muted: nextState })
      });
      notifications.success("Settings Updated", nextState ? "Group muted" : "Group unmuted");
      if (onToggleMute) onToggleMute();
    } catch (err) {
      console.error('Failed to toggle mute:', err);
    }
  };

  const handleLeaveGroupInternal = async () => {
    if (!group?.id || !currentUser?.id) return;
    try {
      const res = await fetch(`${API_URL}/api/groups/${group.id}/members/${currentUser.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        notifications.success("Left Group", "You have left the group");
        if (onLeaveGroup) onLeaveGroup();
        onClose();
      } else {
        const err = await res.json();
        notifications.error("Error", err.error || err.message || "Failed to leave group");
      }
    } catch (err: any) {
      notifications.error("Error", err.message || "Failed to leave group");
    } finally {
      setShowLeaveDialog(false);
    }
  };

  // Filtered members calculation
  const filteredMembers = members.filter((m: any) => {
    if (memberFilter === 'admins') return m.role === 'OWNER' || m.role === 'ADMIN';
    if (memberFilter === 'members') return m.role === 'MEMBER';
    if (memberFilter === 'online') {
      const lastAct = m.user?.lastActive;
      if (!lastAct) return false;
      const isOnline = new Date().getTime() - new Date(lastAct).getTime() < 300000;
      return isOnline;
    }
    return true;
  });

  const getMemberStatus = (userObj: any) => {
    if (!userObj?.lastActive) return 'last seen recently';
    const diff = new Date().getTime() - new Date(userObj.lastActive).getTime();
    if (diff < 300000) return 'online';
    if (diff < 3600000) return `last seen ${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `last seen ${Math.floor(diff / 3600000)}h ago`;
    return 'last seen recently';
  };

  // Filtered media items
  const safeMediaItems = Array.isArray(mediaItems) ? mediaItems : [];
  const mediaFiles = safeMediaItems.filter(m => m?.type === 'IMAGE' || m?.type === 'VIDEO');
  const docFiles = safeMediaItems.filter(m => m?.type === 'FILE');
  const linkFiles = safeMediaItems.filter(m => m?.content && (typeof m.content === 'string' && (m.content.includes('http://') || m.content.includes('https://'))));

  return (
    <div className="w-full md:w-[380px] lg:w-[420px] h-full border-l border-slate-800 bg-[#0c131d] text-slate-100 flex flex-col select-none animate-in slide-in-from-right duration-250 fixed inset-0 md:relative overflow-hidden z-50">
      
      {/* ── 1. Top Header Bar (Fixed at top) ────────────────────────────── */}
      <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between bg-[#111a28] shrink-0">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose} 
          className="h-9 w-9 rounded-full text-slate-300 hover:text-white hover:bg-slate-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowPrivacyModal(true)} 
            className="h-9 w-9 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
            title="Privacy & Encryption"
          >
            <Key className="h-4.5 w-4.5" />
          </Button>

          {isAdminOrOwner && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleOpenAddMembers} 
              className="h-9 w-9 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              title="Add Members"
            >
              <UserPlus className="h-4.5 w-4.5" />
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsStarred(!isStarred)} 
            className={cn(
              "h-9 w-9 rounded-full transition-colors",
              isStarred ? "text-amber-400 hover:bg-amber-400/10" : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
            title={isStarred ? "Starred Group" : "Star Group"}
          >
            <Star className={cn("h-4.5 w-4.5", isStarred && "fill-amber-400")} />
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowInfoSheet(true)} 
            className="h-9 w-9 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
            title="Group Information"
          >
            <ClipboardList className="h-4.5 w-4.5" />
          </Button>

          {isAdminOrOwner && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowEditModal(true)} 
              className="h-9 w-9 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              title="Edit Group Details"
            >
              <Edit className="h-4.5 w-4.5" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <MoreVertical className="h-4.5 w-4.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-[#172232] border-slate-800 text-slate-200 rounded-2xl shadow-2xl p-1.5">
              {isAdminOrOwner && (
                <DropdownMenuItem onClick={() => setShowEditModal(true)} className="rounded-xl gap-2.5 cursor-pointer hover:bg-slate-800 focus:bg-slate-800">
                  <Edit className="h-4 w-4 text-emerald-400" />
                  Edit Group Details
                </DropdownMenuItem>
              )}
              {isAdminOrOwner && (
                <DropdownMenuItem onClick={handleOpenAddMembers} className="rounded-xl gap-2.5 cursor-pointer hover:bg-slate-800 focus:bg-slate-800">
                  <UserPlus className="h-4 w-4 text-blue-400" />
                  Add Members
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleToggleMuteInternal} className="rounded-xl gap-2.5 cursor-pointer hover:bg-slate-800 focus:bg-slate-800">
                {isMuted ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-amber-400" />}
                {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-800 my-1" />
              <DropdownMenuItem onClick={() => setShowLeaveDialog(true)} className="rounded-xl gap-2.5 cursor-pointer text-red-400 hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10">
                <LogOut className="h-4 w-4" />
                Leave Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-16 scrollbar-thin scrollbar-thumb-slate-700/50">
        
        {/* ── 2. Hero Profile Header Section ──────────────────────────────── */}
        <div className="p-6 flex flex-col items-center text-center space-y-3 relative">
          <div className="relative group cursor-pointer">
            <Avatar
              className="h-32 w-32 border-4 border-[#172436] shadow-2xl ring-4 ring-emerald-500/10 transition-all duration-300 group-hover:ring-emerald-500/30"
              onClick={() => isAdminOrOwner && setShowEditModal(true)}
            >
              <AvatarImage src={group?.avatar} className="object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900 text-white text-3xl font-black">
                {group?.name?.slice(0, 2).toUpperCase() || 'GR'}
              </AvatarFallback>
            </Avatar>
            {isAdminOrOwner && (
              <>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-1 right-1 bg-emerald-600 text-white p-2 rounded-full shadow-lg border-2 border-[#0c131d] opacity-90 hover:bg-emerald-500 group-hover:scale-110 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Change group photo"
                >
                  {isUploadingAvatar
                    ? <Spinner size="sm" className="text-white w-4 h-4" />
                    : <Camera className="h-4 w-4" />}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-wide text-white drop-shadow-sm flex items-center justify-center gap-1.5">
              {group?.name || 'Group Name'}
            </h2>
            <div className="flex flex-col items-center gap-0.5 text-xs text-slate-400 font-medium">
              <span>{members.length} members</span>
              <span className="text-slate-400/80 italic font-mono text-[11px]">
                Owner: <strong className="text-slate-200 font-semibold">{ownerName}</strong>
              </span>
            </div>
          </div>

          {/* ── 3. Quick Action Buttons Row (3 Rounded Dark Pills) ───────── */}
          <div className="grid grid-cols-3 gap-3 w-full pt-3">
            <button
              onClick={() => {
                if (onSendMessage) onSendMessage();
                onClose();
              }}
              className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl bg-[#172232] hover:bg-[#1f2d42] active:scale-95 text-slate-200 transition-all border border-slate-800/60 shadow-lg"
            >
              <MessageSquare className="h-5 w-5 text-emerald-400" />
              <span className="text-[11px] font-semibold tracking-wide">Message</span>
            </button>

            <button
              onClick={handleToggleMuteInternal}
              className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl bg-[#172232] hover:bg-[#1f2d42] active:scale-95 text-slate-200 transition-all border border-slate-800/60 shadow-lg"
            >
              {isMuted ? (
                <>
                  <Volume2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-[11px] font-semibold tracking-wide">Unmute</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-5 w-5 text-amber-400" />
                  <span className="text-[11px] font-semibold tracking-wide">Mute</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowLeaveDialog(true)}
              className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl bg-[#172232] hover:bg-red-500/20 active:scale-95 text-slate-200 hover:text-red-300 transition-all border border-slate-800/60 shadow-lg"
            >
              <LogOut className="h-5 w-5 text-red-400" />
              <span className="text-[11px] font-semibold tracking-wide">Leave</span>
            </button>
          </div>
        </div>

        {/* ── 4. Group Action & Filter Rows ──────────────────────────────── */}
        <div className="px-4 py-2 space-y-2 border-t border-slate-800/50">
          <div className="flex items-center justify-between text-slate-300">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 text-xs font-semibold hover:text-white transition-colors py-2 px-1">
                  <Sliders className="h-4 w-4 text-emerald-400" />
                  <span>Members filter</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 bg-[#172232] border-slate-800 text-slate-200 rounded-xl">
                <DropdownMenuItem onClick={() => setMemberFilter('all')} className={cn("text-xs gap-2 rounded-lg cursor-pointer", memberFilter === 'all' && "bg-slate-800 font-bold text-emerald-400")}>
                  {memberFilter === 'all' && <Check className="h-3.5 w-3.5" />} All Members
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMemberFilter('admins')} className={cn("text-xs gap-2 rounded-lg cursor-pointer", memberFilter === 'admins' && "bg-slate-800 font-bold text-emerald-400")}>
                  {memberFilter === 'admins' && <Check className="h-3.5 w-3.5" />} Admins Only
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMemberFilter('online')} className={cn("text-xs gap-2 rounded-lg cursor-pointer", memberFilter === 'online' && "bg-slate-800 font-bold text-emerald-400")}>
                  {memberFilter === 'online' && <Check className="h-3.5 w-3.5" />} Online Now
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-xs text-slate-400 capitalize font-medium">
              {memberFilter === 'all' ? 'All' : memberFilter}
            </span>
          </div>

          {isAdminOrOwner && (
            <button
              onClick={handleOpenAddMembers}
              className="flex items-center gap-3 w-full py-2.5 px-2 text-xs font-semibold text-slate-200 hover:text-emerald-400 hover:bg-slate-800/40 rounded-xl transition-all"
            >
              <UserPlus className="h-5 w-5 text-emerald-400" />
              <span>Add Members</span>
            </button>
          )}
        </div>

        {/* ── 5. Tabbed Section ────────────────────────────────────────────── */}
        <div className="px-3 pt-2 pb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full flex items-center justify-between p-1 bg-[#15202e] rounded-2xl border border-slate-800/60">
              <TabsTrigger value="members" className="flex-1 rounded-xl text-[11px] font-bold py-1.5 text-slate-400 data-[state=active]:bg-[#202e42] data-[state=active]:text-emerald-400 data-[state=active]:shadow-md transition-all">
                Members
              </TabsTrigger>
              <TabsTrigger value="media" className="flex-1 rounded-xl text-[11px] font-bold py-1.5 text-slate-400 data-[state=active]:bg-[#202e42] data-[state=active]:text-emerald-400 data-[state=active]:shadow-md transition-all">
                Media
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex-1 rounded-xl text-[11px] font-bold py-1.5 text-slate-400 data-[state=active]:bg-[#202e42] data-[state=active]:text-emerald-400 data-[state=active]:shadow-md transition-all">
                Saved
              </TabsTrigger>
              <TabsTrigger value="files" className="flex-1 rounded-xl text-[11px] font-bold py-1.5 text-slate-400 data-[state=active]:bg-[#202e42] data-[state=active]:text-emerald-400 data-[state=active]:shadow-md transition-all">
                Files
              </TabsTrigger>
              <TabsTrigger value="links" className="flex-1 rounded-xl text-[11px] font-bold py-1.5 text-slate-400 data-[state=active]:bg-[#202e42] data-[state=active]:text-emerald-400 data-[state=active]:shadow-md transition-all">
                Links
              </TabsTrigger>
            </TabsList>

            {/* ── Members Tab Content ────────────────────────────────────── */}
            <TabsContent value="members" className="mt-3 space-y-1.5">
              {filteredMembers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No members match this filter.
                </div>
              ) : (
                filteredMembers.map((m: any) => {
                  const statusText = getMemberStatus(m.user);
                  const isOnline = statusText === 'online';

                  return (
                    <div 
                      key={m.userId} 
                      className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#162232] group transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          <Avatar className="h-10 w-10 border border-slate-700/60">
                            <AvatarImage src={m.user?.profile_photo} className="object-cover" />
                            <AvatarFallback className="bg-slate-800 text-slate-300 font-bold text-xs">
                              {m.user?.full_name?.slice(0, 2).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[#0c131d]" />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-200 truncate">
                              {m.user?.full_name || 'Member'}
                            </span>
                          </div>
                          <span className={cn("text-[11px] font-medium truncate", isOnline ? "text-emerald-400" : "text-slate-500")}>
                            {statusText}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {m.role === 'OWNER' && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                            Owner
                          </span>
                        )}
                        {m.role === 'ADMIN' && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                            Admin
                          </span>
                        )}

                        {isAdminOrOwner && m.userId !== currentUser?.id && m.role !== 'OWNER' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/50">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-[#172232] border-slate-800 text-slate-200 rounded-xl p-1">
                              {onUpdateRole && (
                                <DropdownMenuItem 
                                  onClick={() => onUpdateRole(m.userId, m.role === 'ADMIN' ? 'MEMBER' : 'ADMIN')}
                                  className="text-xs rounded-lg gap-2 cursor-pointer hover:bg-slate-800"
                                >
                                  <Shield className="h-3.5 w-3.5 text-blue-400" />
                                  {m.role === 'ADMIN' ? 'Demote to Member' : 'Promote to Admin'}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="bg-slate-800" />
                              {onRemoveMember && (
                                <DropdownMenuItem 
                                  onClick={() => onRemoveMember(m.userId)}
                                  className="text-xs rounded-lg gap-2 cursor-pointer text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remove from Group
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* ── Media, Saved, Files, Links Tabs ──────────────────────── */}
            <div className="mt-3">
              {['media', 'saved', 'files', 'links'].includes(activeTab) && (
                <ConversationDetailsTabs
                  conversationId={group.id}
                  activeTab={activeTab as any}
                  onTabChange={(tab) => setActiveTab(tab)}
                  onNavigateToMessage={(mid) => {
                    if (onNavigateToMessage) onNavigateToMessage(mid);
                    onClose();
                  }}
                />
              )}
            </div>


          </Tabs>
        </div>

      </div>

      {/* ── Modals & Dialogs ────────────────────────────────────────────── */}

      {/* 1. Edit Group Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-[#141f2d] border-slate-800 text-slate-100 rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Edit className="h-5 w-5 text-emerald-400" />
              Edit Group Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Group Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter group name..."
                className="bg-[#0c131d] border-slate-800 text-white rounded-xl focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Group Avatar URL</label>
              <Input
                value={editAvatar}
                onChange={(e) => setEditAvatar(e.target.value)}
                placeholder="https://..."
                className="bg-[#0c131d] border-slate-800 text-white rounded-xl focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What is this group about?"
                rows={3}
                className="bg-[#0c131d] border-slate-800 text-white rounded-xl focus:border-emerald-500 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowEditModal(false)} className="rounded-xl border border-slate-800 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">
              {isSavingEdit ? <Spinner size="sm" className="text-white mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Add Members Modal */}
      <Dialog open={showAddMemberModal} onOpenChange={setShowAddMemberModal}>
        <DialogContent className="bg-[#141f2d] border-slate-800 text-slate-100 rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-400" />
              Add Group Members
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchContact}
                onChange={(e) => setSearchContact(e.target.value)}
                placeholder="Search contacts..."
                className="pl-9 bg-[#0c131d] border-slate-800 text-white rounded-xl text-xs"
              />
            </div>

            <ScrollArea className="h-60 pr-2">
              {isLoadingContacts ? (
                <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Spinner size="sm" className="text-emerald-400" /> Loading contacts...
                </div>
              ) : contacts.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  No new contacts available to add.
                </div>
              ) : (
                contacts
                  .filter(c => c.full_name?.toLowerCase().includes(searchContact.toLowerCase()))
                  .map(c => {
                    const isSelected = selectedContacts.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedContacts(prev => 
                            isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id]
                          );
                        }}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors mb-1",
                          isSelected ? "bg-emerald-500/10 border border-emerald-500/30" : "hover:bg-slate-800/50"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={c.profile_photo} />
                            <AvatarFallback className="bg-slate-800 text-xs text-slate-300 font-bold">
                              {c.full_name?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold text-slate-200">{c.full_name}</span>
                        </div>
                        <div className={cn("h-5 w-5 rounded-md border flex items-center justify-center", isSelected ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-700")}>
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </div>
                      </div>
                    );
                  })
              )}
            </ScrollArea>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowAddMemberModal(false)} className="rounded-xl border border-slate-800 text-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={handleAddSelectedMembers} 
              disabled={isAddingMembers || selectedContacts.length === 0} 
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
            >
              {isAddingMembers ? <Spinner size="sm" className="text-white mr-2" /> : null}
              Add ({selectedContacts.length}) Members
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Leave Group Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="bg-[#141f2d] border-slate-800 text-slate-100 rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <LogOut className="h-5 w-5 text-red-400" />
              Leave Group?
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs pt-1">
              Are you sure you want to leave <strong>{group?.name}</strong>? You will no longer receive messages or updates from this group.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowLeaveDialog(false)} className="rounded-xl border border-slate-800 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleLeaveGroupInternal} className="bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold">
              Leave Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Group Description Info Sheet */}
      <Dialog open={showInfoSheet} onOpenChange={setShowInfoSheet}>
        <DialogContent className="bg-[#141f2d] border-slate-800 text-slate-100 rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-400" />
              Group Information
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Group Name</span>
              <p className="text-slate-200 font-semibold text-sm mt-0.5">{group?.name}</p>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Description</span>
              <p className="text-slate-300 mt-0.5 bg-[#0c131d] p-3 rounded-xl border border-slate-800">
                {group?.description || 'No description provided.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase">Total Members</span>
                <p className="text-slate-200 font-bold">{members.length}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase">Group Type</span>
                <p className="text-slate-200 font-bold">{group?.groupType || 'CUSTOM'}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInfoSheet(false)} className="bg-slate-800 hover:bg-slate-700 text-white rounded-xl w-full">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Privacy & Key Information Modal */}
      <Dialog open={showPrivacyModal} onOpenChange={setShowPrivacyModal}>
        <DialogContent className="bg-[#141f2d] border-slate-800 text-slate-100 rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Key className="h-5 w-5 text-emerald-400" />
              Encrypted Group
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-xs pt-2 leading-relaxed">
              Messages and calls in <strong>{group?.name}</strong> are secured within your school network. Only verified school members can join or view messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button onClick={() => setShowPrivacyModal(false)} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl w-full font-bold">
              Got It
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Media Full Screen Lightbox Preview */}
      <Dialog open={!!previewMedia} onOpenChange={() => setPreviewMedia(null)}>
        <DialogContent className="max-w-3xl bg-black/95 border-none p-0 overflow-hidden flex flex-col items-center justify-center">
          {previewMedia && (
            <img src={previewMedia} alt="Media Preview" className="max-h-[85vh] w-auto object-contain rounded-2xl" />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};
