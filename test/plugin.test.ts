import runServerless from '@serverless/test/run-serverless';
import path from 'path';
// @ts-expect-error since the types are missing
import logEmitter from 'log/lib/emitter.js';
import * as fs from 'node:fs';
import {
  CloudFormationResource,
  CloudFormationResources,
} from 'serverless/plugins/aws/provider/awsProvider';

const logsBuffer: string[] = [];
logEmitter.on(
  'log',
  (event: { logger: { namespace: string }; messageTokens: string[] }) => {
    if (
      !event.logger.namespace.startsWith('serverless:lifecycle') &&
      event.logger.namespace !== 'serverless'
    ) {
      logsBuffer.push(event.messageTokens[0]);
    }
  },
);

describe('plugin tests', () => {
  it('should run resourcetag on package', async () => {
    await runServerless(path.join(require.resolve('serverless'), '..', '..'), {
      cwd: path.resolve(__dirname, 'fixtures', 'simple-service'),
      command: 'package',
    });

    const compiledTemplatePath = path.resolve(
      __dirname,
      'fixtures',
      'simple-service',
      '.serverless',
      'cloudformation-template-update-stack.json',
    );
    const compiledTemplate = JSON.parse(
      fs.readFileSync(compiledTemplatePath, 'utf-8'),
    );

    const resources: CloudFormationResources = compiledTemplate.Resources;
    const taggedResourceTypes = new Set([
      'AWS::Lambda::Function',
      'AWS::S3::Bucket',
      'AWS::Logs::LogGroup',
      'AWS::IAM::Role',
    ]);

    Object.entries(resources).forEach(
      ([, resource]: [string, CloudFormationResource]) => {
        if (taggedResourceTypes.has(resource.Type)) {
          expect(resource.Properties).toHaveProperty(
            'Tags',
            expect.arrayContaining([
              { Key: 'framework', Value: 'nodejs' },
              { Key: 'sls:meta:project', Value: 'simple-service' },
            ]),
          );
        } else {
          expect(resource.Properties).not.toHaveProperty('Tags');
        }
      },
    );

    expect(resources['ProjectResourceGroup']).toEqual({
      Type: 'AWS::ResourceGroups::Group',
      Properties: {
        Name: 'simple-service-resource-group',
        ResourceQuery: {
          Type: 'TAG_FILTERS_1_0',
          Query: {
            ResourceTypeFilters: ['AWS::AllSupported'],
            TagFilters: [
              {
                Key: 'sls:meta:project',
                Values: ['simple-service'],
              },
            ],
          },
        },
      },
    });
  });
});
