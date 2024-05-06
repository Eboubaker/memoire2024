Array.prototype.unique = function () {
  return [...new Set(this)]
}

console.log('hello world');
const svgNamespace = 'http://www.w3.org/2000/svg';

// noinspection JSValidateTypes
/**
 * @type {SVGSVGElement}
 */
const editorWindow = document.getElementById('editor-window');
const gCircle = editorWindow.querySelector('.object-circle');
const centerX = editorWindow.querySelector('.object-circle>circle').cx.baseVal.value;
const centerY = editorWindow.querySelector('.object-circle>circle').cy.baseVal.value;
const radius = gCircle.querySelector('.active-object').getAttribute('r');
const anchorPoints = [];
const numberOfPoints = 8;
for (let i = 0; i < numberOfPoints; i++) {
  // Calculate angle in radians
  const angle = ((2 * Math.PI) / numberOfPoints) * i; // 45 degrees * i, converted to radians
  const template = editorWindow.querySelector('.anchor-fragment');
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
let startX = 0,
  endX = 0;
let startY = 0,
  endY = 0;
interact(editorWindow)
  .on(['mousedown'], function(event) {
    console.log('editor onMouseDown', event);
    document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
  })
  .draggable({
    listeners: {
      end(event) {
        editorWindow.querySelector('.selection-rect').remove();
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
        editorWindow.appendChild(rect);
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
          if (ex > x && ey > y && x + w > ex && y + h > ey) {
            if (!e.closest('.selectable').classList.contains('selected')) {
              e.closest('.selectable').classList.add('selected');
            }
          } else {
            e.closest('.selectable').classList.remove('selected');
          }
        }
        const rect = editorWindow.querySelector('.selection-rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
      },
    },
  });

// Function to call when the circle is moved
function updateArrowPosition(handle, dx, dy) {
  // Update the position of the circle handle based on the drag
  const arrowLine = handle.closest('g').querySelector('.arrow-line');
  const d = arrowLine.getAttribute('d');
  let [M, x1, y1, L, x2, y2] = d.split(' ').map(x => Number(x));
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
  dotsOriginalPositions.forEach(dotInfo => {
    // Calculate new position based on theta and original offsets
    const newX = x2 + dotInfo.dx * Math.cos(theta) - dotInfo.dy * Math.sin(theta);
    const newY = y2 + dotInfo.dx * Math.sin(theta) + dotInfo.dy * Math.cos(theta);

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
  const vn = handle.closest('g').querySelector('.variable-name');
  vn.setAttribute('transform', 'translate(' + newDots[3].x + ',' + newDots[3].y + ')');
}

let handlesCounter = 1;

function addArrowHandleInteraction(head) {
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
        for (const p of document.querySelectorAll('[data-attached-handles]')) {
          let handles = p
            .getAttribute('data-attached-handles')
            .split(',')
            .filter(x => x.length);
          if (handles.includes(handleId)) {
            handles = handles.filter(x => x !== handleId);
            if (handles.length) {
              p.setAttribute('data-attached-handles', handles.join(','));
            } else {
              p.removeAttribute('data-attached-handles');
            }
          }
        }
        event.interaction.interactable.options.drag.modifiers[0].options.targets = anchorPoints.map(
          p => {
            const rect = p.getBoundingClientRect();
            return {
              x: rect.x + 5,
              y: rect.y + 5,
            };
          },
        );
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

function attachArrowHandle(handle, anchorPoint) {
  if (!(handle instanceof SVGElement)) {
    // look by id
    handle = document.querySelector(`[data-handle-id="${handle}"]`);
  }
  if (!(anchorPoint instanceof SVGElement)) {
    // look by id
    anchorPoint = document.querySelector(`[data-anchor-id="${anchorPoint}"]`);
  }
  let handles = anchorPoint.getAttribute('data-attached-handles') || '';
  const handleId = handle.getAttribute('data-handle-id');
  handles = [...handles.split(',').filter(x => x.length), handleId].join(',');
  anchorPoint.setAttribute('data-attached-handles', handles);
  handle.setAttribute('data-attached-to', anchorPoint.getAttribute('data-anchor-id'));
}

function detachArrowHandle(handle, anchorPoint) {
  if (!(handle instanceof SVGElement)) {
    // look by id
    handle = document.querySelector(`[data-handle-id="${handle}"]`);
  }
  if (!(anchorPoint instanceof SVGElement)) {
    // look by id
    anchorPoint = document.querySelector(`[data-anchor-id="${anchorPoint}"]`);
  }
  const handleId = handle.getAttribute('data-handle-id');
  let handles = anchorPoint.getAttribute('data-attached-handles') || '';
  handles = handles
    .split(',')
    .filter(x => x.length)
    .filter(x => x !== handleId)
    .join(',');
  anchorPoint.setAttribute('data-attached-handles', handles);
}

let anchorCount = 0;

function trySelectObject(object) {
  if (object.classList.contains('selectable')) {
    document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
    object.classList.add('selected');
  }
}

let currentEdit = null;
let nextNodeNumber = 1;

function openNodeEditor(node) {
  currentEdit = node;
  editDialog.showModal();
  editDialog.querySelector('#nodeName').value = node.querySelector('.nodeName').innerHTML;
}

function getOutgoingArrows(node) {
  if (!node.matches('.object-circle')) {
    console.error('not a node', node);
    throw new Error('not a node');
  }
  return [...node.querySelectorAll('.anchor-point')]
    .map(e => e.getAttribute('data-attached-handles'))
    .filter(att => !!att)
    .flatMap(ids =>
      ids.split(',').map(id => document.querySelector(`.arrow-handle-start[data-handle-id="${id}"]`)))
    .filter(x => !!x)
    .map(h => h.closest('.arrow'));
}

function getIncomingArrows(node) {
  if (!node.matches('.object-circle')) {
    console.error('not a node', node);
    throw new Error('not a node');
  }
  return [...node.querySelectorAll('.anchor-point')]
    .map(e => e.getAttribute('data-attached-handles'))
    .filter(att => !!att)
    .flatMap(ids =>
      ids.split(',').map(id => document.querySelector(`.arrow-handle-end[data-handle-id="${id}"]`)))
    .filter(x => !!x)
    .map(h => h.closest('.arrow'));
}

function getStartingNode(arrow) {
  if (!arrow.matches('.arrow')) {
    console.error('not an arrow', arrow);
    throw new Error('not an arrow');
  }
  const id = arrow.querySelector('.arrow-handle-start').getAttribute('data-attached-to');
  return document.querySelector(`.anchor-point[data-anchor-id="${id}"]`).closest('.object-circle');
}
function getArrowVariables(arrow) {
  if (!arrow.matches('.arrow')) {
    console.error('not an arrow', arrow);
    throw new Error('not an arrow');
  }
  return arrow.querySelector('.variable-name .value').innerText.trim().split(',')
}
function getNodeInputs(node) {
  if (!node.matches('.object-circle')) {
    console.error('not a node', node);
    throw new Error('not a node');
  }
  return getIncomingArrows(node).flatMap(getArrowVariables).unique();
}
function getNodeOutputs(node) {
  if (!node.matches('.object-circle')) {
    console.error('not a node', node);
    throw new Error('not a node');
  }
  return getOutgoingArrows(node).flatMap(getArrowVariables).unique();
}
function getEndingNode(arrow) {
  if (!arrow.matches('.arrow')) {
    console.error('not an arrow', arrow);
    throw new Error('not an arrow');
  }
  const id = arrow.querySelector('.arrow-handle-end').getAttribute('data-attached-to');
  return document.querySelector(`.anchor-point[data-anchor-id="${id}"]`).closest('.object-circle');
}

function makeNewElementInteraction(target, template = undefined) {
  let { x, y } = getTransformation(template);
  console.log(x, y);
  const myAnchorPoints = [];
  if (target.matches('.object-circle')) {
    target.querySelector('.nodeName').innerHTML = 'Node (' + (nextNodeNumber++) + ')';
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
            attachArrowHandle(event.relatedTarget, event.currentTarget);
          },
        })
        .draggable({})
        .on('dragstart', event => {
          // create new arrow, put its arrow-handle-end in the
          // position of this anchor, and move the current
          // interaction to the arrow-handle-start so it moves with the mouse
          const template = document.querySelector('.arrow.template');
          const arrow = template.cloneNode(true);
          arrow.classList.remove('template', 'draggable');
          editorWindow.appendChild(arrow);
          makeNewElementInteraction(arrow, template);
          const head = arrow.querySelector('.arrow-handle-end');
          const start = arrow.querySelector('.arrow-handle-start');
          start.setAttribute('data-attached-to', anchorId);
          const p = event.target;
          updateArrowPosition(head, -65, 0);
          attachArrowHandle(start, p);
          const coords = GetSVGCoordinates(p);
          coords.x += 5;
          coords.y += 5;
          const m = editorWindow.createSVGMatrix().translate(coords.x, coords.y).rotate(0); // Rotate if needed, based on the angle of the arrow line
          // Create an SVGTransform object from this matrix
          const trans = arrow.transform.baseVal.createSVGTransformFromMatrix(m);
          arrow.transform.baseVal.clear(); // Remove any existing transformations
          arrow.transform.baseVal.appendItem(trans);

          event.interaction.start({ name: 'drag' }, head.interactions[0], head);
        });
    }
  }
  if (target.matches('.arrow')) {
    addArrowHandleInteraction(target.querySelector('.arrow-handle-start'));
    addArrowHandleInteraction(target.querySelector('.arrow-handle-end'));
  }
  const interaction = interact(target)
    .on('mousedown', event => {
      trySelectObject(event.currentTarget);
      event.stopPropagation();
    });
  if (target.classList.contains('draggable')) {
    interaction.draggable({
      modifiers: [
        interact.modifiers.restrict({
          restriction: editorWindow,
          elementRect: { top: 0, left: 0, bottom: 1, right: 1 },
          endOnly: true,
        }),
      ],
    })
      .on('dragstart', event => {
        event.currentTarget.classList.add('dragging');
      }).on('dragend', event => {
      event.currentTarget.classList.remove('dragging');
    })
      .on(['dragmove'], function(event) {
        const target = event.currentTarget;
        x += event.dx;
        y += event.dy;
        if (target.classList.contains('selected')) {
          for (const e of editorWindow.querySelectorAll('.selectable.selected')) {
            if (e === target)
              continue;
            moveObject(e, event.dx, event.dy);
          }
        } else {
          moveObject(target, event.dx, event.dy);
        }
        myAnchorPoints.forEach(anchorPoint => {
          anchorPoint.x += event.dx;
          anchorPoint.y += event.dy;
        });
        target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
        for (const p of target.querySelectorAll('.anchor-point')) {
          let handles = p.getAttribute('data-attached-handles');
          if (!handles) continue;
          handles = handles.split(',').filter(x => x.length);
          handles = handles.map(id => document.querySelector(`[data-handle-id='${id}']`));
          for (const h of handles) {
            updateArrowPosition(h, event.dx, event.dy);
          }
        }
      });
  }
  interaction.on('mouseover', event => {
    event.currentTarget.classList.add('hovering');
  })
    .on('mouseout', event => {
      event.currentTarget.classList.remove('hovering');
    });
  target.interactions = target.interactions || [];
  target.interactions.push(interaction);
  return interaction;
}

