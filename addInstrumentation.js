/* eslint-disable no-var */
/* eslint-disable brace-style */

var falafel = require('falafel');

function executableFromInput(input) {
  if (typeof input === 'function') {
    return '(' + input.toString() + ')()';
  } else {
    return input.toString();
  }
}

function walk(identifiers, node) {
  // Convert 1-indexed lines to 0-indexed (columns are 0-indexed)
  // Also account for function wrapping around each file, `wrappedExecutable`.
  var location =
    (node.loc.start.line - 2) + ',' +
    (node.loc.start.column) + ',' +
    (node.loc.end.line - 2) + ',' +
    (node.loc.end.column);

  if (/Statement$/.test(node.type) && node.type !== 'BlockStatement') {
    // avoid duplicates if the function call is the only statement
    if (node.type !== 'ExpressionStatement' ||
        node.expression.type !== 'CallExpression') {
      node.update('{' + '__odLogStmt(' + location + ');' + node.source() + '}');
    }
  } else if (node.type === 'CallExpression') {
    node.update(
      '(__odLogFnStart(' + location + ',' + identifiers.funcId + '), ' +
        '__odLogFnEnd(' + location + ',' + identifiers.funcId + ', ' + node.source() + '))'
    );
    identifiers.funcId++;
  } else if (node.type === 'FunctionExpression') {
    var params = node.params.map(function(paramNode) {return paramNode.name; });
    var paramsObject = '{' + params.map(function(param) {
      return param + ':' + param; }).join(',') + '}';

    node.update(
      'function(' + params.join(',') + ') {' +
        '__odLogFnStart(' + location + ',' + identifiers.funcId + ',' + paramsObject + ');' +
        'var __odResult;' +
        'try {__odResult = (' + node.source() + ').apply(this, arguments);}' +
          'catch (e) { __odLogErr(e); }' +
        'return __odLogFnEnd(' + location + ',' + identifiers.funcId + ', __odResult);' +
      '}'
    );
    identifiers.funcId++;
  }
}

var untitledNamesCounter = 0;

module.exports = function addInstrumentation(name, input) {
  if (!input) {
    input = name;
    name = 'untitled-' + untitledNamesCounter++;
  }

  var executable = executableFromInput(input);

  // Wrap executable in a function call to group high-level calls together
  // and not pollute the global timeline too much.
  var wrappedExecutable = '(function() {\n' + executable + '\n}).apply(this);';

  var identifiers = { funcId: 0 };

  var instrumentedExecutable = falafel(
    wrappedExecutable,
    { locations: true },
    walk.bind(null, identifiers)
  ).toString();

  var bind = '.bind(window.Instrumentor, ' + JSON.stringify(name) + ')';

  instrumentedExecutable =
    'require("babel-loader!omniscient-debugging/instrumentor");\n' +
    'window.Instrumentor.addSnippet(' + JSON.stringify(name) +
      ', ' + JSON.stringify(executable) + ');\n' +
    'var __odLogStmt = window.Instrumentor.logStatement' + bind + ';\n' +
    'var __odLogFnStart = window.Instrumentor.logFunctionStart' + bind + ';\n' +
    'var __odLogFnEnd = window.Instrumentor.logFunctionEnd' + bind + ';\n' +
    'var __odLogErr = window.Instrumentor.logError.bind(window.Instrumentor);\n' +
    instrumentedExecutable;

  return instrumentedExecutable;
};
