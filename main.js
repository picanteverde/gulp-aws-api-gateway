const PLUGIN_NAME = 'gulp-aws-api-gateway';

var through = require('through2');
var gutil = require('gulp-util');
var PluginError = gutil.PluginError;

var AWSApiGateway = require('./aws-api-gateway.js');
var specBuilder = require('./api-spec-builder.js');
var yaml = require('js-yaml');

function gulpAwsApiGateway(awsCredentials) {

  var buildSpec;

  const requiredParams = [
    'region',
    'accessKeyId',
    'secretAccessKey'
  ];

  if (!awsCredentials) {
    throw new PluginError(PLUGIN_NAME, 'Missing AWS credentials!');
  }

  for (var i in requiredParams) {
    if (requiredParams[i] in awsCredentials) {
      continue;
    }

    throw new PluginError(PLUGIN_NAME, 'Missing "' + requiredParams[i] + '" parameter in AWS credentials.');
  }

  buildSpec = specBuilder(new AWSApiGateway(
    awsCredentials.region,
    awsCredentials.accessKeyId,
    awsCredentials.secretAccessKey
  ), gutil.log, function(error) {
    throw new PluginError(PLUGIN_NAME, error);
  });

  return through.obj(function(file, enc, cb) {
    if (file.isNull()) {
      return cb(null, file);
    }

    var fileExt = file.history[0].split('.').pop().toLowerCase();
    var spec;

    switch (fileExt) {
      case 'yml':
      case 'yaml':
        spec = yaml.safeLoad(file.contents);
        break;

      case 'json':
        spec = JSON.parse(file.contents);
        break;

      default:
        cb(null, file);
        return;
    }

    buildSpec(spec).then(
      function() {
        cb(null, file);
      },
      function(error) {
        cb(error);
      }
    );

  });

}

// Exporting the plugin main function
module.exports = gulpAwsApiGateway;