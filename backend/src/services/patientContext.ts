import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import config from '../utils/config';
import logger from '../utils/logger';

const TABLE_NAME = config.dynamodb.patientContextTable;

const dynamoClient = new DynamoDBClient({
  region: config.aws.region,
  ...(config.aws.endpoint && {
    endpoint: config.aws.endpoint,
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  }),
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function ensureTableExists(): Promise<void> {
  try {
    await dynamoClient.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
  } catch (error: any) {
    if (error.name !== 'ResourceNotFoundException') throw error;

    logger.info('Creating patient context table', { tableName: TABLE_NAME });
    await dynamoClient.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST',
      })
    );
  }
}

export async function getContext(userId: string): Promise<string | null> {
  await ensureTableExists();

  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { userId } })
  );

  return (result.Item?.context as string) ?? null;
}

export async function saveContext(userId: string, context: string): Promise<void> {
  await ensureTableExists();

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { userId, context, updatedAt: new Date().toISOString() },
    })
  );

  logger.info('Patient context saved', { userId });
}

export default { getContext, saveContext };
