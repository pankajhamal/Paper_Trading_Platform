// components/dashboard/Settings.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { assetUrl } from '../../services/api';
import {
  User as UserIcon,
  Mail,
  Shield,
  Camera,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

const Settings = () => {
  const user = useAppStore((s) => s.user);
  const fetchProfile = useAppStore((s) => s.fetchProfile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const changePassword = useAppStore((s) => s.changePassword);
  const uploadAvatar = useAppStore((s) => s.uploadAvatar);

  const [name, setName] = useState(user?.name || user?.full_name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Keep the name field in sync once the profile loads
  useEffect(() => {
    if (user?.full_name || user?.name) {
      setName(user.full_name || user.name);
    }
  }, [user?.full_name, user?.name]);

  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  const notify = (message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const email = user?.email || '';
  const role = user?.role || 'user';
  const initial = (name || email || 'T').charAt(0).toUpperCase();
  const avatarSrc = assetUrl(user?.avatar_url);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      notify('Name cannot be empty.', 'error');
      return;
    }
    setSavingProfile(true);
    const result = await updateProfile(trimmed);
    setSavingProfile(false);
    notify(
      result.success ? 'Profile updated successfully.' : result.error,
      result.success ? 'success' : 'error',
    );
  };

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      notify('Please choose an image file.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('Image must be under 5 MB.', 'error');
      return;
    }

    setUploadingAvatar(true);
    const result = await uploadAvatar(file);
    setUploadingAvatar(false);
    notify(
      result.success ? 'Profile photo updated.' : result.error,
      result.success ? 'success' : 'error',
    );
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwd.current || !pwd.next) {
      notify('Please fill in all password fields.', 'error');
      return;
    }
    if (pwd.next.length < 8) {
      notify('New password must be at least 8 characters.', 'error');
      return;
    }
    if (pwd.next !== pwd.confirm) {
      notify('New passwords do not match.', 'error');
      return;
    }
    setSavingPwd(true);
    const result = await changePassword(pwd.current, pwd.next);
    setSavingPwd(false);
    if (result.success) {
      notify('Password changed successfully.', 'success');
      setPwd({ current: '', next: '', confirm: '' });
    } else {
      notify(result.error, 'error');
    }
  };

  const inputCls =
    'w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400';

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">
          Manage your profile, photo and account security
        </p>
      </div>

      {/* Profile card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">Profile</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Your personal information and profile photo
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="Profile"
                  className="h-20 w-20 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="flex items-center justify-center h-20 w-20 rounded-full bg-slate-800 text-white text-2xl font-semibold">
                  {initial}
                </div>
              )}
              <button
                onClick={handleAvatarPick}
                disabled={uploadingAvatar}
                title="Change photo"
                className="absolute -bottom-1 -right-1 flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white border-2 border-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {uploadingAvatar ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Camera size={14} />
                )}
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Profile photo</p>
              <p className="text-xs text-slate-400 mt-0.5">
                JPG, PNG, WEBP or GIF · up to 5 MB
              </p>
              <button
                onClick={handleAvatarPick}
                disabled={uploadingAvatar}
                className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-60"
              >
                Upload new photo
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          {/* Profile form */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <UserIcon
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input type="email" value={email} disabled className={`${inputCls} pl-9`} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Email address cannot be changed.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Account Type
              </label>
              <div className="relative">
                <Shield
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={role.charAt(0).toUpperCase() + role.slice(1)}
                  disabled
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-colors disabled:opacity-60"
              >
                {savingProfile && <Loader2 size={16} className="animate-spin" />}
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Security card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">Security</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Change your account password
          </p>
        </div>

        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          {[
            { key: 'current', label: 'Current Password', placeholder: 'Enter current password' },
            { key: 'next', label: 'New Password', placeholder: 'At least 8 characters' },
            { key: 'confirm', label: 'Confirm New Password', placeholder: 'Re-enter new password' },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                {field.label}
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={pwd[field.key]}
                  onChange={(e) => setPwd((p) => ({ ...p, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className={`${inputCls} pl-9 pr-10`}
                />
                {field.key === 'current' && (
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title={showPwd ? 'Hide passwords' : 'Show passwords'}
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPwd}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-colors disabled:opacity-60"
            >
              {savingPwd && <Loader2 size={16} className="animate-spin" />}
              {savingPwd ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Toast */}
      <div
        className={`fixed bottom-6 right-6 z-[10000] transition-all duration-500 ease-in-out transform ${
          toast
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : 'translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      >
        {toast && (
          <div
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold max-w-sm ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <XCircle size={18} className="text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
