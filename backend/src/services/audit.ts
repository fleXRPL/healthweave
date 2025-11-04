import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import config from '../utils/config';
import logger from '../utils/logger';
import { AuditLog } from '../types';

class AuditService {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
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

    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = config.dynamodb.auditTable;

    // Initialize table (for LocalStack)
    if (config.aws.endpoint) {
      this.initializeTable();
    }
  }

  /**
   * Initialize DynamoDB table (for LocalStack development)
   */
  private async initializeTable(): Promise<void> {
    try {
      // Check if table exists
      const describeCommand = new DescribeTableCommand({ TableName: this.tableName });
      await this.client.send(describeCommand as any);
      logger.info('Audit log table already exists', { table: this.tableName });
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        // Create table
        try {
          const createCommand = new CreateTableCommand({
            TableName: this.tableName,
            KeySchema: [
              { AttributeName: 'id', KeyType: 'HASH' },
              { AttributeName: 'timestamp', KeyType: 'RANGE' },
            ],
            AttributeDefinitions: [
              { AttributeName: 'id', AttributeType: 'S' },
              { AttributeName: 'timestamp', AttributeType: 'N' },
              { AttributeName: 'userId', AttributeType: 'S' },
            ],
            GlobalSecondaryIndexes: [
              {
                IndexName: 'UserIdIndex',
                KeySchema: [
                  { AttributeName: 'userId', KeyType: 'HASH' },
                  { AttributeName: 'timestamp', KeyType: 'RANGE' },
                ],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: {
                  ReadCapacityUnits: 5,
                  WriteCapacityUnits: 5,
                },
              },
            ],
            BillingMode: 'PROVISIONED',
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          });

          await this.client.send(createCommand as any);
          logger.info('Audit log table created successfully', { table: this.tableName });
        } catch (createError) {
          logger.error('Failed to create audit log table', { error: createError });
        }
      } else {
        logger.error('Error checking audit log table', { error });
      }
    }
  }

  /**
   * Log an audit event
   */
  async logEvent(
    userId: string,
    action: string,
    resource: string,
    success: boolean,
    details?: Record<string, any>,
    request?: any
  ): Promise<void> {
    const auditLog: AuditLog = {
      id: uuidv4(),
      timestamp: new Date(),
      userId,
      action,
      resource,
      ipAddress: request?.ip,
      userAgent: request?.get('user-agent'),
      success,
      details,
    };

    try {
      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          ...auditLog,
          timestamp: auditLog.timestamp.getTime(), // Store as number for range queries
        },
      });

      await this.client.send(command);

      logger.debug('Audit event logged', {
        userId,
        action,
        resource,
        success,
      });
    } catch (error) {
      // Don't throw - audit logging failure shouldn't break the main operation
      logger.error('Failed to log audit event', {
        error,
        userId,
        action,
        resource,
      });
    }
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLogs(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<AuditLog[]> {
    try {
      const params: any = {
        TableName: this.tableName,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
      };

      // Add date filters if provided
      if (startDate || endDate) {
        if (startDate && endDate) {
          params.KeyConditionExpression += ' AND #ts BETWEEN :startDate AND :endDate';
          params.ExpressionAttributeValues[':startDate'] = startDate.getTime();
          params.ExpressionAttributeValues[':endDate'] = endDate.getTime();
        } else if (startDate) {
          params.KeyConditionExpression += ' AND #ts >= :startDate';
          params.ExpressionAttributeValues[':startDate'] = startDate.getTime();
        } else if (endDate) {
          params.KeyConditionExpression += ' AND #ts <= :endDate';
          params.ExpressionAttributeValues[':endDate'] = endDate.getTime();
        }
        params.ExpressionAttributeNames = { '#ts': 'timestamp' };
      }

      const command = new QueryCommand(params);
      const response = await this.client.send(command);

      if (!response.Items) {
        return [];
      }

      // Convert timestamp back to Date
      return response.Items.map((item) => ({
        ...item,
        timestamp: new Date(item.timestamp),
      })) as AuditLog[];
    } catch (error) {
      logger.error('Error retrieving audit logs', { error, userId });
      throw new Error('Failed to retrieve audit logs');
    }
  }

  /**
   * Get a specific audit log by ID
   */
  async getAuditLog(id: string, timestamp: number): Promise<AuditLog | null> {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { id, timestamp },
      });

      const response = await this.client.send(command);

      if (!response.Item) {
        return null;
      }

      return {
        ...response.Item,
        timestamp: new Date(response.Item.timestamp),
      } as AuditLog;
    } catch (error) {
      logger.error('Error retrieving audit log', { error, id });
      throw new Error('Failed to retrieve audit log');
    }
  }
}

export default new AuditService();
