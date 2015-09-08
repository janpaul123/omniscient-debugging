/* eslint-disable no-var */

var addInstrumentation = require('./addInstrumentation');

module.exports = function loader(content) {
  this.cacheable();

  return addInstrumentation(this.resourcePath, content);
};

// TODO: Add eval method in documentation later:
// return "eval(require('omniscient-debugging\/entry.jsx')('" +
//   this.resourcePath + "', () => {\n" + content + '}));\n';