function saveNode() {
  currentEdit.querySelector('.nodeName').innerHTML = editDialog.querySelector('#nodeName').value;
  currentEdit = null;
  editDialog.close();
}

function moveObject(object) {
  // TODO:
}

/**
 *
 * @param obj SVGElement
 */
function removeObject(obj) {
  if (!editorWindow.contains(obj)) return;
  if (obj.classList.contains('object-circle')) {
    for (const p of obj.querySelectorAll('.anchor-point[data-attached-handles]')) {
      const handles = p
        .getAttribute('data-attached-handles')
        .split(',')
        .filter(x => x.length)
        .map(id => document.querySelector(`.arrow-handle[data-handle-id='${id}']`));
      for (const h of handles) {
        removeObject(h.closest('.arrow'));
      }
    }
  } else if (obj.classList.contains('arrow')) {
    const startHandle = obj.querySelector('.arrow-handle-start');
    const endHandle = obj.querySelector('.arrow-handle-end');
    removeObject(startHandle);
    removeObject(endHandle);
  } else if (obj.classList.contains('arrow-handle')) {
    const anchorId = obj.getAttribute('data-attached-to');
    if (anchorId) {
      const anchor = document.querySelector(`.anchor-point[data-anchor-id='${anchorId}']`);
      detachArrowHandle(obj, anchor);
    }
  } else {
    throw new Error('how to remove this?: ' + obj);
  }
  obj.remove();
}

