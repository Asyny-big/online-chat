import React from 'react';
import ProfilePage from './ProfilePage';

export default function ProfileRoutePage({ token, onLogout, onClose }) {
  return <ProfilePage token={token} onLogout={onLogout} onClose={onClose} />;
}
