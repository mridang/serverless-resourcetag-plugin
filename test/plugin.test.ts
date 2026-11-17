/**
 * @file Tests that the plugin tags taggable resources and adds the project resource group.
 */

import ServerlessResourceTagPlugin from '../src/index.js';
import type Plugin from 'serverless/classes/Plugin';

type Ctor = ConstructorParameters<typeof ServerlessResourceTagPlugin>;

/**
 * Builds a complete logging facade whose log methods all forward to one sink.
 *
 * @param sink - receives every log call
 * @returns a logging facade with the full Serverless shape
 */
function createLogging(sink: (...args: unknown[]) => void): Plugin.Logging {
  const progress: Plugin.Progress = {
    namespace: 'test',
    name: 'test',
    update: sink,
    info: sink,
    notice: sink,
    remove: () => undefined,
  };
  return {
    log: {
      error: sink,
      warning: sink,
      notice: sink,
      info: sink,
      debug: sink,
      verbose: sink,
      success: sink,
    },
    writeText: sink,
    progress: { get: () => progress, create: () => progress },
  };
}

interface CloudFormationResource {
  Type: string;
  Properties?: object;
}

interface CloudFormationResources {
  [logicalId: string]: CloudFormationResource;
}

describe('plugin tests', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should tag taggable resources and add the resource group', async () => {
    globalThis.fetch = async () =>
      Response.json({
        ResourceTypes: {
          'AWS::Lambda::Function': { Properties: { Tags: {} } },
          'AWS::S3::Bucket': { Properties: { Tags: {} } },
          'AWS::Logs::LogGroup': { Properties: { Tags: {} } },
          'AWS::IAM::Policy': { Properties: {} },
        },
      });
    const resources: CloudFormationResources = {
      Fn: { Type: 'AWS::Lambda::Function', Properties: { Tags: [] } },
      Bucket: {
        Type: 'AWS::S3::Bucket',
        Properties: { Tags: [{ Key: 'owner', Value: 'team-a' }] },
      },
      Logs: { Type: 'AWS::Logs::LogGroup' },
      Policy: { Type: 'AWS::IAM::Policy', Properties: {} },
    };
    const serverless = {
      service: {
        service: 'simple-service',
        provider: {
          tags: { framework: 'nodejs' },
          compiledCloudFormationTemplate: { Resources: resources },
        },
      },
    };
    const noop = () => undefined;
    const plugin = new ServerlessResourceTagPlugin(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- a full Serverless instance needs a real service load; the plugin reads only service.service and the provider's tags and template
      serverless as unknown as Ctor[0],
      {},
      createLogging(noop),
    );

    await plugin.hooks.initialize();
    plugin.hooks['after:aws:package:finalize:mergeCustomProviderResources']();

    const expectedTags = [
      { Key: 'framework', Value: 'nodejs' },
      { Key: 'sls:meta:project', Value: 'simple-service' },
    ];
    expect(resources.Fn.Properties).toEqual({ Tags: expectedTags });
    expect(resources.Bucket.Properties).toEqual({
      Tags: [{ Key: 'owner', Value: 'team-a' }, ...expectedTags],
    });
    expect(resources.Logs.Properties).toEqual({ Tags: expectedTags });
    expect(resources.Policy.Properties).not.toHaveProperty('Tags');
    expect(resources.ProjectResourceGroup).toEqual({
      Type: 'AWS::ResourceGroups::Group',
      Properties: {
        Name: 'simple-service-resource-group',
        ResourceQuery: {
          Type: 'TAG_FILTERS_1_0',
          Query: {
            ResourceTypeFilters: ['AWS::AllSupported'],
            TagFilters: [
              { Key: 'sls:meta:project', Values: ['simple-service'] },
            ],
          },
        },
      },
    });
  });
});
