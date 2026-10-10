import Toast from '@ant-design/react-native/lib/toast';
import { getErrorMessage } from '../../utils/apiError';
import { pickPhoto } from './pickPhoto';
import { useDeletePhotoMutation, useUploadPhotoMutation } from './usersApi';

/** Add, change or remove the profile photo, with friendly messages. */
export function usePhotoActions() {
  const [upload, uploading] = useUploadPhotoMutation();
  const [remove, removing] = useDeletePhotoMutation();

  const change = async () => {
    try {
      const picked = await pickPhoto();
      if (!picked) return;
      await upload(picked).unwrap();
      Toast.success('Photo updated', 1.2);
    } catch (err) {
      Toast.fail(err instanceof Error ? err.message : getErrorMessage(err), 2);
    }
  };

  const clear = async () => {
    try {
      await remove().unwrap();
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  return { change, clear, uploading: uploading.isLoading, removing: removing.isLoading };
}
