module.exports = {
  artifactsDir: 'build',
  ignoreFiles: [
    'build',
    'config',
    'src',
    'package*.json',
    '*config.js',
    '*config.json'
  ],
  sign: {
    apiKey: process.env.AMO_JWT_ISSUER,
    apiSecret: process.env.AMO_JWT_SECRET
  }
};
