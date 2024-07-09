A plugin for the Serverless framework to automatically add tags to
all the resources in the project.

### Why?

The Serverless Framework does support tagging but tags are only applied
upon creation. Any changes to the changes are not reflected in the stack
resources. This is a rather crippling limitation.

Maintaining tags across all the project resources can be tedious.
To further complicate things, not all AWS resources support tagging.
This project gets around these by dynamically fetching the latest
Cloudformation schema from AWS, introspecting all the resources that
support tagging and then dynamically adding the tags to the
resources.

The plugin also uses Resource Groups to ensure that you can see
all the project resources. For more information, see
https://docs.aws.amazon.com/ARG/latest/userguide/resource-groups.html

> [!NOTE]
> This plugin has only been tested with the AWS provider and will
> not work if you are deploying to other providers e.g. GCP.

## Installation

Install using NPM by using the following command

```sh
npm install --save-dev @mridang/serverless-resourcetag-plugin
```

And then add the plugin to your `serverless.yml` file:

```yaml
plugins:
  - @mridang/serverless-resourcetag-plugin
```

A thorough guide on installing plugins can be found at
https://www.serverless.com/framework/docs-guides-plugins

## Usage

On the provider level, use the `tags` property to add the
necessary tags. This is used by the plugin and applied to all
resources automatically. These tags are automatically applied to
all resources - both ones created by the framework and any other
resources you might have added in the `resources` block.

```
$ sls deploy

Packaging aws-node-project for stage dev (us-east-1)

✔ Service packaged (12s)
```

## Contributing

If you have suggestions for how this app could be improved, or
want to report a bug, open an issue - we'd love all and any
contributions.

## License

Apache License 2.0 © 2024 Mridang Agarwalla
