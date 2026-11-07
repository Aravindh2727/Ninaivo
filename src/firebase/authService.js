import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  updateEmail,
  verifyBeforeUpdateEmail,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './config';
import { createUserProfileDocument, updateUserProfileDocument } from './userService';

/**
 * Maps Firebase Auth error codes to friendly human-readable messages
 */
export function formatAuthError(error) {
  if (!error) return 'An unexpected error occurred.';
  const code = error.code || '';

  switch (code) {
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please double check your credentials.';
    case 'auth/user-not-found':
      return 'No registered account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again or use Forgot Password.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please log in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters with a combination of letters and numbers.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/missing-password':
      return 'Password cannot be empty.';
    case 'auth/requires-recent-login':
      return 'Security verification required: please re-enter your current password to continue.';
    case 'auth/too-many-requests':
      return 'Access temporarily blocked due to many failed attempts. Please try again later or reset password.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.':
      return 'Firebase configuration missing or invalid. Please check the credentials in your .env file.';
    default:
      return error.message || 'Authentication operation failed.';
  }
}

/**
 * Re-authenticates current user using their email and current password
 */
export async function reauthenticateCurrentUser(user, currentPassword) {
  if (!user || !user.email) throw new Error('No active authenticated user session.');
  if (!currentPassword) throw new Error('Current password is required for security verification.');

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  return reauthenticateWithCredential(user, credential);
}

/**
 * Register a new user with email, password, displayName, and diaryMode
 */
export async function registerWithEmailAndPassword(email, password, displayName, diaryMode = 'personal') {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not yet configured. Please add your credentials to the .env file.');
  }

  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;

  // Update Auth Profile Display Name
  if (displayName && displayName.trim()) {
    await updateProfile(user, { displayName: displayName.trim() });
  }

  // Create Firestore Profile Document
  await createUserProfileDocument(user, {
    displayName: displayName.trim() || 'Diary Creator',
    diaryMode
  });

  return user;
}

/**
 * Log in existing user with email and password
 */
export async function loginWithEmailAndPassword(email, password) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not yet configured. Please add your credentials to the .env file.');
  }

  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;

  // Sync profile document / update last login
  await createUserProfileDocument(user);

  return user;
}

/**
 * Log out current user
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Send password reset email
 */
export async function sendUserPasswordReset(email) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not yet configured. Please add your credentials to the .env file.');
  }
  return sendPasswordResetEmail(auth, email.trim());
}

/**
 * Update user profile details (displayName, photoURL, bio, diaryMode, etc.)
 */
export async function updateUserDetails(user, updates) {
  if (!user) throw new Error('User is not authenticated.');

  // Update Firebase Auth basic profile if displayName or photoURL changed
  const authUpdates = {};
  if (updates.displayName !== undefined) authUpdates.displayName = updates.displayName;
  if (updates.photoURL !== undefined) authUpdates.photoURL = updates.photoURL;

  if (Object.keys(authUpdates).length > 0) {
    await updateProfile(user, authUpdates);
  }

  // Update Firestore user document
  return updateUserProfileDocument(user.uid, updates);
}

/**
 * Change user password with current password re-authentication
 */
export async function changePassword(user, currentPassword, newPassword) {
  if (!user) throw new Error('User is not authenticated.');
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  // Re-authenticate first for security
  await reauthenticateCurrentUser(user, currentPassword);

  // Update password in Firebase Auth
  await updatePassword(user, newPassword);
}

/**
 * Update user email with current password re-authentication
 */
export async function changeEmail(user, currentPassword, newEmail) {
  if (!user) throw new Error('User is not authenticated.');
  if (!newEmail || !newEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  // Re-authenticate first for security
  await reauthenticateCurrentUser(user, currentPassword);

  // Use verifyBeforeUpdateEmail if supported by the Firebase project, otherwise fallback to updateEmail
  if (typeof verifyBeforeUpdateEmail === 'function') {
    try {
      await verifyBeforeUpdateEmail(user, newEmail.trim());
    } catch {
      await updateEmail(user, newEmail.trim());
    }
  } else {
    await updateEmail(user, newEmail.trim());
  }

  // Sync with Firestore profile
  await updateUserProfileDocument(user.uid, { email: newEmail.trim() });
}

/**
 * Permanently delete user account and clean up Firestore document
 */
export async function deleteUserAccount(user, currentPassword) {
  if (!user) throw new Error('User is not authenticated.');

  // Re-authenticate first for security
  await reauthenticateCurrentUser(user, currentPassword);

  // Delete profile document from Firestore
  try {
    await updateUserProfileDocument(user.uid, { isDeleted: true, deletedAt: new Date().toISOString() });
  } catch (err) {
    console.warn('Could not mark profile as deleted in Firestore:', err);
  }

  // Delete user from Firebase Auth
  await deleteUser(user);
}

