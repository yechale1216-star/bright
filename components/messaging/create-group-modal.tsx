'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { supabase } from '@/lib/utils/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Users, X, Info, Shield, CheckCircle2, Camera } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/lib/context/language-context';
import { cn } from '@/lib/utils/utils';
import { apiUrl } from '@/lib/api-config';

interface User {
  id: string;
  full_name: string;
  role: string;
  profile_photo?: string;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (group: any) => void;
  currentUser: any;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  currentUser
}) => {
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState('CUSTOM');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchContacts();
    } else {
      // Clear contacts when modal closes so they don't leak to the next open
      setContacts([]);
      setSelectedMembers([]);
    }
  }, [isOpen]);

  const fetchContacts = async () => {
    try {
      const token = localStorage.getItem('attendance_token');
      const schoolId = currentUser?.schoolId || localStorage.getItem('x-school-id') || 'single-school';

      if (!token) {
        console.warn('[CreateGroupModal] Missing token — skipping contact fetch');
        return;
      }

      const res = await fetch(`${apiUrl}/api/users/contacts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-school-id': schoolId,
        }
      });
      const data = await res.json();
      setContacts(data.data || []);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `group-${Date.now()}.${fileExt}`;
      const filePath = `group-avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatar(data.publicUrl);
      toast.success('Avatar uploaded');
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      toast.error('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem('attendance_token');
      // Use schoolId from currentUser prop, not raw localStorage
      const schoolId = currentUser?.schoolId || localStorage.getItem('x-school-id') || 'single-school';
      const res = await fetch(`${apiUrl}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-school-id': schoolId || ''
        },
        body: JSON.stringify({
          name: name.trim(),
          description,
          groupType,
          isAnnouncement,
          memberIds: selectedMembers,
          avatar: avatar || undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        onCreated(data);
        resetForm();
        onClose();
      }
    } catch (err) {
      console.error('Failed to create group:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setName('');
    setDescription('');
    setGroupType('CUSTOM');
    setIsAnnouncement(false);
    setSelectedMembers([]);
    setSearchQuery('');
    setAvatar(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
        <div className={cn(
          "h-24 bg-gradient-to-r from-primary to-primary/80 p-6 flex flex-col justify-end transition-all duration-500",
          step === 2 ? "h-20" : "h-24"
        )}>
          <DialogTitle className="text-white text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            {step === 1 ? "Create Group" : "Select Members"}
          </DialogTitle>
          <p className="text-white/70 text-sm">
            {step === 1 ? "Define your group details" : `${selectedMembers.length} members selected`}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {step === 1 ? (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-center flex-col items-center gap-4">
                <div className="relative group">
                  <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center border-4 border-background shadow-inner overflow-hidden relative">
                    {uploadingAvatar ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <Spinner size="sm" className="text-primary" />
                      </div>
                    ) : avatar ? (
                      <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="h-10 w-10 text-muted-foreground/50" />
                    )}
                  </div>
                  <Button 
                    size="icon" 
                    className="absolute bottom-0 right-0 rounded-full h-8 w-8 shadow-lg active:scale-90 transition-transform"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleAvatarSelect}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name" className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2 px-1">
                    <Info className="h-3 w-3" />
                    Group Name
                  </Label>
                  <Input 
                    id="group-name"
                    placeholder="e.g., Grade 10A Science"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl bg-secondary/30 border-none h-12 focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group-desc" className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2 px-1">
                    <Info className="h-3 w-3" />
                    Description
                  </Label>
                  <Textarea 
                    id="group-desc"
                    placeholder="What is this group for?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="rounded-xl bg-secondary/30 border-none resize-none h-24 focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                  />
                </div>

                <div className="flex items-center space-x-3 p-4 rounded-2xl bg-secondary/20 border border-primary/10">
                  <Checkbox 
                    id="announcement" 
                    checked={isAnnouncement}
                    onCheckedChange={(checked) => setIsAnnouncement(checked as boolean)}
                    className="rounded-md h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor="announcement" className="text-sm font-bold leading-none cursor-pointer flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      Announcement Mode
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Only admins can post messages in this mode
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input 
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl bg-secondary/30 border-none h-11 focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                />
              </div>

              <ScrollArea className="h-[300px] -mx-2 px-2">
                <div className="space-y-1">
                  {filteredContacts.map((contact) => (
                    <div 
                      key={contact.id}
                      onClick={() => toggleMember(contact.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all active:scale-[0.98]",
                        selectedMembers.includes(contact.id) 
                          ? "bg-primary/5 hover:bg-primary/10" 
                          : "hover:bg-secondary/50"
                      )}
                    >
                      <div className="relative">
                        <Avatar className="h-10 w-10 border border-border/50">
                          <AvatarImage src={contact.profile_photo} />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold">
                            {contact.full_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {selectedMembers.includes(contact.id) && (
                          <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-0.5 shadow-md">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{contact.full_name}</p>
                        <p className="text-xs text-muted-foreground uppercase font-medium">{contact.role}</p>
                      </div>
                      <Checkbox 
                        checked={selectedMembers.includes(contact.id)}
                        className="rounded-full h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </div>
                  ))}
                  {filteredContacts.length === 0 && (
                    <div className="py-10 text-center opacity-50">
                      <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-sm">No contacts found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-secondary/5 border-t border-border/50 flex sm:justify-between items-center gap-4">
          {step === 2 && (
            <Button 
              variant="ghost" 
              onClick={() => setStep(1)}
              className="rounded-xl hover:bg-secondary"
            >
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button 
            disabled={step === 1 ? !name.trim() : selectedMembers.length === 0 || isLoading}
            onClick={step === 1 ? () => setStep(2) : handleCreate}
            className="rounded-xl px-8 shadow-lg shadow-primary/20 h-11"
          >
            {isLoading ? "Creating..." : step === 1 ? "Next" : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
