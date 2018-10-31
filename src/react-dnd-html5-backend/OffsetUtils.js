const ELEMENT_NODE = 1;

export function getNodeClientOffset(node) {
  const el = node.nodeType === ELEMENT_NODE ? node : node.parentElement;

  if (!el) {
    return null;
  }

  const {top, left} = el.getBoundingClientRect();
  return {x: left, y: top};
}

export function getEventClientOffset(e) {
  return {
    x: e.clientX,
    y: e.clientY
  };
}
