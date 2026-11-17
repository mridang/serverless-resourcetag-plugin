/**
 * @file Serverless Framework plugin that tags AWS resources and creates a project resource group.
 */

import type Serverless from 'serverless';

import type Plugin from 'serverless/classes/Plugin';

import type Aws from 'serverless/plugins/aws/provider/awsProvider';

interface Tag {
  Key: string;
  Value: string;
}

class ServerlessResourceTagPlugin implements Plugin {
  public readonly hooks: Plugin.Hooks = {};
  public readonly name: string = 'serverless-resourcetag-plugin';
  private taggableResourceTypes = new Set<string>();

  constructor(
    private readonly serverless: Serverless,
    private readonly _options: Serverless.Options,
    private readonly logging: Plugin.Logging,
  ) {
    this.hooks = {
      initialize: this.initialize.bind(this),
      'after:aws:package:finalize:mergeCustomProviderResources':
        this.addTagsAndResourceGroup.bind(this),
    };
  }

  async initialize() {
    await this.loadTaggableResourceTypes();
  }

  async loadTaggableResourceTypes() {
    try {
      const response = await fetch(
        'https://d1uauaxba7bl26.cloudfront.net/latest/gzip/CloudFormationResourceSpecification.json',
      );
      const data = (await response.json()) as {
        ResourceTypes: {
          [key: string]: { Properties?: { [key: string]: unknown } };
        };
      };

      this.taggableResourceTypes = this.taggableResourceTypes.union(
        new Set(
          Object.entries(data.ResourceTypes)
            .filter(
              ([, resourceDetails]) =>
                'Tags' in (resourceDetails.Properties ?? {}),
            )
            .map(([resourceType]) => resourceType),
        ),
      );

      this.logging.log.notice('Loaded taggable resource types');
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logging.log.error(
          `Failed to load CloudFormation resource specification: ${error.message}`,
        );
      } else {
        this.logging.log.error('An unknown error occurred');
      }
    }
  }

  addTagsAndResourceGroup() {
    const serviceName: string = this.serverless.service.service || 'serverless';

    if (!this.serverless.service.provider.compiledCloudFormationTemplate) {
      this.logging.log.error('No compiled CloudFormation template found');
      return;
    }

    // The Serverless typings omit the provider's tags, so the source is typed once here.
    const { tags: providerTags } = this.serverless.service.provider as {
      tags?: { [key: string]: string };
    };
    const customTags = {
      ...providerTags,
      'sls:meta:project': serviceName,
    };

    const resources: Aws.CloudFormationResources =
      this.serverless.service.provider.compiledCloudFormationTemplate.Resources;

    const nextTags: Tag[] = Object.entries(customTags).map(([Key, Value]) => ({
      Key,
      Value,
    }));

    const resCnt = Object.values(resources).filter((res) =>
      this.taggableResourceTypes.has(res.Type),
    );

    // eslint-disable-next-line functional/no-loop-statements -- the compiled template owned by Serverless is updated in place
    for (const resource of Object.values(resources)) {
      const existingTags: Tag[] = resource.Properties?.Tags || [];
      if (
        this.taggableResourceTypes.has(resource.Type) &&
        Array.isArray(existingTags)
      ) {
        // eslint-disable-next-line functional/immutable-data -- the compiled template owned by Serverless is updated in place
        resource.Properties = {
          ...resource.Properties,
          Tags: [
            ...existingTags.filter(
              (existingTag) =>
                !nextTags.some((nextTag) => nextTag.Key === existingTag.Key),
            ),
            ...nextTags,
          ],
        };
      }
    }

    // eslint-disable-next-line functional/immutable-data -- the compiled template owned by Serverless is updated in place
    resources.ProjectResourceGroup = {
      Type: 'AWS::ResourceGroups::Group',
      Properties: {
        Name: `${serviceName}-resource-group`,
        ResourceQuery: {
          Type: 'TAG_FILTERS_1_0',
          Query: {
            ResourceTypeFilters: ['AWS::AllSupported'],
            TagFilters: [
              {
                Key: 'sls:meta:project',
                Values: [serviceName],
              },
            ],
          },
        },
      },
    };

    this.logging.log.success(
      `Tags have been added to all ${resCnt.length} resources and resource group created`,
    );
  }
}

export default ServerlessResourceTagPlugin;
