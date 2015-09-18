var https = require('https'),
    aws4  = require('aws4'),
    utils = require('./utils.js');

function AWSApiGateway(region, accessKeyId, secretAccessKey) {
  this.region = region;
  this.accessKeyId = accessKeyId;
  this.secretAccessKey = secretAccessKey;
}

AWSApiGateway.prototype._apiRequest = function(params, callback) {
  var opts = {host: 'apigateway.' + this.region + '.amazonaws.com', path: params.url};
  var expectArray = 'expectArray' in params && !!params.expectArray;
  var payload = '';
  var sendBody = 'method' in params && params.method == 'POST';
  if (sendBody) {
    if ('data' in params) {
      payload = JSON.stringify(params.data);
    }

    opts.method = params.method;
    opts.headers = {
      'Content-Type': 'application/json',
      'Content-Length': payload.length
    };

    opts.body = payload;

  }

  aws4.sign(opts, {
    accessKeyId: this.accessKeyId,
    secretAccessKey: this.secretAccessKey
  });

  var request = https.request(opts, function(response) {
    var body = '';
    response.on('data', function(d) {
      body += d;
    });
    response.on('end', function() {
      var parsed = JSON.parse(body);
      var responseItem = '_embedded' in parsed ? parsed._embedded.item : parsed;
      utils.truncatePropertiesRecursively(responseItem, ['_links']);
      if (expectArray && !Array.isArray(responseItem)) {
        responseItem = [responseItem];
      }
      callback(null, responseItem);
    });
  });

  if (sendBody) {
    request.write(payload);
  }

  request.end();

};

AWSApiGateway.prototype.getRestApis = function(limit, callback) {
  this._apiRequest(
    {
      url: '/restapis' + (limit ? ('?' + limit) : ''),
      expectArray: true
    },
    callback
  );
};

AWSApiGateway.prototype.getRestApiById = function(id, callback) {
  this._apiRequest(
    {url: '/restapis/' + id},
    callback
  );
};

AWSApiGateway.prototype.getResources = function(apiId, callback) {
  this._apiRequest(
    {
      url: '/restapis/' + apiId + '/resources?limit=500',
      expectArray: true
    },
    callback
  );
};

AWSApiGateway.prototype.createResource = function(apiId, parentId, pathPart, callback) {
  this._apiRequest(
    {
      url: '/restapis/' + apiId + '/resources/' + parentId,
      method: 'POST',
      data: {
        'pathPart': pathPart
      }
    },
    function (error, resource) {
      console.log(error);
      console.log(resource);
      callback(error, resource);
    }

  );
}

//AWSApiGateway.prototype.getRestApiByName = function(name, callback) {
//  this.getRestApis(
//    500,
//    function(error, response) {
//      if (error) {
//        callback(error);
//        return;
//      }
//
//      for (var i in response) {
//        if (response[i].name === name) {
//          callback(null, response[i].id);
//          return;
//        }
//      }
//
//
//    }
//  );
//};

module.exports = AWSApiGateway;