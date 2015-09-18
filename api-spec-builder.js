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



  return function ApiSpecBulder(spec, callback) {
    getApiIdByName(
      spec.apiName,
      function(error, apiId) {
        if (error) return throwError(error);

        generateResourceTree(
          apiId,
          Object.keys(spec.structure),
          function(error) {
            if (error) {
              console.error('resource tree generation failed!');
              return;
            }

            console.log('resource tree generated sucessfully');
          }
        );

      }
    );
  };

};