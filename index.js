const svgNamespace = 'http://www.w3.org/2000/svg';
const { createApp, ref } = Vue;

// noinspection JSValidateTypes
const editDialog = document.getElementById('editDialog');
/**
 * @type {SVGSVGElement}
 */
let mainEditor = document.querySelector('.editor');

const gCircle = mainEditor.querySelector('.object-circle');
const centerX = mainEditor.querySelector('.object-circle>circle').cx.baseVal
  .value;
const centerY = mainEditor.querySelector('.object-circle>circle').cy.baseVal
  .value;
const radius = gCircle.querySelector('.active-object').getAttribute('r');
let anchorPoints = [];
const numberOfPoints = 8;
for (let i = 0; i < numberOfPoints; i++) {
  // Calculate angle in radians
  const angle = ((2 * Math.PI) / numberOfPoints) * i; // 45 degrees * i, converted to radians
  const template = mainEditor.querySelector('.anchor-fragment');
  const anchorPoint = template.cloneNode(true);
  const templateX = template.querySelector('circle').cx.baseVal.value;
  const templateY = template.querySelector('circle').cy.baseVal.value;
  // Calculate anchor point's coordinates
  const anchorX = centerX + radius * Math.cos(angle) - templateX;
  const anchorY = centerY + radius * Math.sin(angle) - templateY;
  // Create anchor point element (here, using circles as anchor points)
  // anchorPoint.setAttribute('visibility', 'visible');
  anchorPoint.classList.remove('anchor-fragment');
  anchorPoint.classList.add('anchor-point');
  anchorPoint.setAttribute('transform', `translate(${anchorX} ${anchorY})`);
  gCircle.appendChild(anchorPoint);
}
require.config({ paths: { 'vs': 'min/vs' } });
const randomId = Math.random().toString(36).substring(7);
const randomIdDiv = document.querySelector('#editDialog .codeEditor');
randomIdDiv.id = randomId;
randomIdDiv.style.height = '300px';
randomIdDiv.style.border = '1px solid black';
let codeEditor;
require(['vs/editor/editor.main'], (ed) => {
  console.log('loaded ', ed);
  codeEditor = monaco.editor.create(document.getElementById(randomIdDiv.id), {
    value: ``,
    language: 'javascript',
    theme: 'vs-light',
    fontSize: 20,
    minimap: {
      enabled: false,
    },
    'glyphMargin': false,
    'folding': false,
    'lineNumbers': 'on',
    'lineDecorationsWidth': 10,
    'lineNumbersMinChars': 0,
    scrollbar: {
      horizontal: false,
      vertical: false,
    },
    mouseWheelZoom: true,
  });
  editDialog.style.display = 'none';
});

function getOwnerWindow(obj) {
  return obj.closest('.editor');
}

let startX = 0,
  endX = 0;
let startY = 0,
  endY = 0;
const executeBtn = document.querySelector('#executeBtn');
const executionMethodSel = document.querySelector('#execution-method');

function onNodeSelected(node) {
  validateNode(node);
  executeBtn.style.display = 'block';
  executionMethodSel.style.display = 'block';
}

function onNodeDeselected(node) {
  validateNode(node);
  if ([...getOwnerWindow(node).querySelectorAll('.selected')].length === 0) {
    executeBtn.style.display = 'none';
    executionMethodSel.style.display = 'none';
  }
}

function maxLen(arr, accumulator = ((max, curr) => max > curr.length ? curr.length : max)) {
  return arr.reduce(accumulator, 0);
}

const clearBtn = document.querySelector('#clearBtn');
clearBtn.addEventListener('click', () => {
  try {
    getNodes(mainEditor).forEach(n => removeObject(mainEditor, n));
    getArrows(mainEditor).forEach(n => removeObject(mainEditor, n));
  } catch (e) {
    window.location.reload();
    console.error(e);
  } finally {
    localStorage.clear();
  }
});
let app;
executeBtn.addEventListener('click', async () => {
  let method = document.querySelector('#execution-method').value;
  let report = [];
  const env = {};
  await Promise.all(getNodes().filter(n => n.matches('.selected')).map(async (n) => {
    if(method === 'backward')
      await executeNodeBackward(n, env, report);
    else if(method === 'forward')
      await executeNodeForward(n, [], env, report);
    else
      throw new Error("unknown execution method:" + method);
  }));
  report = _.uniqWith(report, (a, b) => a.node === b.node);
  const maxInputVariableLength = report.reduce((acc, n) => {
    const l = Object.keys(n.inputs).reduce((acc, k) => acc > stringifyValue(k).length ? acc : stringifyValue(k).length, 0);
    return acc > l ? acc : l;
  }, 0);
  const maxInputValueLength = report.reduce((acc, n) => {
    const l = Object.values(n.inputs).reduce((acc, k) => acc > stringifyValue(k).length ? acc : stringifyValue(k).length, 0);
    return acc > l ? acc : l;
  }, 0);
  console.log('maxInputVariableLength', maxInputVariableLength);
  console.log('maxInputValueLength', maxInputValueLength);
  const maxOutputVariableLength = report.reduce((acc, n) => {
    const l = Object.keys(n.outputs).reduce((acc, k) => acc > stringifyValue(k).length ? acc : stringifyValue(k).length, 0);
    return acc > l ? acc : l;
  }, 0);
  const maxOutputValueLength = report.reduce((acc, n) => {
    const l = Object.values(n.outputs).reduce((acc, k) => acc > stringifyValue(k).length ? acc : stringifyValue(k).length, 0);
    return acc > l ? acc : l;
  }, 0);
  console.log('maxOutputVariableLength', maxOutputVariableLength);
  console.log('maxOutputValueLength', maxOutputValueLength);
  if (app) {
    app.unmount();
    document.querySelector('#resultsDialog')?.remove();
  }
  const d = document.querySelector('#resultsDialog-template').cloneNode(true);
  document.body.appendChild(d);
  d.id = 'resultsDialog';
  d.style.display = 'block';
  app = createApp({
    setup() {
      return {
        report,
        maxInputVariableLength,
        maxInputValueLength,
        maxOutputVariableLength,
        maxOutputValueLength,
      };
    },
    methods: {
      getNodeName,
      stringifyValue,
    },
  });
  app.mount(d);
  console.log(report);
});

