import {createNativeDragSource, matchNativeItemType} from './NativeDragSources';

function getEventClientOffset(e) {
  return {
    x: e.clientX,
    y: e.clientY
  };
}

const ELEMENT_NODE = 1;
function getNodeClientOffset(node) {
  const el = node.nodeType === ELEMENT_NODE ? node : node.parentElement;

  if (!el) {
    return null;
  }

  const {top, left} = el.getBoundingClientRect();
  return {x: left, y: top};
}

export default class MouseBackend {
  constructor(manager) {
    this.actions = manager.getActions();
    this.monitor = manager.getMonitor();
    this.registry = manager.getRegistry();

    this.sourceNodes = {};
    this.sourceNodesOptions = {};
    this.sourcePreviewNodes = {};
    this.sourcePreviewNodesOptions = {};
    this.targetNodes = {};
    this.targetNodeOptions = {};
    this.mouseClientOffset = {};
    this.currentNativeSource = null;
    this.currentNativeHandle = null;

    this.getSourceClientOffset = this.getSourceClientOffset.bind(this);

    this.handleMoveStart = this.handleMoveStart.bind(this);
    this.handleMoveStartCapture = this.handleMoveStartCapture.bind(this);
    this.handleMoveCapture = this.handleMoveCapture.bind(this);
    this.handleMoveEndCapture = this.handleMoveEndCapture.bind(this);
    this.handleNativeDrag = this.handleNativeDrag.bind(this);
    this.handleNativeEndDrag = this.handleNativeEndDrag.bind(this);
  }

  setup() {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.constructor.isSetUp) {
      throw new Error('Cannot have two DnD Mouse backend at the same time');
    }

