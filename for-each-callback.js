module.exports = function forEachCallback(array, stepFunction, finishCallback, index) {
  if (index === undefined) {
    index = array.length - 1;
  }

  if (index === 0) {
    process.nextTick(function() {
      finishCallback(null);
    });
    return;
  }

  stepFunction(array[index], function(error) {
    if (error) {
      finishCallback(error);
      return;
    }

    forEachCallback(array, stepFunction, finishCallback, index-1);
  });

};