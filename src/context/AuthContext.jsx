import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase/config';
import { 
  registerWithEmailAndPassword, 
  loginWithEmailAndPassword, 
  logoutUser, 
  sendUserPasswordReset, 
  updateUserDetails, 
  changePassword, 
  changeEmail, 
  deleteUserAccount 
} from '../firebase/authService';
import { getUserProfile, createUserProfileDocument } from '../firebase/userService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const prefsRef = useRef({});

  useEffect(() => {
    if (userProfile?.preferences) {
      prefsRef.current = { ...prefsRef.current, ...userProfile.preferences };
    }
  }, [userProfile?.preferences]);

  // Load user profile details
  const fetchUserProfile = async (user) => {
    if (!user) {
      prefsRef.current = {};
      setUserProfile(null);
      return null;
    }
    try {
      let profile = await getUserProfile(user.uid);
      if (!profile) {
        profile = await createUserProfileDocument(user);
      }
      prefsRef.current = profile?.preferences ? { ...profile.preferences } : {};
      setUserProfile(profile);
      return profile;
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Could not fetch user profile:', err);
      }
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    const user = await loginWithEmailAndPassword(email, password);
    await fetchUserProfile(user);
    return user;
  };

  const register = async (email, password, displayName, diaryMode) => {
    const user = await registerWithEmailAndPassword(email, password, displayName, diaryMode);
    await fetchUserProfile(user);
    return user;
  };

  const logout = async () => {
    await logoutUser();
    prefsRef.current = {};
    setCurrentUser(null);
    setUserProfile(null);
  };

  const resetPassword = async (email) => {
    return sendUserPasswordReset(email);
  };

  const updateUserProfileData = async (updates) => {
    if (!currentUser) throw new Error('No user is currently authenticated.');
    const updated = await updateUserDetails(currentUser, updates);
    setUserProfile(prev => ({ ...prev, ...updated }));
    return updated;
  };

  const updateUserPreferences = async (preferenceUpdates) => {
    if (!currentUser) return;
    const mergedPrefs = { ...(userProfile?.preferences || {}), ...prefsRef.current, ...preferenceUpdates };
    prefsRef.current = mergedPrefs;
    setUserProfile(prev => (prev ? { ...prev, preferences: mergedPrefs } : prev));
    await updateUserDetails(currentUser, { preferences: prefsRef.current });
    return prefsRef.current;
  };

  const updateUserEmail = async (newEmail, currentPassword) => {
    if (!currentUser) throw new Error('No user is currently authenticated.');
    await changeEmail(currentUser, currentPassword, newEmail);
    await fetchUserProfile(currentUser);
  };

  const updateUserPassword = async (currentPassword, newPassword) => {
    if (!currentUser) throw new Error('No user is currently authenticated.');
    await changePassword(currentUser, currentPassword, newPassword);
  };

  const deleteAccount = async (currentPassword) => {
    if (!currentUser) throw new Error('No user is currently authenticated.');
    await deleteUserAccount(currentUser, currentPassword);
    setCurrentUser(null);
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await fetchUserProfile(currentUser);
    }
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    isConfigured: isFirebaseConfigured,
    login,
    register,
    logout,
    resetPassword,
    updateUserProfileData,
    updateUserPreferences,
    updateUserEmail,
    updateUserPassword,
    deleteAccount,
    refreshProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

