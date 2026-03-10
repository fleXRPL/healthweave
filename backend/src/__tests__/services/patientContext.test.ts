import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, DescribeTableCommand, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

// Mock both the raw DynamoDB client and the document client
const ddbRawMock = mockClient(DynamoDBClient);
const ddbDocMock = mockClient(DynamoDBDocumentClient);

// Import after mocks are set up
import { getContext, saveContext } from '../../services/patientContext';

beforeEach(() => {
  ddbRawMock.reset();
  ddbDocMock.reset();
  // Default: table already exists
  ddbRawMock.on(DescribeTableCommand).resolves({});
});

describe('patientContext.getContext', () => {
  it('returns null when no item exists for the user', async () => {
    ddbDocMock.on(GetCommand).resolves({ Item: undefined });

    const result = await getContext('test-user');
    expect(result).toBeNull();
  });

  it('returns the saved context string when item exists', async () => {
    ddbDocMock.on(GetCommand).resolves({
      Item: { userId: 'test-user', context: 'CLL, MTHFR, liver disease' },
    });

    const result = await getContext('test-user');
    expect(result).toBe('CLL, MTHFR, liver disease');
  });

  it('returns null when item exists but context field is missing', async () => {
    ddbDocMock.on(GetCommand).resolves({
      Item: { userId: 'test-user' },
    });

    const result = await getContext('test-user');
    expect(result).toBeNull();
  });

  it('creates the table if it does not exist, then gets context', async () => {
    ddbRawMock.reset();
    ddbRawMock
      .on(DescribeTableCommand)
      .rejectsOnce({ name: 'ResourceNotFoundException' })
      .on(CreateTableCommand)
      .resolves({});
    ddbDocMock.on(GetCommand).resolves({ Item: undefined });

    const result = await getContext('new-user');
    expect(result).toBeNull();
    expect(ddbRawMock.commandCalls(CreateTableCommand).length).toBe(1);
  });

  it('rethrows unexpected DynamoDB errors', async () => {
    ddbRawMock.reset();
    ddbRawMock.on(DescribeTableCommand).rejectsOnce({ name: 'ServiceUnavailableException' });

    await expect(getContext('test-user')).rejects.toMatchObject({
      name: 'ServiceUnavailableException',
    });
  });
});

describe('patientContext.saveContext', () => {
  it('saves context to DynamoDB without throwing', async () => {
    ddbDocMock.on(PutCommand).resolves({});

    await expect(saveContext('test-user', 'CLL, MTHFR')).resolves.toBeUndefined();
    expect(ddbDocMock.commandCalls(PutCommand).length).toBe(1);
  });

  it('saves the correct userId and context', async () => {
    ddbDocMock.on(PutCommand).resolves({});

    await saveContext('test-user', 'CLL, MTHFR, liver disease');

    const call = ddbDocMock.commandCalls(PutCommand)[0];
    expect(call.args[0].input.Item?.['userId']).toBe('test-user');
    expect(call.args[0].input.Item?.['context']).toBe('CLL, MTHFR, liver disease');
  });

  it('saves an updatedAt timestamp', async () => {
    ddbDocMock.on(PutCommand).resolves({});
    await saveContext('test-user', 'some context');

    const call = ddbDocMock.commandCalls(PutCommand)[0];
    expect(call.args[0].input.Item?.['updatedAt']).toBeDefined();
  });

  it('can save an empty string (clearing context)', async () => {
    ddbDocMock.on(PutCommand).resolves({});
    await expect(saveContext('test-user', '')).resolves.toBeUndefined();
  });
});
