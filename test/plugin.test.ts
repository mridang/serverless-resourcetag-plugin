import ServerlessResourceTagPlugin from '../src/index';

type Ctor = ConstructorParameters<typeof ServerlessResourceTagPlugin>;

describe('plugin tests', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should tag taggable resources and add the resource group', async () => {
    globalThis.fetch = (async () => ({
      json: async () => ({
        ResourceTypes: {
          'AWS::Lambda::Function': { Properties: { Tags: {} } },
          'AWS::S3::Bucket': { Properties: { Tags: {} } },
          'AWS::Logs::LogGroup': { Properties: { Tags: {} } },
          'AWS::IAM::Policy': { Properties: {} },
        },
      }),
    })) as unknown as typeof fetch;
    const resources: Record<string, { Type: string; Properties?: object }> = {
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
    const logging = { log: { notice: noop, error: noop, success: noop } };
    const plugin = new ServerlessResourceTagPlugin(
      serverless as unknown as Ctor[0],
      {} as Ctor[1],
      logging as unknown as Ctor[2],
    );

    await (plugin.hooks['initialize'] as () => Promise<void>)();
    (
      plugin.hooks[
        'after:aws:package:finalize:mergeCustomProviderResources'
      ] as () => void
    )();

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
    expect(resources['ProjectResourceGroup']).toEqual({
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
