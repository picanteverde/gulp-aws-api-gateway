var https = require('https'),
    aws4  = require('aws4'),
    utils = require('./utils.js'),
    Promise = require("bluebird"),
    objectMerge = require('object-merge');

function AWSApiGateway(region, accessKeyId, secretAccessKey) {
  this.region = region;
  this.accessKeyId = accessKeyId;
  this.secretAccessKey = secretAccessKey;
}

AWSApiGateway.INTEGRATION_TYPE_HTTP = 'HTTP';
AWSApiGateway.INTEGRATION_TYPE_LAMBDA = 'lambda';
AWSApiGateway.INTEGRATION_TYPE_MOCK = 'mock';
AWSApiGateway.INTEGRATION_TYPE_AWS = 'aws';

AWSApiGateway.AUTHORIZATION_TYPE_NONE = 'NONE';
AWSApiGateway.AUTHORIZATION_TYPE_AWS_IAM = 'AWS_IAM';


AWSApiGateway.prototype._apiRequest = function(params, callback) {
  var gatewayInstance = this;
  var promise = new Promise(function(resolve, reject) {
    var opts = {host: 'apigateway.' + gatewayInstance.region + '.amazonaws.com', path: params.url};
    var expectArray = 'expectArray' in params && !!params.expectArray;
    var payload = '';

    if ('method' in params) {
      opts.method = params.method;
    }

    console.log(params.url);

    var sendBody = 'method' in params && (-1 !== ['POST', 'PUT'].indexOf(params.method));
    if (sendBody) {
      if ('data' in params) {
        payload = JSON.stringify(params.data);
      }

      opts.headers = {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      };

      opts.body = payload;

    }

    aws4.sign(opts, {
      accessKeyId: gatewayInstance.accessKeyId,
      secretAccessKey: gatewayInstance.secretAccessKey
    });

    var request = https.request(opts, function(response) {
      var body = '';
      response.on('data', function(d) {
        body += d;
      });
      response.on('end', function() {
        var parsed,
          responseItem;

        if ('log' in params) {
          console.log(body);
        }

        if (body.length === 0) {
          resolve();
          return;
        }

        try {parsed = JSON.parse(body);} catch (e) {
          reject(e);
          return;
        }

        responseItem = ('_embedded' in parsed && 'item' in parsed._embedded) ? parsed._embedded.item : parsed;
        if ((false === 'links' in params) || !params.links) {
          utils.truncatePropertiesRecursively(responseItem, ['_links']);
        }
        if (expectArray && !Array.isArray(responseItem)) {
          responseItem = [responseItem];
        }
        resolve(responseItem);
      });
    });

    if (sendBody) {
      request.write(payload);
    }

    request.end();
  });

  if (callback) {
    promise.then(
      function(result) {
        callback(null, result);
      },
      callback
    );
  }

  return promise;

};

AWSApiGateway.prototype.getRestApis = function(limit, callback) {
  return this._apiRequest(
    {
      url: '/restapis' + (limit ? ('?' + limit) : ''),
      expectArray: true
    },
    callback
  );
};

AWSApiGateway.prototype.getRestApiById = function(id, callback) {
  return this._apiRequest(
    {url: '/restapis/' + id},
    callback
  );
};

AWSApiGateway.prototype.getResources = function(apiId, callback) {
  return this._apiRequest(
    {
      url: '/restapis/' + apiId + '/resources?limit=500',
      expectArray: true
    },
    callback
  );
};

AWSApiGateway.prototype.createResource = function(apiId, parentId, pathPart, callback) {
  return this._apiRequest(
    {
      url: '/restapis/' + apiId + '/resources/' + parentId,
      method: 'POST',
      data: {
        'pathPart': pathPart
      }
    },
    callback
  );
};

AWSApiGateway.prototype.deleteResource = function(apiId, resourceId, callback) {
  return this._apiRequest(
    {
      url: '/restapis/' + apiId + '/resources/' + resourceId,
      method: 'DELETE'
    },
    callback
  );
};

