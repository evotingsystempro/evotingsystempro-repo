// utils/uploadImage.ts
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as FileSystem from "expo-file-system";

const storage = getStorage();

/**
 * Upload an image to Firebase Storage.
 * @param uri - Local URI of the image
 * @param imageId - Unique ID to name the image
 * @returns Promise<string|null> download URL if success, null otherwise
 */
export async function uploadImage(uri: string, imageId: string): Promise<string | null> {
  try {
    const response = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const imageBuffer = Uint8Array.from(atob(response), (c) => c.charCodeAt(0));
    const storageRef = ref(storage, `chat_images/${imageId}.jpg`);

    const metadata = {
      contentType: "image/jpeg",
    };

    await uploadBytes(storageRef, imageBuffer, metadata);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("uploadImage error:", error);
    return null;
  }
}
