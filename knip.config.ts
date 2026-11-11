/**
 * @file Knip configuration that declares the entry points and ignored files for the project.
 */

export default {
  entry: ['src/index.ts', 'src/lambda.ts'],
  ignore: ['test/serverless.d.ts', 'test/fixtures/**/index.js'],
  ignoreDependencies: [/^@semantic-release\//],
};
