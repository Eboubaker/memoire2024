console.log('hello world');
const editorWindow =
  document.getElementById('editor-window');

// console.log(editorWindow);

// const SVG_TAGS = [
//   'circle',
//   'line',
//   'text',
//   'g',
//   'rect',
//   'path',
// ];
//
// /**
//  * @returns {HTMLElement | SVGSVGElement}
//  */
// function h(tag = 'svg', attributes = {}, children = []) {
//   let elem;
//   if (SVG_TAGS.includes(tag)) {
//     elem = document.createElementNS(
//       'http://www.w3.org/2000/svg',
//       tag,
//     );
//   } else {
//     elem = document.createElement(tag);
//   }
//   if (attributes) {
//     for (const [key, value] of Object.entries(attributes)) {
//       elem.setAttribute(key, String(value));
//     }
//   }
//   if (children) {
//     if (Array.isArray(children)) {
//       for (const child of children) {
//         elem.appendChild(child);
//       }
//     } else {
//       elem.appendChild(children);
//     }
//   }
//   return elem;
// }

//
// editorWindow.append(
//   h('circle', {
//     'cx': '50',
//     'cy': '50',
//     'r': '30',
//     'fill': 'none',
//     'pointer-events': 'all',
//     'cursor': 'move',
//     'stroke': 'black',
//     'class': 'node',
//     'stroke-width': '1',
//   }),
// );
// editorWindow.append(
//   h('line', {
//     'x1': '50',
//     'x2': '50',
//     'y1': '30',
//     'y2': '40',
//     'pointer-events': 'all',
//     'stroke': 'black',
//
//     'class': 'line',
//     'stroke-width': '3',
//   }),
// );
let TrueCoords = null;
let GrabPoint = null;
let BackDrop = null;
let DragTarget = null;
let HoverTarget = null;

TrueCoords = editorWindow.createSVGPoint();
GrabPoint = editorWindow.createSVGPoint();

function GetTrueCoords(evt) {
  const newScale = editorWindow.currentScale;
  const translation = editorWindow.currentTranslate;
  TrueCoords.x = (evt.clientX - translation.x) / newScale;
  TrueCoords.y = (evt.clientY - translation.y) / newScale;
}

BackDrop = document.getElementById('BackDrop');

editorWindow.addEventListener('mousedown', evt => {
  const targetElement = evt.target;
  if (BackDrop === targetElement) return;
  if (!targetElement.classList.contains('draggable')) return;
  console.log('grab', targetElement);

  DragTarget = targetElement;
  if (DragTarget.classList.contains('template')) {
    console.log('copying template');
    DragTarget = DragTarget.cloneNode(true);
    DragTarget.classList.remove('template');
    editorWindow.appendChild(DragTarget);
  }
  // move up
  DragTarget.parentNode.appendChild(DragTarget);
  DragTarget.setAttributeNS(
    null,
    'pointer-events',
    'none',
  );

  const transMatrix = DragTarget.getCTM();
  GrabPoint.x = TrueCoords.x - Number(transMatrix.e);
  GrabPoint.y = TrueCoords.y - Number(transMatrix.f);
});
editorWindow.addEventListener('mousemove', evt => {
  GetTrueCoords(evt);
  if (HoverTarget) {
    HoverTarget.classList.remove('hovering');
    HoverTarget = null;
  }
  if (evt.target && evt.target.classList.contains('draggable')) {
    evt.target.classList.add('hovering');
    HoverTarget = evt.target;
  }
  if (DragTarget) {
    console.log('Dragging', evt.clientX, evt.clientY);
    const newX = TrueCoords.x - GrabPoint.x;
    const newY = TrueCoords.y - GrabPoint.y;

    DragTarget.setAttributeNS(
      null,
      'transform',
      'translate(' + newX + ',' + newY + ')',
    );
    DragTarget.classList.add('dragging');
  }
});
editorWindow.addEventListener('mouseup', evt => {
    if (!DragTarget) return;
    const targetElement = evt.target;

    DragTarget.setAttributeNS(
      null,
      'pointer-events',
      'all',
    );
    DragTarget.classList.remove('dragging');
    console.log(DragTarget.tagName + '.' + [...DragTarget.classList].join('.'), 'was dropped on', targetElement.tagName + '.' + [...targetElement.classList].join('.'));
    if (targetElement.closest('#shape-menu')) {
      DragTarget.remove();
    }

    DragTarget = null;
  },
);
