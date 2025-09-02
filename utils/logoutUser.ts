import { getAuth, signOut } from "firebase/auth";

/**
 * Logs out the current Firebase Auth user.
 * @param {Function} [onSuccess] - Optional callback after successful logout.
 * @param {Function} [onError] - Optional callback if logout fails.
 */
export const logoutUser = async (onSuccess: Function, onError: Function) => {
  const auth = getAuth();
  try {
    await signOut(auth);
    console.log("User signed out successfully");
    if (onSuccess) onSuccess();
  } catch (error) {
    console.error("Error signing out:", error);
    if (onError) onError(error);
  }
};