import React from 'react';
import ProfilePage from './ProfilePage';

export default function ProfileRoutePage({ token, onLogout, onClose, onOpenSupportChat }) {
  return <ProfilePage token={token} onLogout={onLogout} onClose={onClose} onOpenSupportChat={onOpenSupportChat} />;
}
