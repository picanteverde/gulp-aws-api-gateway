var Promise = require('bluebird');

function isPromise(object) {
  return typeof object === 'object' &&
    object.constructor.name === 'Promise';
}

module.exports = function forEachCallback(array, stepFunction, finishCallback, index) {
  if (index === undefined) {
    index = array.length - 1;
  }

  if (index < 0) {
    if (!finishCallback) {
      return new Promise.resolve();
    }

    process.nextTick(function() {
      finishCallback(null);
    });
    return;
  }

  var stepImmediateResult = stepFunction(array[index], function(error) {
    if (error) {
      if (!finishCallback) {
        return new Promise.reject(error);
      }

      finishCallback(error);
      return;
    }

    forEachCallback(array, stepFunction, finishCallback, index-1);
  });

  if (isPromise(stepImmediateResult)) {
    return stepImmediateResult.then(
      function() {
        return forEachCallback(array, stepFunction, finishCallback, index-1);
      }
    );
  }

};