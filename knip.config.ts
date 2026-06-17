export default {
  entry: ['src/index.ts', 'src/lambda.ts'],
  ignore: ['test/serverless.d.ts', 'test/fixtures/**/index.js'],
  ignoreDependencies: [/^@semantic-release\//],
};
