import request from 'supertest';

// Mock all services before importing app to avoid real AWS calls
jest.mock('../../services/patientContext', () => ({
  __esModule: true,
  default: {
    getContext: jest.fn().mockResolvedValue('mocked context'),
    saveContext: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/report', () => ({
  __esModule: true,
  default: {
    saveReport: jest.fn().mockResolvedValue(undefined),
    getReport: jest.fn().mockResolvedValue(null),
    getUserReports: jest.fn().mockResolvedValue([]),
    generatePDF: jest.fn().mockResolvedValue(Buffer.from('pdf')),
  },
}));

jest.mock('../../services/audit', () => ({
  __esModule: true,
  default: {
    logEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/storage', () => ({
  __esModule: true,
  default: {
    uploadFile: jest.fn().mockResolvedValue({ key: 'test-key', url: 'http://test' }),
    extractTextContent: jest.fn().mockResolvedValue('test content'),
  },
}));

jest.mock('../../services/bedrock', () => ({
  __esModule: true,
  default: {
    analyzeHealthData: jest.fn().mockResolvedValue({
      analysisText: '## AI Summary\nTest summary.\n## Key Findings\n1. Finding one\n## Recommendations\n1. Recommendation one',
      modelUsed: 'test-model',
    }),
  },
}));

import app from '../../index';

describe('GET /health', () => {
  it('returns 200 with healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('returns a timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.body.timestamp).toBeDefined();
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });

  it('returns the environment', async () => {
    const res = await request(app).get('/health');
    expect(res.body.environment).toBe('test');
  });
});

describe('GET /api/patient-context', () => {
  it('returns 200 with the saved context', async () => {
    const res = await request(app)
      .get('/api/patient-context')
      .query({ userId: 'test-user' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.context).toBe('mocked context');
  });
});

describe('POST /api/patient-context', () => {
  it('returns 200 when context is saved successfully', async () => {
    const res = await request(app)
      .post('/api/patient-context')
      .send({ userId: 'test-user', context: 'CLL, MTHFR' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when context field is missing', async () => {
    const res = await request(app)
      .post('/api/patient-context')
      .send({ userId: 'test-user' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/reports', () => {
  it('returns 200 with an empty reports array', async () => {
    const res = await request(app).get('/api/reports');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.reports)).toBe(true);
  });
});

describe('GET /api/reports/:reportId', () => {
  it('returns 404 when report does not exist', async () => {
    const res = await request(app).get('/api/reports/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('unknown routes', () => {
  it('returns 404 for unknown endpoints', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
