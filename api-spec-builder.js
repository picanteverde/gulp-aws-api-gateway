var asyncForEach = require('./async-for-each.js');
var _ = require('lodash');
var Promise = require('bluebird');

module.exports = function(awsApiGateway, log, throwError) {

  if (!log) {
    log = console.log.bind(console);
  }
  if (!throwError) {
    throwError = console.error.bind(console);
  }

  var generateResourceTree = require('./resource-tree-builder.js')(awsApiGateway, log, throwError);
  
  function getApiIdByName(apiName) {
    return awsApiGateway.getRestApis()
      .then(
        function(apis) {
          for (var i in apis) {
            if (apis[i].name === apiName) {
              return Promise.resolve(apis[i].id);
            }
          }

          return Promise.reject("API with the specified name couldn't been found.");
        }
      );
  }

  function generateMethods(apiId, structure) {
    return awsApiGateway.getResources(apiId)
      .then(
        function(resources) {
          return asyncForEach(
            Object.keys(structure),
            function (path) {
              var resourceId = _.find(resources, {'path': path}).id;

              return awsApiGateway.getMethods(apiId, resourceId)
                .then(
                  function(methods) {
                    return asyncForEach(
                      Object.keys(structure[path]),
                      function (httpMethod) {
                        httpMethod = httpMethod.toUpperCase();
                        if (-1 !== methods.indexOf(httpMethod)) {
                          return Promise.resolve();
                        }

                        log('Creating ' + httpMethod + ' method in: ' + path + '...');
                        return awsApiGateway.createMethod(apiId, resourceId, httpMethod);
                      }
                    );
                  }
                );
            }
          );
        }
      );
  }

  function removeUnusedMethods(apiId, structure) {
    return awsApiGateway.getResources(apiId)
      .then(
        function(resources) {
          return asyncForEach(
            resources,
            function (resource) {
              return awsApiGateway.getMethods(
                apiId,
                resource.id
              ).then(
                function(methods) {
                  return asyncForEach(
                    methods,
                    function(method) {
                      if (
                        resource.path in structure &&
                        method.toLowerCase() in structure[resource.path]
                      ) {
                        return Promise.resolve();
                      }

                      log('Removing unused ' + method + ' method in ' + resource.path + '...');
                      return awsApiGateway.deleteMethod(apiId, resource.id, method);

                    }
                  );
                }
              );
            }
          );
        }
      );
  }


  return function ApiSpecBuilder(spec) {
    return getApiIdByName(spec.apiName).then(
      function(apiId) {
        log('Updating resources tree structure...');

        //Generate resource tree
        return generateResourceTree(
          apiId,
          Object.keys(spec.structure)
        )

          //Update HTTP methods
          .then(function() {
            log('Resource tree structure is up to date.');

            log('Updating HTTP methods...');
            return removeUnusedMethods(apiId, spec.structure);
          })

          //Generate missing HTTP methods
          .then(function() {
            return generateMethods(apiId, spec.structure);
          })

          .catch(function(error) {
            throwError(error);
          });

      }
    );
  };

};