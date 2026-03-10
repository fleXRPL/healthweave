// Ensure tests never hit real AWS or LocalStack
process.env['NODE_ENV'] = 'test';
process.env['AWS_ENDPOINT'] = '';
process.env['AWS_REGION'] = 'us-east-1';
process.env['ANTHROPIC_API_KEY'] = '';
process.env['JWT_SECRET'] = 'test-secret';
process.env['ENCRYPTION_KEY'] = 'test-encryption-key-32-chars!!!!';
