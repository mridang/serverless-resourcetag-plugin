module.exports = {
  entry: ['src/index.ts'],
  ignore: ['test/serverless.d.ts', 'test/fixtures/**'],
  ignoreDependencies: ['@semantic-release/.+'],
};