    this.constructor.isSetUp = true;
    window.addEventListener('mousedown', this.handleMoveStartCapture, true);
    window.addEventListener('mousedown', this.handleMoveStart);
    window.addEventListener('mousemove', this.handleMoveCapture, true);
    window.addEventListener('mouseup', this.handleMoveEndCapture, true);
    window.addEventListener('dragover', this.handleNativeDrag, true);
    window.addEventListener('dragleave', this.handleNativeEndDrag, true);
    window.addEventListener('drop', this.handleNativeEndDrag, true);
  }

  getSourceClientOffset(sourceId) {
    return getNodeClientOffset(this.sourceNodes[sourceId]);
  }

  teardown() {
    if (typeof window === 'undefined') {
      return;
    }

    this.constructor.isSetUp = false;

    this.mouseClientOffset = {};
    window.removeEventListener('mousedown', this.handleMoveStartCapture, true);
    window.removeEventListener('mousedown', this.handleMoveStart);
    window.removeEventListener('mousemove', this.handleMoveCapture, true);
    window.removeEventListener('mouseup', this.handleMoveEndCapture, true);
    window.removeEventListener('dragover', this.handleNativeDrag, true);
    window.removeEventListener('dragleave', this.handleNativeEndDrag, true);
    window.removeEventListener('drop', this.handleNativeEndDrag, true);
  }

  connectDragSource(sourceId, node) {
    this.sourceNodes[sourceId] = node;

    const handleMoveStart = this.handleMoveStart.bind(this, sourceId);
    node.addEventListener('mousedown', handleMoveStart);

    return () => {
      delete this.sourceNodes[sourceId];
      node.removeEventListener('mousedown', handleMoveStart);
    };
  }

  connectDragPreview(sourceId, node, options) {
    this.sourcePreviewNodesOptions[sourceId] = options;
    this.sourcePreviewNodes[sourceId] = node;

    return () => {
      delete this.sourcePreviewNodes[sourceId];
      delete this.sourcePreviewNodesOptions[sourceId];
    };
  }

  connectDropTarget(targetId, node) {
    this.targetNodes[targetId] = node;

    return () => {
      delete this.targetNodes[targetId];
    };
  }

  handleMoveStartCapture() {
    this.moveStartSourceIds = [];
  }

  handleMoveStart(sourceId) {
    this.moveStartSourceIds.unshift(sourceId);
  }

  handleMoveStart(e) {
    const clientOffset = getEventClientOffset(e);
    if (clientOffset) {
      this.mouseClientOffset = clientOffset;
    }
  }

  handleMoveCapture(e) {
    const {moveStartSourceIds} = this;
    const clientOffset = getEventClientOffset(e);
    if (!clientOffset) return;
    if (
      !this.monitor.isDragging() &&
      this.mouseClientOffset.hasOwnProperty('x') &&
      moveStartSourceIds &&
      (this.mouseClientOffset.x !== clientOffset.x ||
        this.mouseClientOffset.y !== clientOffset.y)
    ) {
      this.moveStartSourceIds = null;
      this.actions.beginDrag(moveStartSourceIds, {
        clientOffset: this.mouseClientOffset,
        getSourceClientOffset: this.getSourceClientOffset,
        publishSource: false
      });
    }
    if (!this.monitor.isDragging()) {
      return;
    }

    const sourceNode = this.sourceNodes[this.monitor.getSourceId()];
    this.installSourceNodeRemovalObserver(sourceNode);

    this.actions.publishDragSource();

    e.preventDefault();

    const matchingTargetIds = this.getMatchingTargetIds(clientOffset);

    this.actions.hover(matchingTargetIds, {
      clientOffset
    });
  }

  getMatchingTargetIds(clientOffset) {
    return Object.keys(this.targetNodes).filter(targetId => {
      const boundingRect = this.targetNodes[targetId].getBoundingClientRect();
      return (
        clientOffset.x >= boundingRect.left &&
        clientOffset.x <= boundingRect.right &&
        clientOffset.y >= boundingRect.top &&
        clientOffset.y <= boundingRect.bottom
      );
    });
  }

  handleMoveEndCapture(e) {
    if (!this.monitor.isDragging() || this.monitor.didDrop()) {
      this.moveStartSourceIds = null;
      return;
    }

    e.preventDefault();

    this.mouseClientOffset = {};

    this.uninstallSourceNodeRemovalObserver();
    this.actions.drop();
    this.actions.endDrag();
  }

  installSourceNodeRemovalObserver(node) {
    this.uninstallSourceNodeRemovalObserver();

    this.draggedSourceNode = node;
    this.draggedSourceNodeRemovalObserver = new window.MutationObserver(() => {
      if (!node.parentElement) {
        this.resurrectSourceNode();
        this.uninstallSourceNodeRemovalObserver();
      }
    });

    if (!node || !node.parentElement) {
      return;
    }

    this.draggedSourceNodeRemovalObserver.observe(node.parentElement, {
      childList: true
    });
  }

  resurrectSourceNode() {
    this.draggedSourceNode.style.display = 'none';
    this.draggedSourceNode.removeAttribute('data-reactid');
    document.body.appendChild(this.draggedSourceNode);
  }

  uninstallSourceNodeRemovalObserver() {
    if (this.draggedSourceNodeRemovalObserver) {
      this.draggedSourceNodeRemovalObserver.disconnect();
    }

    this.draggedSourceNodeRemovalObserver = null;
    this.draggedSourceNode = null;
  }

  handleNativeDrag(e) {
    const nativeType = matchNativeItemType(e.dataTransfer);
    if (!nativeType) {
      return;
    }

    if (!this.monitor.isDragging()) {
      const SourceType = createNativeDragSource(nativeType);
      this.currentNativeSource = new SourceType();
      this.currentNativeHandle = this.registry.addSource(
        nativeType,
        this.currentNativeSource
      );

      this.actions.beginDrag([this.currentNativeHandle]);
    }

    const clientOffset = getEventClientOffset(e);
    this.actions.publishDragSource();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const matchingTargetIds = this.getMatchingTargetIds(clientOffset);
    this.actions.hover(matchingTargetIds, {
      clientOffset
    });
  }

  handleNativeEndDrag(e) {
    const nativeType = matchNativeItemType(e.dataTransfer);
    if (!nativeType) {
      return null;
    }

    if (e.type !== 'drop' && e.relatedTarget !== null) {
      return;
    }

    if (e.type == 'drop') {
      e.preventDefault();
      this.currentNativeSource.mutateItemByReadingDataTransfer(e.dataTransfer);
      this.actions.drop();
    }

    this.actions.endDrag();
    this.registry.removeSource(this.currentNativeHandle);

    this.currentNativeSource = null;
    this.currentNativeHandle = null;
  }
}
