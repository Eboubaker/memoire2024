console.log('hello world');
const svgNamespace = 'http://www.w3.org/2000/svg';

// noinspection JSValidateTypes
const editDialog = document.getElementById('editDialog');
/**
 * @type {SVGSVGElement}
 */
const mainEditor = document.querySelector('.editor');

const gCircle = mainEditor.querySelector('.object-circle');
const centerX = mainEditor.querySelector('.object-circle>circle').cx.baseVal
  .value;
const centerY = mainEditor.querySelector('.object-circle>circle').cy.baseVal
  .value;
const radius = gCircle.querySelector('.active-object').getAttribute('r');
const anchorPoints = [];
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
require(['vs/editor/editor.main'], () => {
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

function onNodeSelected(node) {
  validateNode(node);
  executeBtn.style.display = 'block';
}

function onNodeDeselected(node) {
  validateNode(node);
  if ([...document.querySelectorAll('.selected')].length === 0) {
    executeBtn.style.display = 'none';
  }
}

executeBtn.addEventListener('click', () => {
  getNodes().filter(n => n.matches('.selected')).forEach(executeNode);
});

function deleteNode(editorWindow, node) {
  validateNode(node);
  if (node.matches('.selected')) {
    node.classList.remove('selected');
    onNodeDeselected(node);
  }
  for (const p of node.querySelectorAll(
    '.anchor-point[data-attached-handles]',
  )) {
    const handles = p
      .getAttribute('data-attached-handles')
      .split(',')
      .filter((x) => x.length)
      .map((id) =>
        editorWindow.querySelector(`.arrow-handle[data-handle-id='${id}']`),
      );
    for (const h of handles) {
      removeObject(h.closest('.arrow'));
    }
  }
}


// Function to call when the circle is moved
function updateArrowPosition(handle, dx, dy) {
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
}

let handlesCounter = 1;

function addArrowHandleInteraction(editorWindow, head) {
  console.log(anchorPoints);
  const handleId = String(handlesCounter++);
  head.setAttribute('data-handle-id', handleId);
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
            handles = handles.filter((x) => x !== handleId);
            if (handles.length) {
              p.setAttribute('data-attached-handles', handles.join(','));
            } else {
              p.removeAttribute('data-attached-handles');
            }
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
        updateArrowPosition(handle, dx, dy);
      },
    },
  });
  head.interactions = head.interactions || [];
  head.interactions.push(interaction);
  return interaction;
}

