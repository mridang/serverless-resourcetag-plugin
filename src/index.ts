import Serverless from 'serverless';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore since the types are broken
import Plugin, { Logging } from 'serverless/classes/Plugin';
import {
  CloudFormationResource,
  CloudFormationResources,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore since the types are broken
} from 'serverless/plugins/aws/provider/awsProvider';

interface Tag {
  Key: string;
  Value: string;
}

class ServerlessResourceTagPlugin implements Plugin {
  public readonly hooks: Plugin.Hooks = {};
  public readonly name: string = 'serverless-resourcetag-plugin';
  private taggableResourceTypes: Set<string> = new Set();

  constructor(
    private readonly serverless: Serverless,
    private readonly _options: Serverless.Options,
    private readonly logging: Logging,
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

      for (const [resourceType, resourceDetails] of Object.entries(
        data.ResourceTypes,
      )) {
        if ('Tags' in (resourceDetails.Properties || {})) {
          this.taggableResourceTypes.add(resourceType);
        }
      }

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

    const customTags: { [key: string]: string } = {
      // @ts-expect-error since the tags doesn't exist in the types yet
      ...this.serverless.service.provider.tags,
      'sls:meta:project': serviceName,
    };

    const resources: CloudFormationResources =
      this.serverless.service.provider.compiledCloudFormationTemplate.Resources;

    const newTags: Tag[] = Object.keys(customTags).map((key) => ({
      Key: key,
      Value: customTags[key],
    }));

    const resCnt = Object.values(resources).filter(
      (res: CloudFormationResource) => this.taggableResourceTypes.has(res.Type),
    );

    Object.keys(resources).forEach((resourceKey) => {
      const resource = resources[resourceKey];
      if (this.taggableResourceTypes.has(resource.Type)) {
        if (!resource.Properties) {
          resource.Properties = {};
        }
        if (!resource.Properties.Tags) {
          resource.Properties.Tags = [];
        }

        const existingTags: Tag[] = resource.Properties.Tags!;
        if (!Array.isArray(existingTags)) {
          return;
        }

        resource.Properties.Tags = [
          ...existingTags.filter(
            (existingTag) =>
              !newTags.some((newTag) => newTag.Key === existingTag.Key),
          ),
          ...newTags,
        ];
      }
    });

    resources[`ProjectResourceGroup`] = {
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

    this.logging.log.notice(
      `Tags have been added to all ${resCnt.length} resources and resource group created`,
    );
  }
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore since the types are broken
export = ServerlessResourceTagPlugin;
