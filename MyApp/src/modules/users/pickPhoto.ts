import { launchCamera, launchImageLibrary, type ImageLibraryOptions } from 'react-native-image-picker';

/** Photos can be up to 10 MB (the server checks too). */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type PickedPhoto = { uri: string; type: string; name: string };

/**
 * Lets the user choose a photo from the gallery (or take one with the
 * camera), resized to `maxSide` pixels. Returns null if they cancel; throws
 * a readable message if the photo can't be used.
 */
export async function pickPhoto({ maxSide = 800, camera = false }: { maxSide?: number; camera?: boolean } = {}): Promise<PickedPhoto | null> {
  const options: ImageLibraryOptions = { mediaType: 'photo', selectionLimit: 1, maxWidth: maxSide, maxHeight: maxSide, quality: 0.8 };
  const result = camera ? await launchCamera({ ...options, saveToPhotos: false }) : await launchImageLibrary(options);
  if (result.didCancel) return null;
  if (result.errorCode) {
    if (result.errorCode === 'camera_unavailable') throw new Error('No camera is available on this phone.');
    throw new Error(result.errorCode === 'permission' ? 'Allow Memo to use your photos in Settings.' : result.errorMessage || 'Could not open your photos.');
  }
  const asset = result.assets?.[0];
  if (!asset?.uri) return null;
  if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) throw new Error('Choose a photo up to 10 MB.');
  const type = asset.type && asset.type.startsWith('image/') ? asset.type : 'image/jpeg';
  return { uri: asset.uri, type, name: asset.fileName || 'photo.jpg' };
}