function getTransformation(target) {
  if (target.tagName === 'svg' || !target) {
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
  const input = handle.closest('.arrow').querySelector('.variable-name .value');
  input.focus();
  input.selectionStart = 0;
  input.selectionEnd = input.value.length;
}

function detachArrowHandle(handle, anchorPoint) {
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
  anchorPoint.setAttribute('data-attached-handles', handles);
}

let anchorCount = 0;

function onVariableNameChange() {
  this.size = Math.max(1, this.value.length - 1);
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
  console.log("addedVariables", addedVariables);
  console.log("deletedVariables", deletedVariables);
  deletedVariables.forEach(v => {
    setNodeFunction(start, removeVariableFromReturn(getNodeFunction(start), v));
    setNodeFunction(end, removeFuncParam(getNodeFunction(end), v));
  });
  addedVariables.forEach(v => {
    setNodeFunction(start, addVariableToFunctionReturnObject(getNodeFunction(start), v));
    setNodeFunction(end, addFuncParam(getNodeFunction(end), v));
  });
  console.log('changed');
  this.setAttribute('data-old-value', value);
  return;
}

function isNode(elem) {
  return elem.matches('.object-circle');
}

function trySelectObject(object) {
  if (object.classList.contains('selectable')) {
    mainEditor
      .querySelectorAll('.selected')
      .forEach((e) => e.classList.remove('selected'));
    object.classList.add('selected');
    if (isNode(object)) {
      onNodeSelected(object);
    }
  }
}

let currentEdit = null;
let nextNodeNumber = 1;

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
  codeEditor.setValue(getNodeFunction(node));
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

function getNodeInputs(node) {
  validateNode(node);
  return [...new Set(getIncomingArrows(node).flatMap(getArrowVariables))];
}

function getNodeOutputs(node) {
  validateNode(node);
  return [...new Set(getOutgoingArrows(node).flatMap(getArrowVariables))];
}

function getNodes() {
  return [...mainEditor.querySelectorAll('.object-circle:not(.template)')];
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

function executeNode(node) {
  validateNode(node);
  const name = getNodeName(node);
  let func;
  try {
    const sourceCode = getNodeFunction(node);
    const encodedSourceCode = btoa(sourceCode);
    func = eval?.('(' + sourceCode + ')'
      + `    //# sourceMappingURL=data:application/json;base64,${encodedSourceCode}\n//# sourceURL=process.js`);
  } catch (e) {
    console.error(`syntax error in node "${name}"`, node);
    throw e;
  }
  const deps = getNodeDependencies(node);
  const inputs = getNodeInputs(node).map(v => {
    const depNode = deps.find(d => d.variables.includes(v)).node;
    return executeNode(depNode)[v];
  });
  let outputs;
  try {
    outputs = func(...inputs);
  } catch (e) {
    console.error(`error while executing node "${name}"`, node);
    throw e;
  }
  console.log(`"${name}" outputs: `, outputs);
  return outputs;
}

function getNodeDependencies(node) {
  return getIncomingArrows(node).map(arr => {
    return { variables: getArrowVariables(arr), node: getStartingNode(arr) };
  });
}

function executeSimulation() {
  getNodes()
    .filter(isLeaf)
    .forEach(executeNode);
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

function makeNewElementInteraction(editorWindow, target, template = undefined) {
  let { x, y } = getTransformation(template);
  console.log(x, y);
  const myAnchorPoints = [];
  if (target.matches('.object-circle')) {
    target.querySelector('.nodeName').innerHTML =
      'Node (' + nextNodeNumber++ + ')';
    target.querySelector('.nodeName').onclick = function() {
      openNodeEditor(target);
    };
    myAnchorPoints.push(
      ...[...target.querySelectorAll('.anchor-point>circle')],
      // .map(e => {
      //   const tr = getTransformation(e);
      //   return {
      //     anchorPoint: e,
      //     // TODO: why add 20?
      //     x: 20 + tr.x + Number(e.getAttribute('cx')),
      //     y: tr.y + Number(e.getAttribute('cy')),
      //   };
      // }),
    );
    anchorPoints.push(...myAnchorPoints);
    for (const p of target.querySelectorAll('.anchor-point')) {
      const anchorId = String(anchorCount++);
      p.setAttribute('data-anchor-id', anchorId);
      interact(p)
        .dropzone({
          ondragenter: function(event) {
          },
          ondragleave: function(event) {
          },
          ondrop: function(event) {
            attachArrowHandle(editorWindow, event.relatedTarget, event.currentTarget);
          },
        })
        .draggable({})
        .on('dragstart', (event) => {
          // create new arrow, put its arrow-handle-end in the
          // position of this anchor, and move the current
          // interaction to the arrow-handle-start so it moves with the mouse
          const template = editorWindow.querySelector('.arrow.template');
          const arrow = template.cloneNode(true);
          arrow.classList.remove('template', 'draggable');
          editorWindow.appendChild(arrow);
          makeNewElementInteraction(editorWindow, arrow, template);
          const head = arrow.querySelector('.arrow-handle-end');
          const start = arrow.querySelector('.arrow-handle-start');
          start.setAttribute('data-attached-to', anchorId);
          const p = event.target;
          updateArrowPosition(head, -65, 0);
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
        });
    }
  }
  if (target.matches('.arrow')) {
    addArrowHandleInteraction(editorWindow, target.querySelector('.arrow-handle-start'));
    addArrowHandleInteraction(editorWindow, target.querySelector('.arrow-handle-end'));
  }
  const interaction = interact(target).on('mousedown', (event) => {
    trySelectObject(editorWindow, event.currentTarget);
    event.stopPropagation();
  });
  if (target.classList.contains('draggable')) {
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
      })
      .on(['dragmove'], function(event) {
        const target = event.currentTarget;
        x += event.dx;
        y += event.dy;
        if (target.classList.contains('selected')) {
          for (const e of editorWindow.querySelectorAll(
            '.selectable.selected',
          )) {
            if (e === target) continue;
            moveObject(e, event.dx, event.dy);
          }
        } else {
          moveObject(target, event.dx, event.dy);
        }
        myAnchorPoints.forEach((anchorPoint) => {
          anchorPoint.x += event.dx;
          anchorPoint.y += event.dy;
        });
        target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
        for (const p of target.querySelectorAll('.anchor-point')) {
          let handles = p.getAttribute('data-attached-handles');
          if (!handles) continue;
          handles = handles.split(',').filter((x) => x.length);
          handles = handles.map((id) =>
            editorWindow.querySelector(`[data-handle-id='${id}']`),
          );
          for (const h of handles) {
            updateArrowPosition(h, event.dx, event.dy);
          }
        }
      });
  }
  interaction
    .on('mouseover', (event) => {
      event.currentTarget.classList.add('hovering');
    })
    .on('mouseout', (event) => {
      event.currentTarget.classList.remove('hovering');
    });
  target.interactions = target.interactions || [];
  target.interactions.push(interaction);
  return interaction;
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
  node.querySelector('.code').setAttribute('data-code', func);
}

function validateFunc(func) {
  // todo: check code has 1 function and 1 return object...
  return true;
}

function getNodeFunction(node) {
  validateNode(node);
  let func = node.querySelector('.code').getAttribute('data-code');
  if (!func) {
    const inputs = getNodeInputs(node);
    const outputs = getNodeOutputs(node);
    func = generateFunction('process', inputs, outputs);
  }
  return func;
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
  currentEdit.querySelector('.code').setAttribute('data-code', code);
  codeEditor.setValue('');
  currentEdit = null;
  editDialog.style.display = 'none';
  editDialog.style.pointerEvents = 'none';
}

function moveObject(object) {
  // TODO:
}

function removeObject(editorWindow, obj) {
  if (!editorWindow.contains(obj)) return;
  if (obj.classList.contains('object-circle')) {
    deleteNode(obj);
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
      detachArrowHandle(obj, anchor);
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
      removeObject(selected);
    }
  }
});

