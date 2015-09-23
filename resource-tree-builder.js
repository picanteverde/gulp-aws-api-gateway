var _ = require('lodash');
var forEachCallback = require('./for-each-callback.js');

module.exports = function(awsApiGateway) {
  function generateResourceTree(apiId, paths, callback) {
    awsApiGateway.getResources(
      apiId,
      function(error, resources) {

        removeUnusedResourcePaths(apiId, paths, resources, function(error) {
          if (error) {
            callback(error);
            return;
          }

          forEachCallback(
            paths,
            function(path, nextStep) {
              ensureResource(apiId, path, resources, nextStep);
            },
            callback
          );

        });

      }
    );
  }

  function removeUnusedResourcePaths(apiId, paths, resources, callback) {
    forEachCallback(
      resources,
      function(resource, stepCallback) {

        if (
          paths.some(function(path) {
            return path.indexOf(resource.path) === 0;
          })
        ) {
          stepCallback();
          return;
        }

        console.log('Going to remove resource: ' + resource.path);
        awsApiGateway.deleteResource(apiId, resource.id, function(error) {
          if (error === null) {
            resources = _.remove(resources, function(resourceWhichMayBeAlsoDeleted) {
              return resourceWhichMayBeAlsoDeleted.path.indexOf(resource.path) === 0;
            });
          }

          stepCallback(error);
        });
      },
      callback
    );
  }

  function ensureResource(apiId, path, resources, callback) {
    var pathNodes = path.split('/');

    if (path === '') {
      process.nextTick(function() {
        callback(null);
      });
      return;
    }

    var existingResource = _.find(resources, {'path': path});
    if (existingResource) {
      process.nextTick(function() {
        callback(null);
      });
      return;
    }

    ensureResource(
      apiId,
      pathNodes.slice(0, -1).join('/'),
      resources,
      function(error) {
        if (error) {
          callback(error);
          return;
        }

        console.log('Creating resource: ' + path + '...');
        createResource(path, function(error, resource) {
          if (error) {
            callback(error);
            return;
          }

          resources.push(resource);
          callback(null);
        })
      }
    );


    function createResource(path, callback) {
      var parentPath = path.split('/').slice(0, -1).join('/');
      var parentId = _.result(
        _.find(
          resources,
          {'path': parentPath.length ? parentPath : '/'}
        ),
        'id'
      );

      awsApiGateway.createResource(
        apiId,
        parentId,
        path.split('/').pop(),
        callback
      );
    }

    _.find(resources, {'path': path})
  }

  return generateResourceTree;
};


