const addInstrumentation = require('./addInstrumentation');

describe('addInstrumentation', function() {
  it('initialises the instrumentor', () => {
    expect(addInstrumentation('test', '// some code'))
      .toContain(
        'require("babel-loader!omniscient-debugging/instrumentor");\n' +
        'window.Instrumentor.addSnippet("test", "// some code");\n'
      );
  });

  it('wraps the original code in a function to group logging together', () => {
    expect(addInstrumentation('test', '// some code'))
      .toContain(
        'function() {\n' +
        '// some code\n' +
        '}).apply(this, arguments);'
      );
  });

  // TODO(JP): Also track variable initialisation (var i=0, j=0).
  // TODO(JP): Make more readable, e.g. by indenting original code away from the
  // instrumentation or so.
  it('tracks when statements are called', () => {
    expect(addInstrumentation('test', `
      var i = 0, j = 0;
      i++;
      i *= 2, j &= 1;
      i = (i / 2) - 1; j = i || 'test';
      j = [1,2,3][0];
      i = { 'a': 'a', b: 'b', c: 10 };
    `)).toContain(`
      var i = 0, j = 0;
      {__odLogStmt(2,6,2,10);i++;}
      {__odLogStmt(3,6,3,21);i *= 2, j &= 1;}
      {__odLogStmt(4,6,4,22);i = (i / 2) - 1;} {__odLogStmt(4,23,4,39);j = i || 'test';}
      {__odLogStmt(5,6,5,21);j = [1,2,3][0];}
      {__odLogStmt(6,6,6,38);i = { 'a': 'a', b: 'b', c: 10 };}
    `);
  });

  it('works with `if` and `else if`', () => {
    expect(addInstrumentation('test', `
      if (a) {
        blah = 0;
      } else if (b) {
        blah = 1;
      } else {
        blah = 2;
      }
    `)).toContain(`
      {__odLogStmt(1,6,7,7);if (a) {
        {__odLogStmt(2,8,2,17);blah = 0;}
      } else {__odLogStmt(3,13,7,7);if (b) {
        {__odLogStmt(4,8,4,17);blah = 1;}
      } else {
        {__odLogStmt(6,8,6,17);blah = 2;}
      }}}
    `);
  });

  it('tracks function calls', () => {
    expect(addInstrumentation('test', `
      someFunc();
    `)).toContain(`
      (__odLogFnStart(1,6,1,16), __odLogFnEnd(1,6,1,16, someFunc()));
    `);
  });

  // TODO(JP): Also track functions that do not get assigned to variables.
  it('tracks calls into a function', () => {
    expect(addInstrumentation('test', `
      var someFunc = function(a, b, c) {
        return a + b + c;
      }
    `)).toContain(`
      var someFunc = function(a,b,c) {__odLogFnStart(1,21,3,7,{a:a,b:b,c:c});var __odResult;try {__odResult = (function(a, b, c) {
        {__odLogStmt(2,8,2,25);return a + b + c;}
      }).apply(this, arguments);}catch (e) { __odLogErr(e); }return __odLogFnEnd(1,21,3,7, __odResult);}
    `);
  });
});