function stringifyValue(v) {
  if (typeof v === 'undefined')
    return 'undefined';
  if (v === null)
    return 'null';
  return v.toString();
}

async function executeNodeBackward(node, environment = {}, report = []) {
  console.log('exec back', node);
  validateNode(node);
  const name = getNodeName(node);
  let func;
  let nodeFunction;
  try {
    nodeFunction = getNodeFunctionRaw(node);
    const encodedSourceCode = btoa(nodeFunction);
    const sourceCode = `(function runner(env, inputs) {
        return (${nodeFunction})(...inputs)
      })`;
    func = eval?.(sourceCode
      + `
        //# sourceMappingURL=data:application/json;base64,${encodedSourceCode}
        //# sourceURL=process.js`);
  } catch (e) {
    console.error(`syntax error in node "${name}"`, node);
    throw e;
  }
  const inputs = {};
  const orderedInputs = [];
  const deps = getNodeDependencies(node);
  await Promise.all(getNodeInputs(node).map(async (v) => {
    const depNode = deps.find(d => d.variables.includes(v)).node;
    inputs[v] = (await executeNodeBackward(depNode, environment, report))[v];
  }));
  getFunctionParams(nodeFunction).forEach(param => {
    if (param in inputs) {
      orderedInputs.push(inputs[param]);
    } else {
      console.error('input not found:', param);
    }
  });
  let outputs;
  try {
    if (isAsyncFunction(getNodeFunction(node))) {
      outputs = await func(environment, orderedInputs);
    } else {
      outputs = func(environment, orderedInputs);
    }
  } catch (e) {
    console.error(`error while executing node "${name}"`, node);
    throw e;
  }
  console.log(`"${name}" outputs: `, outputs);
  report.push({
    node: node,
    inputs: _.cloneDeep(inputs),
    outputs: _.cloneDeep(outputs),
  });
  return outputs;
}

