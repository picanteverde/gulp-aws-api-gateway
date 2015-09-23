var forEachCallback = require('./for-each-callback.js');
var _ = require('lodash');

module.exports = function(awsApiGateway, gutil) {

  var generateResourceTree = require('./resource-tree-builder.js')(awsApiGateway);

  var log = function(){},
      throwError = function(){};

  if (gutil === undefined) {
    log = console.log;
    throwError = console.error;
  } else if (typeof gutil === 'object') {
    log = gutil.log;
    //throwError =
  }

  function getApiIdByName(apiName, callback) {
    awsApiGateway.getRestApis(null, function(error, apis) {
      for (var i in apis) {
        if (apis[i].name === apiName) {
          callback(null, apis[i].id);
          return;
        }
      }

      callback("API with the specified name couldn't been found.");
    });
  }

  function generateMethods(apiId, structure, callback) {
    awsApiGateway.getResources(
      apiId,
      function(error, resources) {
        forEachCallback(
          Object.keys(structure),
          function (path, nextStep) {
            var resourceId = _.find(resources, {'path': path}).id;

            awsApiGateway.getMethods(
              apiId,
              resourceId,
              function(error, methods) {
                if (error) {
                  nextStep(error);
                  return;
                }

                forEachCallback(
                  Object.keys(structure[path]),
                  function (httpMethod, nextStep) {
                    httpMethod = httpMethod.toUpperCase();
                    if (-1 !== methods.indexOf(httpMethod)) {
                      nextStep();
                      return;
                    }

                    console.log('Creating ' + httpMethod + ' method in: ' + path + '...');
                    awsApiGateway.createMethod(apiId, resourceId, httpMethod, nextStep);
                  },
                  nextStep
                );
              }
            );

          },
          callback
        );
      }
    );
  }

  function removeUnusedMethods(apiId, structure, callback) {
    awsApiGateway.getResources(
      apiId,
      function(error, resources) {
        forEachCallback(
          resources,
          function (resource, nextStep) {
            awsApiGateway.getMethods(
              apiId,
              resource.id,
              function(error, methods) {
                if (error) {
                  nextStep(error);
                  return;
                }

                forEachCallback(
                  methods,
                  function(method, nextStep) {
                    if (
                      resource.path in structure &&
                      method.toLowerCase() in structure[resource.path]
                    ) {
                      nextStep();
                      return;
                    }

                    console.log('Removing unused ' + method + ' method in ' + resource.path + '...');
                    awsApiGateway.deleteMethod(apiId, resource.id, method, nextStep);

                  },
                  nextStep
                );

              }
            );
          },
          callback
        );
      }
    );
  }


  return function ApiSpecBuilder(spec, callback) {
    getApiIdByName(
      spec.apiName,
      function(error, apiId) {
        if (error) return throwError(error);

        console.log('Updating resources tree structure...');
        generateResourceTree(
          apiId,
          Object.keys(spec.structure)
        )
          .then(function() {
            console.log('Resource tree structure is up to date.');

            console.log('Updating HTTP methods...');
            removeUnusedMethods(apiId, spec.structure, function(error) {
              generateMethods(apiId, spec.structure, callback);
            });
          })
          .catch(function(error) {
            console.error('Resource tree generation failed!');
          })
        ;



      }
    );
  };

};