AWSApiGateway.prototype.getMethods = function(apiId, resourceId, callback) {
  var gatewayInstance = this;
  var promise = gatewayInstance._apiRequest(
      {
        url: '/restapis/' + apiId + '/resources/' + resourceId + '?embed',
        links: true
      }
    )
      .then(
        function(resource) {
          if (false === 'resource:methods' in resource._links) {
            return [];
          }

          if (false === Array.isArray(resource._links['resource:methods'])) {
            return [resource._links['resource:methods'].name];
          }

          return resource._links['resource:methods'].map(
            function(methodLink){
              return methodLink.name;
            }
          );

        }
      );


  if (callback) {
    promise.then(
      function(methods) {
        callback(null, methods);
      },
      callback
    );
  }

  return promise;


  //return this._apiRequest(
  //  {url: '/restapis/' + apiId + '/resources/' + resourceId + '/methods'},
  //  callback
  //);
};

AWSApiGateway.prototype.getMethod = function(apiId, resourceId, httpMethod, callback) {
  return this._apiRequest(
    {url: '/restapis/' + apiId + '/resources/' + resourceId + '/methods/' + httpMethod},
    callback
  );
};

AWSApiGateway.prototype.putIntegration = function(apiId, resourceId, httpMethod, config, callback) {
  return this._apiRequest(
    {
      url: '/restapis/' + apiId + '/resources/' + resourceId + '/methods/' + httpMethod + '/integration',
      method: 'PUT',
      data: config
    },
    callback
  );
};

AWSApiGateway.prototype.getIntegration = function(apiId, resourceId, httpMethod, callback) {
  return this._apiRequest(
    {url: '/restapis/' + apiId + '/resources/' + resourceId + '/methods/' + httpMethod + '/integration'},
    callback
  );
};

AWSApiGateway.prototype.createMethod = function(apiId, resourceId, config, callback) {
  var gatewayInstance = this,
      promise,
      httpMethod,
      methodConfig = {
        "apiKeyRequired": false,
        "authorizationType": AWSApiGateway.AUTHORIZATION_TYPE_NONE,
        "requestParameters": {},
        "requestModels": {}
      };

  if (typeof config === 'string') {
    httpMethod = config;
  } else {
    for (var key in config) {
      if (key === 'httpMethod') {
        httpMethod = config[key];
        continue;
      }
      if (key === 'integration') {
        continue;
      }
      methodConfig[key] = config[key];
    }

    if (!httpMethod) {
      const errorMessage = 'No "httpMethod" provided in "config" parameter.';
      if (callback) {
        process.nextTick(function () {
          callback(errorMessage);
        });
      }

      return Promise.reject(errorMessage);
    }
  }

  return promiseToCallback(
    this._apiRequest(
      {
        url: '/restapis/' + apiId + '/resources/' + resourceId + '/methods/' + httpMethod,
        method: 'PUT',
        data: methodConfig
      }
    ).then(
      function(result) {
        if ('integration' in config) {
          return gatewayInstance.createIntegration(apiId, resourceId, httpMethod, config.integration);
        }

        return result;
      }
    ),
    callback
  );

};

AWSApiGateway.prototype.createIntegration = function(apiId, resourceId, httpMethod, config, callback) {

  const integrationDefaults = {
    type: AWSApiGateway.INTEGRATION_TYPE_HTTP,
    httpMethod: httpMethod,
    uri: '' //,
    //credentials: AWSApiGateway.AUTHORIZATION_TYPE_NONE,
    //requestParameters: {},
    //requestTemplates: {},
    //cacheNamespace: resourceId,
    //cacheKeyParameters: []
  };

  return promiseToCallback(
    this._apiRequest(
      {
        url: '/restapis/' + apiId + '/resources/' + resourceId + '/methods/' + httpMethod + '/integration',
        method: 'PUT',
        data: objectMerge(integrationDefaults, config)
      }
    ),
    callback
  );

};


AWSApiGateway.prototype.deleteMethod = function(apiId, resourceId, httpMethod, callback) {
  return this._apiRequest(
    {
      url: '/restapis/' + apiId + '/resources/' + resourceId + '/methods/' + httpMethod,
      method: 'DELETE'
    },
    callback
  );
};

/**
 * Connects promise to Node.js old callback pattern if callback is present.
 * @param promise
 * @param callback
 * @returns {*}
 */
function promiseToCallback(promise, callback) {
  if (callback) {
    promise = promise.then(
      function(result) {
        callback(null, result);
      },
      function(error) {
        callback(error);
      }
    );

    return promise;
  }

  return promise;
}

module.exports = AWSApiGateway;
