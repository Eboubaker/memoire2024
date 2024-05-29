let Babel;
require(['http_unpkg.com_@babel_standalone@7.24.5_babel.js'], _Babel => {
  _Babel.transform(`() => {}`, {
    plugins: [
      function(_Babel) {
        return {
          visitor: {
            ArrowFunctionExpression(path) {
              Babel = _Babel; // it contains the 'types'
            },
          },
        };
      }],
  });
});

function generateFunction(name, params, outputs) {
  if (!Array.isArray(params) || !Array.isArray(outputs)) {
    console.error('`params` and `outputs` must be arrays', params, outputs);
    throw new Error('`params` and `outputs` must be arrays');
  }

  const paramNodes = params.map(param => Babel.types.identifier(param));
  const outputProperties = outputs.map(output =>
    Babel.types.objectProperty(Babel.types.identifier(output), Babel.types.nullLiteral())
  );

  const functionNode = Babel.types.functionDeclaration(
    Babel.types.identifier(name),
    paramNodes,
    Babel.types.blockStatement([
      Babel.types.returnStatement(
        Babel.types.objectExpression(outputProperties)
      )
    ])
  );

  const ast = Babel.types.program([functionNode]);
  const { code } = Babel.transformFromAstSync(ast, '', { presets: [] });

  return code;
}

function renameFunctionParam(func, paramName, newName) {
  if (typeof func !== 'string') {
    console.error('\'func\' not a string', func, paramName, newName);
    throw new Error('\'func\' not a string');
  }
  let topLevelPath;
  const result = Babel.transform(func, {
    plugins: [{
      visitor: {
        Identifier(path) {
          const isFunctionParam = path.scope.getBinding(paramName)?.kind === 'param';
          const isObjectProperty = path.parent.type === 'ObjectProperty' && path.parent.key === path.node;
          const isNestedFunction = path.scope.parent?.block?.type === 'FunctionExpression' ||
            path.scope.parent?.block?.type === 'ArrowFunctionExpression';
          const isSameScope = path.scope.block === topLevelPath.scope.block;
          if (path.node.name === paramName && isFunctionParam && !isObjectProperty && !isNestedFunction && isSameScope) {
            path.node.name = newName;
          }
        },
        FunctionDeclaration(path) {
          if (topLevelPath)
            return;
          topLevelPath = path;
          path.node.params.forEach(param => {
            if (param.name === paramName) {
              param.name = newName;
            }
          });
        },
        FunctionExpression(path) {
          if (topLevelPath)
            return;
          topLevelPath = path;
          path.node.params.forEach(param => {
            if (param.name === paramName) {
              param.name = newName;
            }
          });
        },
        ArrowFunctionExpression(path) {
          if (topLevelPath)
            return;
          topLevelPath = path;
          path.node.params.forEach(param => {
            if (param.name === paramName) {
              param.name = newName;
            }
          });
        },
      },
    }],
  });

  return result.code;
}

function addVariableToFunctionReturnObject(func, propName, value) {
  if (typeof func !== 'string') {
    console.error('\'func\' not a string', func, propName, value);
    throw new Error('\'func\' not a string');
  }

  const result = Babel.transform(func, {
    plugins: [
      function({ types: t }) {
        return {
          visitor: {
            ReturnStatement(path) {
              const argument = path.node.argument;
              if (argument && argument.type === 'ObjectExpression') {
                argument.properties.push(
                  t.objectProperty(
                    t.identifier(propName),
                    t.valueToNode(value),
                  ),
                );
              }
            },
          },
        };
      }],
  });

  return result.code;
}
function existsInReturnedObject(func, propName) {
  if (typeof func !== 'string') {
    console.error('\'func\' not a string', func, propName);
    throw new Error('\'func\' not a string');
  }

  let exists = false;

  Babel.transform(func, {
    plugins: [
      function({ types: t }) {
        return {
          visitor: {
            ReturnStatement(path) {
              const argument = path.node.argument;
              if (argument && argument.type === 'ObjectExpression') {
                const existingProp = argument.properties.find(
                  prop => prop.key.name === propName
                );
                if (existingProp) {
                  exists = true;
                }
              }
            },
          },
        };
      }],
  });

  return exists;
}

function removeVariableFromReturn(func, variableName) {
  if (typeof func !== 'string') {
    console.error('\'func\' not a string', func);
    throw new Error('\'func\' not a string');
  }
  const result = Babel.transform(func, {
    plugins: [
      function({ types: t }) {
        return {
          visitor: {
            ReturnStatement(path) {
              const argument = path.node.argument;
              if (t.isObjectExpression(argument)) {
                argument.properties = argument.properties.filter(
                  prop => !(t.isObjectProperty(prop) && t.isIdentifier(prop.key, { name: variableName })),
                );
              }
            },
          },
        };
      },
    ],
  });
  return result.code;
}

function removeFuncParam(func, paramName) {
  if (typeof func !== 'string') {
    console.error('\'func\' not a string', func, paramName);
    throw new Error('\'func\' not a string');
  }
  let topLevelPath;
  const result = Babel.transform(func, {
    plugins: [{
      visitor: {
        FunctionDeclaration(path) {
          if (topLevelPath)
            return;
          topLevelPath = path;
          path.node.params = path.node.params.filter(param => param.name !== paramName);
        },
        FunctionExpression(path) {
          if (topLevelPath)
            return;
          topLevelPath = path;
          path.node.params = path.node.params.filter(param => param.name !== paramName);
        },
        ArrowFunctionExpression(path) {
          if (topLevelPath)
            return;
          topLevelPath = path;
          path.node.params = path.node.params.filter(param => param.name !== paramName);
        },
      },
    }],
  });
  return result.code;
}
function addFuncParam(func, paramName) {
  if (typeof func !== 'string') {
    console.error('\'func\' not a string', func, paramName);
    throw new Error('\'func\' not a string');
  }
  let topLevelPath;
  const result = Babel.transform(func, {
    plugins: [{
      visitor: {
        FunctionDeclaration(path) {
          if (topLevelPath)
            return;
          topLevelPath = path;
          path.node.params.push(Babel.types.identifier(paramName));
        },
        FunctionExpression(path) {
          if (topLevelPath)
            return;
          topLevelPath = path;
          path.node.params.push(Babel.types.identifier(paramName));
        },
        ArrowFunctionExpression(path) {
          if (topLevelPath)
            return;
          topLevelPath = path;
          path.node.params.push(Babel.types.identifier(paramName));
        },
      },
    }],
  });
  return result.code;
}
function existsInParams(func, paramName) {
  if (typeof func !== 'string') {
    console.error('\'func\' not a string', func, paramName);
    throw new Error('\'func\' not a string');
  }

  let topLevelPath;
  let exists = false;

  Babel.transform(func, {
    plugins: [{
      visitor: {
        FunctionDeclaration(path) {
          if (topLevelPath) return;
          topLevelPath = path;
          exists = path.node.params.some(param => param.name === paramName);
        },
        FunctionExpression(path) {
          if (topLevelPath) return;
          topLevelPath = path;
          exists = path.node.params.some(param => param.name === paramName);
        },
        ArrowFunctionExpression(path) {
          if (topLevelPath) return;
          topLevelPath = path;
          exists = path.node.params.some(param => param.name === paramName);
        },
      },
    }],
  });

  return exists;
}
