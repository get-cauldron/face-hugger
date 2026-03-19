import { createRepo, deleteFile, deleteRepo } from '@huggingface/hub';
import { useAuthStore } from '../stores/authStore';

export async function createRepoAction(params: {
  name: string;
  type: 'model' | 'dataset';
  isPrivate: boolean;
  license?: string;
  description?: string;
}) {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Not authenticated');
  return createRepo({
    repo: { name: params.name, type: params.type },
    private: params.isPrivate,
    license: params.license,
    accessToken: token,
  });
}

export async function deleteFileAction(params: {
  repoId: string;
  repoType: 'model' | 'dataset';
  path: string;
  commitTitle?: string;
}) {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Not authenticated');
  return deleteFile({
    repo: { name: params.repoId, type: params.repoType },
    path: params.path,
    commitTitle: params.commitTitle ?? `Delete ${params.path}`,
    accessToken: token,
  });
}

export async function deleteRepoAction(params: {
  repoId: string;
  repoType: 'model' | 'dataset';
}) {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Not authenticated');
  return deleteRepo({
    repo: { name: params.repoId, type: params.repoType },
    accessToken: token,
  });
}