window.addEventListener('keydown', function(event) {
  // check del key
  if (event.key === 'Delete') {
    for (const selected of document.querySelectorAll('.selected')) {
      removeObject(selected);
    }
  }
});

function dropArrow(arrow) {
  document.querySelectorAll('.anchor-point');
}

interact(document.querySelector('.trash-zone')).dropzone({
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
interact('.template.draggable')
  .draggable({
    modifiers: [
      interact.modifiers.restrict({
        restriction: editorWindow,
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
      original.parentElement.appendChild(clone);
      if (clone.classList.contains('selectable-template')) {
        clone.classList.remove('selectable-template');
        clone.classList.add('selectable');
      }
      interaction.start({ name: 'drag' }, makeNewElementInteraction(clone, original), clone);
    }
  })
  .on('mouseover', event => {
    event.currentTarget.classList.add('hovering');
  })
  .on('mouseout', event => {
    event.currentTarget.classList.remove('hovering');
  });
document.querySelector('.code').addEventListener('keydown', function(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = this.selectionStart;
    const end = this.selectionEnd;

    // set textarea value to: text before caret + tab + text after caret
    this.value = this.value.substring(0, start) +
      '   ' + this.value.substring(end);

    // put caret at right position again
    this.selectionStart =
      this.selectionEnd = start + 1;
  }
});

