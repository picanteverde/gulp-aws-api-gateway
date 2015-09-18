function truncatePropertiesRecursively(object, propertyNames) {
  if (typeof object !== 'object') {
    return;
  }

  if (Array.isArray(object)) {
    object.forEach(function(item) {
      truncatePropertiesRecursively(item, propertyNames);
    });
    return;
  }

  for (var propName in object) {
    if (propertyNames.indexOf(propName) !== -1) {
      delete object[propName];
      continue;
    }

    truncatePropertiesRecursively(object[propName], propertyNames);
  }

}

module.exports = {
  truncatePropertiesRecursively: truncatePropertiesRecursively
};