function dropArrow(arrow) {
  mainEditor.querySelectorAll('.anchor-point');
}

function saveEditor(editor) {
  console.log('Save');
  editor = beforeEditorSave(editor);
  const blob = new Blob([editor.outerHTML], { type: 'image/svg' });
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

function beforeEditorSave(editor) {
  editor = editor.cloneNode(true);
  editor.querySelector('#shape-menu').remove();
  for(const v of [...editor.querySelectorAll('.arrow .variable-name')]) {
    const variable = v.querySelector('.value').value;
    v.querySelector('foreignObject').remove();
    v.querySelector('text').textContent = variable;
    v.querySelector('text').setAttribute('visibility', 'visible');
  }
  return editor;
}

function afterEditorLoad(editor) {
  editor.appendChild(mainEditor.querySelector('#shape-menu').cloneNode(true));
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
      removeObject(draggableElement);
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
  interact(editor)
    .on(['mousedown'], function(event) {
      console.log('editor onMouseDown', event);
      editor
        .querySelectorAll('.selected')
        .forEach((e) => e.classList.remove('selected'));
      executeBtn.style.display = 'none';
    })
    .draggable({
      listeners: {
        end(event) {
          editor.querySelector('.selection-rect').remove();
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
            } else {
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
}

function loadEditor(file) {
  let editor;
  const div = document.createElement('div');
  div.innerHTML = file.readAsText();
  editor = afterEditorLoad(editor);
  document.querySelector('.editor').remove();
  document.prepend(editor);
  return editor;
}

setupEditor(mainEditor);
