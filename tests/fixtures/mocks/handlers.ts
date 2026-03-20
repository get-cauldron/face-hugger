import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://huggingface.co/api/whoami-v2', () =>
    HttpResponse.json({
      name: 'testuser',
      fullname: 'Test User',
      avatarUrl: 'https://example.com/avatar.png',
      email: 'test@example.com',
      type: 'user',
    })
  ),

  http.get('https://huggingface.co/api/models', () =>
    HttpResponse.json([
      {
        id: 'abc123',
        modelId: 'testuser/test-model',
        private: false,
        downloads: 100,
        likes: 10,
        lastModified: '2026-01-01T00:00:00Z',
        tags: ['pytorch'],
      },
    ])
  ),

  http.get('https://huggingface.co/api/datasets', () =>
    HttpResponse.json([
      {
        id: 'def456',
        datasetId: 'testuser/test-dataset',
        private: false,
        downloads: 50,
        likes: 5,
        lastModified: '2026-01-01T00:00:00Z',
        tags: ['csv'],
      },
    ])
  ),
];
