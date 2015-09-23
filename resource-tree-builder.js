var _ = require('lodash');
var asyncForEach = require('./async-for-each.js');
var Promise = require('bluebird');

module.exports = function(awsApiGateway, log, throwError) {
  function generateResourceTree(apiId, paths) {
    return awsApiGateway.getResources(apiId)
      .then(
        function(resources) {
          return removeUnusedResourcePaths(apiId, paths, resources);
        }
      )
      .then(
        function(resourcesLeft) {
          return asyncForEach(
            paths,
            function(path) {
              return ensureResource(apiId, path, resourcesLeft);
            }
          )
        }
      )
    ;
  }

  function removeUnusedResourcePaths(apiId, paths, resources) {
    return asyncForEach(
      resources,
      function(resource) {

        if (
          paths.some(function(path) {
            return path.indexOf(resource.path) === 0;
          })
        ) {
          return Promise.resolve();
        }

        log('Going to remove resource: ' + resource.path);
        return awsApiGateway.deleteResource(apiId, resource.id)
          .then(function() {
            resources = _.remove(resources, function(resourceWhichMayBeAlsoDeleted) {
              return resourceWhichMayBeAlsoDeleted.path.indexOf(resource.path) === 0;
            });
          })
        ;
      }
    ).then(function() {
      return resources;
    });
  }

  function ensureResource(apiId, path, resources) {
    return new Promise(function(resolve, reject) {
      var pathNodes = path.split('/');

      if (path === '') {
        resolve();
        return;
      }

      var existingResource = _.find(resources, {'path': path});
      if (existingResource) {
        resolve();
        return;
      }

      ensureResource(
        apiId,
        pathNodes.slice(0, -1).join('/'),
        resources
      ).then(
        function() {
          log('Creating resource: ' + path + '...');
          return createResource(path).then(
            function(resource) {
              resources.push(resource);
              return resource;
            }
          );
        }
      ).then(resolve, reject);
    });


    function createResource(path) {
      var parentPath = path.split('/').slice(0, -1).join('/');
      var parentId = _.result(
        _.find(
          resources,
          {'path': parentPath.length ? parentPath : '/'}
        ),
        'id'
      );

      return awsApiGateway.createResource(
        apiId,
        parentId,
        path.split('/').pop()
      );
    }
  }

  return generateResourceTree;
};