async function executeNodeForward(node, availableInputs = {}, environment = {}, report = []) {
  console.log('exec forward', node);
  validateNode(node);
  const rawFunc = getNodeFunctionRaw(node);
  let func = getNodeFunction(node);
  const availableInputsVariables = Object.keys(availableInputs);
  let inputs = getFunctionParams(rawFunc);
  const missingInputs = inputs.filter(v => !availableInputsVariables.includes(v));
  const deps = getNodeDependencies(node);
  let needExecution = missingInputs.map(v => {
    const r = deps.find(d => d.variables.includes(v));
    if(!r || !r.node) {
      console.error("error while forward executing node", node, "missing input", v,"with no found dependency");
      throw new Error("error while forward executing node missing input: " + v + ", with no found dependency");
    }
    return r.node;
  });
  needExecution = _.uniqWith(needExecution, _.isEqual)
  await Promise.all(needExecution.map(async (n) => {
    for (const [k, v] of Object.entries(await executeNodeBackward(n, environment, report))) {
      if (missingInputs.includes(k))
        availableInputs[k] = v;
    }
  }));
  const orderedInputs = {};
  getFunctionParams(rawFunc).forEach(param => {
    if (param in availableInputs) {
      orderedInputs[param] = availableInputs[param];
    } else {
      console.error('input not found:', param);
    }
  });
  let outputs
  const name = getNodeName(node);
  let nodeFunction = func;
  try {
    const encodedSourceCode = btoa(rawFunc);
    const sourceCode = `(function runner(env, inputs) {
        return (${rawFunc})(...inputs)
      })`;
    func = eval?.(sourceCode
      + `
        //# sourceMappingURL=data:application/json;base64,${encodedSourceCode}
        //# sourceURL=process.js`);
  } catch (e) {
    console.error(`syntax error in node "${name}"`, node);
    throw e;
  }
  try {
    if (isAsyncFunction(nodeFunction)) {
      outputs = await func(environment, Object.values(orderedInputs));
    } else {
      outputs = func(environment, Object.values(orderedInputs));
    }
  } catch (e) {
    console.error(`error while executing node "${name}"`, node);
    throw e;
  }
  report.push({
    node: node,
    inputs: _.cloneDeep(orderedInputs),
    outputs: _.cloneDeep(outputs),
  });
  await Promise.all(getNextNodes(node).map(async (dep) => {
    await executeNodeForward(dep.node, outputs, environment, report);
  }));
  return outputs;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getNodeDependencies(node) {
  return getIncomingArrows(node).map(arr => {
    return { variables: getArrowVariables(arr), node: getStartingNode(arr) };
  });
}

function getNextNodes(node) {
  return getOutgoingArrows(node).map(arr => {
    return { variables: getArrowVariables(arr), node: getEndingNode(arr) };
  });
}

function executeSimulation() {
  getNodes()
    .filter(isLeaf)
    .forEach(executeNodeBackward);
}

function deleteNode(editorWindow, node) {
  validateNode(node);
  if (node.matches('.selected')) {
    node.classList.remove('selected');
    onNodeDeselected(node);
  }
  for (const p of node.querySelectorAll(
    '.anchor-point[data-attached-handles]',
  )) {
    anchorPoints = anchorPoints.filter(x => x !== p);
    const handles = p
      .getAttribute('data-attached-handles')
      .split(',')
      .filter((x) => x.length)
      .map((id) =>
        editorWindow.querySelector(`.arrow-handle[data-handle-id='${id}']`),
      );
    for (const h of handles) {
      removeObject(editorWindow, h.closest('.arrow'));
    }
  }
}


// Function to call when the circle is moved
function updateHandlePosition(editor, handle, dx, dy) {
  // Update the position of the circle handle based on the drag
  const arrowLine = handle.closest('g').querySelector('.arrow-line');
  const d = arrowLine.getAttribute('d');
  let [M, x1, y1, L, x2, y2] = d.split(' ').map((x) => Number(x));
  if (handle.classList.contains('arrow-handle-start')) {
    x1 += dx;
    y1 += dy;
  } else {
    x2 += dx;
    y2 += dy;
  }
  arrowLine.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
  if (handle.matches('.arrow-handle-start')) {
    let cx = handle.getAttribute('cx');
    let cy = handle.getAttribute('cy');
    cx = Number(cx);
    cy = Number(cy);
    cx += dx;
    cy += dy;
    handle.setAttribute('cx', cx);
    handle.setAttribute('cy', cy);
  }
  // Calculate the angle of the arrow
  const theta = Math.atan2(y2 - y1, x2 - x1);

  // Define original positions of dots relative to arrow's end (60, 0)
  const dotsOriginalPositions = [
    { id: 'c1', dx: -7, dy: -5 }, // c1 position
    { id: 'c2', dx: -7, dy: 5 }, // c2 position
    { id: 'c3', dx: 3, dy: 0 }, // c3 position (tip)
    { id: 'c4', dx: -20, dy: -20 },
  ];
  let newDots = [];
  dotsOriginalPositions.forEach((dotInfo) => {
    // Calculate new position based on theta and original offsets
    const newX =
      x2 + dotInfo.dx * Math.cos(theta) - dotInfo.dy * Math.sin(theta);
    const newY =
      y2 + dotInfo.dx * Math.sin(theta) + dotInfo.dy * Math.cos(theta);

    newDots.push({
      x: newX,
      y: newY,
    });
  });
  handle
    .closest('g')
    .querySelector('.arrow-handle-end')
    .setAttribute(
      'd',
      `M ${newDots[0].x} ${newDots[0].y} ` +
      `L ${newDots[1].x} ${newDots[1].y} ` +
      `L ${newDots[2].x} ${newDots[2].y} ` +
      `L ${newDots[0].x} ${newDots[0].y}`,
    );
  const input = handle.closest('.arrow').querySelector('.variable-name .value');
  const rect = input.getBoundingClientRect();
  const variableNameLabel = handle.closest('g').querySelector('.variable-name');
  variableNameLabel.setAttribute(
    'transform',
    'translate(' + (newDots[3].x) + ',' + (newDots[3].y) + ')',
  );
  onEditorUpdated(editor);
}

function addArrowHandleInteraction(editorWindow, head) {
  let handleId = head.getAttribute('data-handle-id');
  if (!handleId) {
    handleId = +editorWindow.getAttribute('data-next-handle-id');
    editorWindow.setAttribute('data-next-handle-id', '' + (handleId + 1));
    head.setAttribute('data-handle-id', handleId);
  }
  const interaction = interact(head).draggable({
    modifiers: [
      interact.modifiers.snap({
        targets: [], // will be set in start()
        range: 10,
        origin: editorWindow,
        relativePoints: [{ x: 0.5, y: 0.5 }],
      }),
    ],
    listeners: {
      end(event) {
        // console.log('dropped', event);
        onEditorUpdated(editorWindow);
      },
      start(event) {
        // editorWindow.querySelectorAll('.test').forEach(e => e.remove());
        // anchorPoints.forEach(p => {
        //   const c = document.createElementNS(svgNamespace, 'circle');
        //   c.setAttribute('class', 'test');
        //   const rect = p.getBoundingClientRect();
        //   c.setAttribute('cx', rect.x + 5);
        //   c.setAttribute('cy', rect.y + 5);
        //   c.setAttribute('r', 2);
        //   c.setAttribute('fill', 'red');
        //   editorWindow.appendChild(c);
        // });
        for (const p of editorWindow.querySelectorAll('[data-attached-handles]')) {
          let handles = p
            .getAttribute('data-attached-handles')
            .split(',')
            .filter((x) => x.length);
          if (handles.includes(handleId)) {
            detachArrowHandle(editorWindow, head, p);
          }
        }
        event.interaction.interactable.options.drag.modifiers[0].options.targets =
          anchorPoints.map((p) => {
            const rect = p.getBoundingClientRect();
            return {
              x: rect.x + 5,
              y: rect.y + 5,
            };
          });
        console.log(event.interaction.interactable);
      },
      move(event) {
        // Update the position of the circle handle based on the drag
        const handle = event.currentTarget;
        const dx = event.dx;
        const dy = event.dy;
        updateHandlePosition(editorWindow, handle, dx, dy);
      },
    },
  });
  head.interactions = head.interactions || [];
  head.interactions.push(interaction);
  return interaction;
}

function getTransformation(target) {
  if (!target || target.tagName === 'svg') {
    return { x: 0, y: 0 };
  }
  // const ctm = target.getCTM();
  const relativeTrans = getTransformation(target.parentElement);
  // const parentCTM = {
  //   x: 0,
  //   y: 0
  // };
  if (target.transform.animVal[0]) {
    relativeTrans.x += target.transform.animVal[0].matrix.e;
    relativeTrans.y += target.transform.animVal[0].matrix.f;
  }
  return relativeTrans;
}

function getPos(target) {
  if (!target || target.tagName === 'svg') {
    return { x: 0, y: 0 };
  }
  // const ctm = target.getCTM();
  const relativeTrans = { x: 0, y: 0 };//getTransformation(target.parentElement);
  // const parentCTM = {
  //   x: 0,
  //   y: 0
  // };
  const ctm = target.getCTM();
  relativeTrans.x += ctm.e;
  relativeTrans.y += ctm.f;
  return relativeTrans;
}

/**
 * @returns {DOMPoint}
 */
function GetSVGCoordinates(someSVGElement) {
  let svgPoint = new DOMPoint();
  // If the element is directly inside the SVG, getBBox can be used directly
  const bbox = someSVGElement.getBBox();
  svgPoint.x = bbox.x;
  svgPoint.y = bbox.y;
  // For elements with transformations applied, you might need to account for them
  const ctm = someSVGElement.getCTM();
  if (ctm) {
    svgPoint = svgPoint.matrixTransform(ctm);
  }
  return svgPoint;
}

function GetWindowCoordinates(someSVGElement) {
  const svgRect = someSVGElement.getBoundingClientRect();
  return { x: svgRect.left, y: svgRect.top };
}

function isHandle(obj) {
  return obj instanceof Node && obj.matches('.arrow-handle');
}

function isAnchorPoint(obj) {
  return obj instanceof Node && obj.matches('.anchor-point');
}

function checkHandle(handle) {
  if (!isHandle(handle)) {
    console.error('not a handle', handle);
    throw new Error('not a handle');
  }
}

function isArrowStart(handle) {
  checkHandle(handle);
  return handle.matches('.arrow-handle-start');
}

function isArrowEnd(handle) {
  checkHandle(handle);
  return handle.matches('.arrow-handle-end');
}

function getArrow(handle) {
  checkHandle(handle);
  return handle.closest('.arrow');
}

function attachArrowHandle(editorWindow, handle, anchorPoint) {
  const origH = handle;
  const origA = anchorPoint;
  if (!(handle instanceof SVGElement)) {
    // look by id
    handle = editorWindow.querySelector(`[data-handle-id="${handle}"]`);
  }
  if (!(anchorPoint instanceof SVGElement)) {
    // look by id
    anchorPoint = editorWindow.querySelector(`[data-anchor-id="${anchorPoint}"]`);
  }
  if (!handle) {
    console.error('not a handle', handle, origH);
  }
  if (!anchorPoint) {
    console.error('not an anchorPoint', anchorPoint, origA);
  }
  let handles = anchorPoint.getAttribute('data-attached-handles') || '';
  const handleId = handle.getAttribute('data-handle-id');
  handles = [...handles.split(',').filter((x) => x.length), handleId].join(',');
  anchorPoint.setAttribute('data-attached-handles', handles);
  handle.setAttribute(
    'data-attached-to',
    anchorPoint.getAttribute('data-anchor-id'),
  );
  const arrow = getArrow(handle);
  const input = arrow.querySelector('.variable-name .value');
  input.focus();
  input.selectionStart = 0;
  input.selectionEnd = input.value.length;
  if (isArrowEnd(handle)) {
    const start = getStartingNode(arrow);
    const end = getEndingNode(arrow);
    if (!existsInReturnedObject(getNodeFunctionRaw(start), input.value)) {
      updateNodeFunction(start, addVariableToFunctionReturnObject, input.value);
    }
    let baseV = input.value;
    let c = 0;
    let v = baseV;
    while (existsInParams(getNodeFunctionRaw(end), v)) {
      c++;
      v = baseV + '_' + c;
    }
    input.value = v;
    input.size = Math.max(1, input.value.length);
    updateNodeFunction(end, addFuncParam, v);
  }
  onEditorUpdated(editorWindow);
}

const onEditorUpdated = _.debounce(editor => {
  if (editor instanceof Function)
    editor = editor(); // lazy supplier for editor
  saveToCache(editor);
}, 500);

function detachArrowHandle(editorWindow, handle, anchorPoint) {
  if (!(handle instanceof SVGElement)) {
    // look by id
    handle = mainEditor.querySelector(`[data-handle-id="${handle}"]`);
  }
  if (!(anchorPoint instanceof SVGElement)) {
    // look by id
    anchorPoint = mainEditor.querySelector(`[data-anchor-id="${anchorPoint}"]`);
  }
  const handleId = handle.getAttribute('data-handle-id');
  let handles = anchorPoint.getAttribute('data-attached-handles') || '';
  handles = handles
    .split(',')
    .filter((x) => x.length)
    .filter((x) => x !== handleId)
    .join(',');
  if (handles.length)
    anchorPoint.setAttribute('data-attached-handles', handles);
  else
    anchorPoint.removeAttribute('data-attached-handles');
  const arrow = getArrow(handle);
  const end = getEndingNode(arrow);
  console.log('detach');
  getArrowVariables(arrow).forEach(v => {
    updateNodeFunction(end, removeFuncParam, v);
  });
  onEditorUpdated(editorWindow);
}

function updateNodeFunction(node, mod, ...args) {
  validateNode(node);
  setNodeFunction(node, mod(getNodeFunctionRaw(node), ...args));
}

function onVariableNameChange() {
  if (!this.matches('input')) {
    console.error('onVariableNameChange: this is not input:', this);
    throw new Error('onVariableNameChange: this is not input');
  }
  this.size = Math.max(1, this.value.length);
  const arrow = this.closest('.arrow');
  validateArrow(arrow);
  const start = getStartingNode(arrow);
  const end = getEndingNode(arrow);
  validateNode(start);
  validateNode(end);
  const value = this.value;
  const oldValue = this.getAttribute('data-old-value');
  const variables = value.split(',');
  const oldVariables = oldValue.split(',');
  const deletedVariables = oldVariables.filter(v => !variables.includes(v));
  const addedVariables = variables.filter(v => !oldVariables.includes(v));
  console.log('addedVariables', addedVariables);
  console.log('deletedVariables', deletedVariables);
  deletedVariables.forEach(v => {
    updateNodeFunction(start, removeVariableFromReturn, v);
    updateNodeFunction(end, removeFuncParam, v);
  });
  addedVariables.forEach(v => {
    if (!existsInReturnedObject(getNodeFunctionRaw(start), v)) {
      updateNodeFunction(start, addVariableToFunctionReturnObject, v);
    }
    if (existsInParams(getNodeFunctionRaw(end), v)) {
      console.error('param already exists in FuncParams', end, v);
      throw new Error('param already exists in FuncParams');
    }
    updateNodeFunction(end, addFuncParam, v);
  });
  console.log('changed');
  this.setAttribute('data-old-value', value);
}

function isNode(elem) {
  return elem.matches('.object-circle');
}

function getNodeFunction(node) {
  validateNode(node);
  try {
    const func = getNodeFunctionRaw(node);
    const encodedSourceCode = btoa(func);
    return eval?.('(' + func + ')'
      + `    //# sourceMappingURL=data:application/json;base64,${encodedSourceCode}\n//# sourceURL=process.js`);
  } catch (e) {
    console.error('Syntax error in node function:', node);
    throw e;
  }
}

function trySelectObject(editorWindow, object) {
  if (object.classList.contains('selectable')) {
    editorWindow
      .querySelectorAll('.selected')
      .forEach((e) => {
        e.classList.remove('selected');
        if (isNode(e)) {
          onNodeDeselected(e);
        }
      });
    object.classList.add('selected');
    if (isNode(object)) {
      onNodeSelected(object);
    }
  }
}

let currentEdit = null;

function validateNode(node) {
  if (!node.matches('.object-circle')) {
    console.error('not a node', node);
    throw new Error('not a node');
  }
}

function validateArrow(arrow) {
  if (!arrow.matches('.arrow')) {
    console.error('not an arrow', arrow);
    throw new Error('not an arrow');
  }
}

function openNodeEditor(node) {
  validateNode(node);
  currentEdit = node;
  editDialog.style.display = 'block';
  editDialog.style.pointerEvents = 'all';
  editDialog.querySelector('#nodeName').value = node.querySelector('.nodeName').innerHTML;
  codeEditor.setValue(getNodeFunctionRaw(node));
}

function getOutgoingArrows(node) {
  validateNode(node);
  return [...node.querySelectorAll('.anchor-point')]
    .map((e) => e.getAttribute('data-attached-handles'))
    .filter((att) => !!att)
    .flatMap((ids) =>
      ids
        .split(',')
        .map((id) =>
          mainEditor.querySelector(`.arrow-handle-start[data-handle-id="${id}"]`),
        ),
    )
    .filter((x) => !!x)
    .map((h) => h.closest('.arrow'));
}

function getIncomingArrows(node) {
  validateNode(node);
  return [...node.querySelectorAll('.anchor-point')]
    .map((e) => e.getAttribute('data-attached-handles'))
    .filter((att) => !!att)
    .flatMap((ids) =>
      ids
        .split(',')
        .map((id) =>
          mainEditor.querySelector(`.arrow-handle-end[data-handle-id="${id}"]`),
        ),
    )
    .filter((x) => !!x)
    .map((h) => h.closest('.arrow'));
}

function getStartingNode(arrow) {
  validateArrow(arrow);
  const id = arrow
    .querySelector('.arrow-handle-start')
    .getAttribute('data-attached-to');
  return mainEditor
    .querySelector(`.anchor-point[data-anchor-id="${id}"]`)
    .closest('.object-circle');
}

function getStartingHandle(arrow) {
  validateArrow(arrow);
  return arrow.querySelector('.arrow-handle-start');
}

function getEndingHandle(arrow) {
  validateArrow(arrow);
  return arrow.querySelector('.arrow-handle-end');
}

function getEndingNode(arrow) {
  validateArrow(arrow);
  const id = arrow
    .querySelector('.arrow-handle-end')
    .getAttribute('data-attached-to');
  return document
    .querySelector(`.anchor-point[data-anchor-id="${id}"]`)
    .closest('.object-circle');
}

function getArrowVariables(arrow) {
  validateArrow(arrow);
  return arrow
    .querySelector('.variable-name .value')
    .value.trim()
    .split(',');
}

function setArrowVariables(arrow, variables) {
  validateArrow(arrow);
  arrow.querySelector('.variable-name .value').value = variables.join(',');
}

function getNodeInputs(node) {
  validateNode(node);
  return [...new Set(getIncomingArrows(node).flatMap(getArrowVariables))];
}

function getNodeOutputs(node) {
  validateNode(node);
  return [...new Set(getOutgoingArrows(node).flatMap(getArrowVariables))];
}

function getNodes(editor = undefined) {
  return [...(editor || mainEditor).querySelectorAll('.object-circle:not(.template)')];
}

function getArrows(editor = undefined) {
  return [...(editor || mainEditor).querySelectorAll('.arrow:not(.template)')];
}

function isLeaf(node) {
  validateNode(node);
  return getNodeOutputs(node).length === 0;
}

function isRoot(node) {
  validateNode(node);
  return getNodeInputs(node).length === 0;
}

function getNodeName(node) {
  validateNode(node);
  return node.querySelector('.nodeName').innerHTML;
}

function proxify(object, change) {
  // we use unique field to determine if object is proxy
  // we can't test this otherwise because typeof and
  // instanceof is used on original object
  if (object && object.__proxy__) {
    return object;
  }
  const proxy = new Proxy(object, {
    get: function(object, name) {
      if (name === '__proxy__') {
        return true;
      }
      return object[name];
    },
    set: function(object, name, value) {
      const old = object[name];
      if (value && typeof value == 'object') {
        // new object need to be proxified as well
        value = proxify(value, change);
      }
      object[name] = value;
      change(object, name, old, value);
      return true;
    },
  });
  for (const prop in object) {
    if (object.hasOwnProperty(prop) && object[prop] &&
      typeof object[prop] == 'object') {
      // proxify all child objects
      object[prop] = proxify(object[prop], change);
    }
  }
  return proxy;
}

function isArrow(obj) {
  return obj instanceof Node && obj.matches('.arrow');
}

function getNextArrowVariable(editor) {
  let nextArrowVariable = editor.getAttribute('data-next-arrow-variable');
  const ret = nextArrowVariable;
  if (nextArrowVariable.endsWith('z'))
    nextArrowVariable = 'a'.repeat(nextArrowVariable.length + 1);
  else {
    const last = nextArrowVariable.slice(-1);
    nextArrowVariable = nextArrowVariable.slice(0, -1) + String.fromCharCode(last.charCodeAt(0) + 1);
  }
  editor.setAttribute('data-next-arrow-variable', nextArrowVariable);
  return ret;
}

function addObjectInteractions(editorWindow, obj, template) {
  const myAnchorPoints = [];
  if (isNode(obj)) {
    obj.querySelector('.nodeName').onclick = function() {
      openNodeEditor(obj);
    };
    myAnchorPoints.push(
      ...[...obj.querySelectorAll('.anchor-point>circle')],
    );
    anchorPoints.push(...myAnchorPoints);
    for (const p of obj.querySelectorAll('.anchor-point')) {
      const anchorId = p.getAttribute('data-anchor-id');
      interact(p)
        .dropzone({
          ondragenter: function(event) {
          },
          ondragleave: function(event) {
          },
          ondrop: function(event) {
            if (isHandle(event.relatedTarget) && isAnchorPoint(event.currentTarget))
              attachArrowHandle(editorWindow, event.relatedTarget, event.currentTarget);
          },
        })
        .draggable({
          listeners: {
            end() {
              console.log('my drag ended');
              onEditorUpdated(editorWindow);
            },
          },
        })
        .on('dragstart', (event) => {
          // create new arrow, put its arrow-handle-end in the
          // position of this anchor, and move the current
          // interaction to the arrow-handle-start so it moves with the mouse
          const template = editorWindow.querySelector('.arrow.template');
          const arrow = template.cloneNode(true);
          setArrowVariables(arrow, [getNextArrowVariable(editorWindow)]);
          arrow.classList.remove('template', 'draggable');
          editorWindow.appendChild(arrow);
          makeNewElementInteraction(editorWindow, arrow, template);
          const head = arrow.querySelector('.arrow-handle-end');
          const start = arrow.querySelector('.arrow-handle-start');
          start.setAttribute('data-attached-to', anchorId);
          const p = event.target;
          updateHandlePosition(editorWindow, head, -65, 0);
          attachArrowHandle(editorWindow, start, p);
          const coords = GetSVGCoordinates(p);
          coords.x += 5;
          coords.y += 5;
          const m = editorWindow
            .createSVGMatrix()
            .translate(coords.x, coords.y)
            .rotate(0); // Rotate if needed, based on the angle of the arrow line
          // Create an SVGTransform object from this matrix
          const trans = arrow.transform.baseVal.createSVGTransformFromMatrix(m);
          arrow.transform.baseVal.clear(); // Remove any existing transformations
          arrow.transform.baseVal.appendItem(trans);

          event.interaction.start({ name: 'drag' }, head.interactions[0], head);
          onEditorUpdated(editorWindow);
        });
    }
  }
  if (isArrow(obj)) {
    addArrowHandleInteraction(editorWindow, obj.querySelector('.arrow-handle-start'));
    addArrowHandleInteraction(editorWindow, obj.querySelector('.arrow-handle-end'));
  }
  let lastIsDrag = false;
  const interaction = interact(obj).on('mouseup', (event) => {
    if (!lastIsDrag) {
      trySelectObject(editorWindow, event.currentTarget);
      event.stopPropagation();
    }
    lastIsDrag = false;
  });

  interaction
    .on('mouseover', (event) => {
      event.currentTarget.classList.add('hovering');
    })
    .on('mouseout', (event) => {
      event.currentTarget.classList.remove('hovering');
    });
  obj.interactions = obj.interactions || [];
  obj.interactions.push(interaction);

  if (obj.classList.contains('draggable')) {
    interaction
      .draggable({
        modifiers: [
          interact.modifiers.restrict({
            restriction: editorWindow,
            elementRect: { top: 0, left: 0, bottom: 1, right: 1 },
            endOnly: true,
          }),
        ],
      })
      .on('dragstart', (event) => {
        event.currentTarget.classList.add('dragging');
      })
      .on('dragend', (event) => {
        event.currentTarget.classList.remove('dragging');
        onEditorUpdated(editorWindow);
        lastIsDrag = true;
      })
      .on(['dragmove'], function(event) {
        const target = event.currentTarget;
        if (target.classList.contains('selected')) {
          moveObjects(editorWindow, [...editorWindow.querySelectorAll('.selectable.selected')],
            event.dx,
            event.dy,
          );
        } else {
          moveObjects(editorWindow, target, event.dx, event.dy);
        }
      });
  }
  onEditorUpdated(editorWindow);
  return interaction;
}

function moveObjects(editor, objects, dx, dy) {
  if (!Array.isArray(objects))
    objects = [objects];
  if (objects.length === 0)
    return;
  for (const object of objects) {
    if (isArrow(object)) {
      updateHandlePosition(editor, getStartingHandle(object), dx, dy);
      updateHandlePosition(editor, getEndingHandle(object), dx, dy);
    } else if (isNode(object)) {
      let { e: x, f: y } = object.getCTM();
      x += dx;
      y += dy;
      object.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
      for (const p of object.querySelectorAll('.anchor-point')) {
        p.x += dx;
        p.y += dy;
        let handles = p.getAttribute('data-attached-handles');
        if (!handles) continue;
        handles = handles.split(',').filter((x) => x.length);
        handles = handles.map((id) =>
          editor.querySelector(`[data-handle-id='${id}']`),
        );
        for (const h of handles) {
          const arrow = getArrow(h);
          if (arrow in objects)
            continue;
          updateHandlePosition(editor, h, dx, dy);
        }
      }
    } else {
      console.error('I don\'t know how to move this object:', object);
    }
  }
}

function makeNewElementInteraction(editorWindow, target, template = undefined) {
  if (target.matches('.object-circle')) {
    let nextNodeNumber = +editorWindow.getAttribute('data-next-node-number');
    let nextNodeId = +editorWindow.getAttribute('data-next-node-id');
    target.querySelector('.nodeName').innerHTML =
      'Node (' + nextNodeNumber + ')';
    editorWindow.setAttribute('data-next-node-number', (1 + nextNodeNumber));
    setNodeFunction(target, generateFunction('process', [], [], true));
    let nextAnchorId = +editorWindow.getAttribute('data-next-anchor-id');
    for (const p of target.querySelectorAll('.anchor-point')) {
      p.setAttribute('data-anchor-id', '' + nextAnchorId);
      nextAnchorId = nextAnchorId + 1;
    }
    editorWindow.setAttribute('data-next-anchor-id', nextAnchorId);
    target.setAttribute('id', nextNodeId);
    editorWindow.setAttribute('data-next-node-id', 1 + nextNodeId);
  }
  const ret = addObjectInteractions(editorWindow, target, template);
  onEditorUpdated(editorWindow);
  return ret;
}

/**
 * @returns Error|true
 */
function checkSyntaxError(func) {
  try {
    const encodedSourceCode = btoa(func);
    eval?.('(' + func + ')'
      + `    //# sourceMappingURL=data:application/json;base64,${encodedSourceCode}\n//# sourceURL=process.js`);
    return true;
  } catch (e) {
    return e;
  }
}

function setNodeFunction(node, func) {
  validateNode(node);
  if (typeof func !== 'string') {
    console.error('\'func\' value not a string: ', func);
    throw new Error('not a string: ' + func);
  }
  node.querySelector('.code').setAttribute('data-code', btoa(func));
  onEditorUpdated(() => getOwnerWindow(node));
}

function validateFunc(func) {
  // todo: check code has 1 function and 1 return object...
  return true;
}

function getNodeFunctionRaw(node) {
  validateNode(node);
  const code = node.querySelector('.code').getAttribute('data-code');
  if (!code) {
    console.error('no code', node);
    throw new Error('no code');
  }
  return atob(code);
}

function saveNode() {
  currentEdit.querySelector('.nodeName').innerHTML = editDialog.querySelector('#nodeName').value;
  const code = codeEditor.getValue();
  const error = checkSyntaxError(code) || validateFunc(code);
  if (error !== true) {
    const p = getOwnerWindow(currentEdit).ownerDocument.createElement('p');
    p.innerText = '' + error;
    editDialog.querySelector('.errors').appendChild(p);
    return;
  }
  [...editDialog.querySelector('.errors').children].forEach(e => e.remove());
  setNodeFunction(currentEdit, code);
  codeEditor.setValue('');
  onEditorUpdated(getOwnerWindow(currentEdit));
  currentEdit = null;
  editDialog.style.display = 'none';
  editDialog.style.pointerEvents = 'none';
}

function removeObject(editorWindow, obj) {
  console.log('rem', obj);
  if (!editorWindow.contains(obj)) return;
  if (obj.classList.contains('object-circle')) {
    deleteNode(editorWindow, obj);
  } else if (obj.classList.contains('arrow')) {
    const startHandle = obj.querySelector('.arrow-handle-start');
    const endHandle = obj.querySelector('.arrow-handle-end');
    removeObject(editorWindow, startHandle);
    removeObject(editorWindow, endHandle);
  } else if (obj.classList.contains('arrow-handle')) {
    const anchorId = obj.getAttribute('data-attached-to');
    if (anchorId) {
      const anchor = editorWindow.querySelector(
        `.anchor-point[data-anchor-id='${anchorId}']`,
      );
      if (anchor)
        detachArrowHandle(editorWindow, obj, anchor);
    }
  } else {
    console.error('how to remove this?: ', obj);
    throw new Error('how to remove this?: ' + obj);
  }
  obj.remove();
}

window.addEventListener('keydown', function(event) {
  // check del key
  if (event.key === 'Delete') {
    for (const selected of mainEditor.querySelectorAll('.selected')) {
      removeObject(mainEditor, selected);
    }
  }
  if ((event.key === 'C' || event.key === 'c') && event.ctrlKey) {
    document.querySelector('#clipboard').childNodes.forEach(el => el.remove());
    let count = 0;
    for (const selected of mainEditor.querySelectorAll('.selected')) {
      document.querySelector('#clipboard').appendChild(selected.cloneNode(true));
      count++;
    }
    console.log('copied', count, 'elements');
  }
});

function dropArrow(arrow) {
  mainEditor.querySelectorAll('.anchor-point');
}

function editorToString(editor) {
  return cloneEditorForSave(editor).outerHTML;
}

function saveEditor(editor) {
  console.log('Save');
  const data = editorToString(editor);
  const blob = new Blob([data], { type: 'image/svg' });
  const link = document.createElement('a');
  link.download = 'project.svg';
  link.href = window.URL.createObjectURL(blob);
  link.onclick = (e) => {
    setTimeout(() => window.URL.revokeObjectURL(link.href), 1500);
  };
  link.click();
  link.remove();
}

document.querySelector('#saveBtn').addEventListener('click', () => saveEditor(mainEditor));
document.querySelector('#loadBtn').addEventListener('click', () => {
  document.querySelector('#loadBtnFile').click();
});
document.querySelector('#loadBtnFile').addEventListener('change', (event, a) => {
  event.target.files[0].text().then(txt => loadEditor(txt));
});
document.body.addEventListener('dragover', function dropHandler(ev) {
  console.log('dragover');
});
document.body.addEventListener('drop', dropHandler);
mainEditor.addEventListener('drop', dropHandler);

function dropHandler(ev) {
  console.log('File(s) dropped');
  // Prevent default behavior (Prevent file from being opened)
  let file;
  if (ev.dataTransfer?.items) {
    // Use DataTransferItemList interface to access the file(s)
    [...ev.dataTransfer.items].forEach((item, i) => {
      // If dropped items aren't files, reject them
      if (item.kind === 'file') {
        file = item?.getAsFile();
      }
    });
  } else {
    if (ev.dataTransfer?.files)
      file = ev.dataTransfer?.files[0];
  }
  if (file) {
    file.text().then(txt => loadEditor(txt));
    ev.preventDefault();
  }
}

function cloneEditorForSave(editor) {
  editor = editor.cloneNode(true);
  editor.querySelector('#shape-menu').remove();
  editor
    .querySelectorAll('.selected')
    .forEach((e) => {
      e.classList.remove('selected');
      if (isNode(e)) {
        onNodeDeselected();
      }
    });
  executeBtn.style.display = 'none';
  executionMethodSel.style.display = 'none';

  for (const v of [...editor.querySelectorAll('.arrow .variable-name')]) {
    const variable = v.querySelector('.value').value;
    v.querySelector('foreignObject').remove();
    v.querySelector('text').textContent = variable;
    v.querySelector('text').setAttribute('visibility', 'visible');
  }
  return editor;
}

function afterEditorLoad(editor) {
  setupEditor(editor);
  return editor;
}

function setupEditor(editor) {
  for (const e of [...editor.querySelectorAll('.template.draggable')]) {
    interact(e)
      .draggable({
        modifiers: [
          interact.modifiers.restrict({
            restriction: editor,
            elementRect: { top: 0, left: 0, bottom: 1, right: 1 },
            endOnly: true,
          }),
        ],
        listeners: {
          end() {
            console.log('dragend1');
          },
        },
      })
      .on(['move', 'drag', 'dragstart'], function(event) {
        let interaction = event.interaction;
        if (
          interaction.pointerIsDown &&
          !interaction.interacting() &&
          event.currentTarget.classList.contains('template')
        ) {
          let original = event.currentTarget;
          let clone = event.currentTarget.cloneNode(true);
          clone.classList.remove('template');
          editor.appendChild(clone);
          if (clone.classList.contains('selectable-template')) {
            clone.classList.remove('selectable-template');
            clone.classList.add('selectable');
          }
          interaction.start(
            { name: 'drag' },
            makeNewElementInteraction(editor, clone, original),
            clone,
          );
        }
      })
      .on('mouseover', (event) => {
        event.currentTarget.classList.add('hovering');
      })
      .on('mouseout', (event) => {
        event.currentTarget.classList.remove('hovering');
      }).on('dragend', (event) => {
      console.log('end drag2');
    });
  }
  interact(editor.querySelector('.trash-zone')).dropzone({
    // Require a 75% element overlap for a drop to be possible
    overlap: 0.75,
    ondragenter: function(event) {
      let draggableElement = event.relatedTarget;
      if (!draggableElement.classList.contains('parentG'))
        draggableElement = draggableElement.closest('.parentG');
      if (draggableElement.getAttribute('left-zone')) {
        const dropzoneElement = event.target;
        dropzoneElement.classList.add('can-accept');
        draggableElement.classList.add('can-drop');
      }
    },
    ondragleave: function(event) {
      let draggableElement = event.relatedTarget;
      if (!draggableElement.classList.contains('parentG'))
        draggableElement = draggableElement.closest('.parentG');
      event.currentTarget.classList.remove('can-accept');
      draggableElement.classList.remove('can-drop');
      draggableElement.setAttribute('left-zone', 'true');
    },
    ondrop: function(event) {
      let draggableElement = event.relatedTarget;
      if (!draggableElement.classList.contains('parentG'))
        draggableElement = draggableElement.closest('.parentG');
      event.currentTarget.classList.remove('can-accept');
      removeObject(editor, draggableElement);
      onEditorUpdated(editor);
      // for (const p of draggableElement.querySelectorAll('.anchor-point[data-attached-handles]')) {
      //   const handles = p.getAttribute('data-attached-handles')
      //     .split(',')
      //     .filter(x => x.length)
      //     .map(id => document.querySelector(`.arrow-handle[data-handle-id='${id}']`));
      //   for (const h of handles) {
      //     detachArrowHandle(h, p);
      //     let other;
      //     if (h.matches('.arrow-handle-start')) {
      //       other = h.closest('.parentG').querySelector('.arrow-handle-end');
      //     } else {
      //       other = h.closest('.parentG').querySelector('.arrow-handle-start');
      //     }
      //     const otherId = other.getAttribute('data-attached-to');
      //     if (otherId) {
      //       const otherAnchor = document.querySelector(`.anchor-point[data-anchor-id='${otherId}']`);
      //       detachArrowHandle(other, otherAnchor);
      //     }
      //     h.closest('.parentG').remove();
      //   }
      // }
      // draggableElement.remove();
    },
  });
  let lastIsDrag = false;
  interact(editor)
    .on(['mouseup'], function(event) {
      console.log('editor onMouseUp', event);
      if (!lastIsDrag) {
        editor
          .querySelectorAll('.selected')
          .forEach((e) => {
            e.classList.remove('selected');
            if (isNode(e)) {
              onNodeDeselected(e);
            }
          });
        executeBtn.style.display = 'none';
        executionMethodSel.style.display = 'none';
      }
      lastIsDrag = false;
    })
    .draggable({
      listeners: {
        end(event) {
          editor.querySelector('.selection-rect').remove();
          lastIsDrag = true;
        },
        start(event) {
          console.log('start', event);
          startX = event.client.x;
          startY = event.client.y;
          endX = startX;
          endY = startY;
          const rect = document.createElementNS(svgNamespace, 'rect');
          rect.setAttribute('x', String(startX));
          rect.setAttribute('y', String(startY));
          rect.setAttribute('width', '0');
          rect.setAttribute('height', '0');
          rect.setAttribute('fill', '#50A8FF3D');
          rect.classList.add('selection-rect');
          editor.appendChild(rect);
        },
        move(event) {
          endX += event.dx;
          endY += event.dy;
          let x = endX < startX ? endX : startX;
          let y = endY < startY ? endY : startY;
          let w = Math.abs(endX - startX);
          let h = Math.abs(endY - startY);

          for (/**@type SVGGeometryElement*/ const e of document.querySelectorAll(
            '.selectable:not(.template) .active-object',
          )) {
            let { x: ex, y: ey } = GetSVGCoordinates(e);
            const sel = e.closest('.selectable');
            if (!sel)
              continue;
            if (ex > x && ey > y && x + w > ex && y + h > ey) {
              if (!sel.classList.contains('selected')) {
                sel.classList.add('selected');
                if (isNode(sel)) {
                  onNodeSelected(sel);
                }
              }
            } else if (sel.matches('.selected')) {
              sel.classList.remove('selected');
              if (isNode(sel)) {
                onNodeDeselected(sel);
              }
            }
          }
          const rect = editor.querySelector('.selection-rect');
          rect.setAttribute('x', x);
          rect.setAttribute('y', y);
          rect.setAttribute('width', w);
          rect.setAttribute('height', h);
        },
      },
    }).styleCursor(false);
  getNodes(editor).forEach(n => addObjectInteractions(editor, n, n));
  getArrows(editor).forEach(a => {
    addObjectInteractions(editor, a, a);
    const fa = document.createElementNS(svgNamespace, 'foreignObject');
    fa.setAttribute('width', '1');
    fa.setAttribute('height', '1');
    fa.style.overflow = 'visible';
    fa.classList.add('variable-editor');
    fa.setAttribute('width', '1');
    fa.setAttribute('width', '1');
    const d = document.createElement('div');
    d.classList.add('value-container');
    const inp = document.createElement('input');
    const value = a.querySelector('text').textContent;
    inp.value = value;
    inp.size = Math.max(1, inp.value.length);
    inp.setAttribute('spellcheck', 'false');
    inp.setAttribute('data-old-value', value);
    inp.setAttribute('value', value);
    inp.classList.add('value');
    inp.style.fontFamily = 'monospace';
    inp.onchange = onVariableNameChange;
    d.appendChild(inp);
    fa.appendChild(d);
    a.querySelector('.variable-name').appendChild(fa);
    a.querySelector('text').setAttribute('visibility', 'hidden');
  });
  onEditorUpdated(editor);
}

function loadEditor(svgText) {
  let editor;
  const div = document.createElement('div');
  div.innerHTML = svgText;
  editor = div.firstChild;
  editor.appendChild(mainEditor.querySelector('#shape-menu').cloneNode(true));
  mainEditor.parentNode.insertBefore(editor, mainEditor);
  mainEditor.remove();
  editor = afterEditorLoad(editor);
  mainEditor = editor;
  onEditorUpdated(mainEditor);
  return editor;
}

function saveToCache(editor) {
  const data = editorToString(editor);
  localStorage.setItem('cached-editor', data);
}

const cache = localStorage.getItem('cached-editor');
if (cache) {
  loadEditor(cache);
} else {
  setupEditor(mainEditor);
}
