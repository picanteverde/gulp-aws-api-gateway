var https = require('https'),
    aws4  = require('aws4'),
    utils = require('./utils.js'),
    Promise = require("bluebird");

function AWSApiGateway(region, accessKeyId, secretAccessKey) {
  this.region = region;
  this.accessKeyId = accessKeyId;
  this.secretAccessKey = secretAccessKey;
}

AWSApiGateway.prototype._apiRequest = function(params, callback) {
  var gatewayInstance = this;
  var promise = new Promise(function(resolve, reject) {
    var opts = {host: 'apigateway.' + gatewayInstance.region + '.amazonaws.com', path: params.url};
    var expectArray = 'expectArray' in params && !!params.expectArray;
    var payload = '';

    if ('method' in params) {
      opts.method = params.method;
    }

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
  return this._apiRequest(
    {
      url: '/restapis/' + apiId + '/resources/' + resourceId + '?embed',
      links: true
    },
    function(error, resource) {
      if (error) {
        callback(error);
        return;
      }

      if (false === 'resource:methods' in resource._links) {
        callback(null, []);
        return;
      }

      if (false === Array.isArray(resource._links['resource:methods'])) {
        callback(null, [resource._links['resource:methods'].name]);
        return;
      }

      callback(
        null,
        resource._links['resource:methods'].map(
          function(methodLink){
            return methodLink.name;
          }
        )
      );
    }
  );

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

AWSApiGateway.prototype.createMethod = function(apiId, resourceId, config, callback) {
  var httpMethod,
      methodConfig = {
        "apiKeyRequired": false,
        "authorizationType": 'NONE',
        "requestParameters": {},
        "requestModels": {}
      };

  if (typeof config === 'string') {
    httpMethod = config;
  } else {
    for (var key in config) {
      if (key === 'httpMethod') {
        httpMethod = methodConfig[key];
      }
      methodConfig[key] = config[key];
    }

    if (!httpMethod) {
      process.nextTick(function() {
        callback('No "httpMethod" provided in "config" parameter.');
      });
      return;
    }
  }

  return this._apiRequest(
    {
      url: '/restapis/' + apiId + '/resources/' + resourceId + '/methods/' + httpMethod,
      method: 'PUT',
      data: methodConfig
    },
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

module.exports = AWSApiGateway;