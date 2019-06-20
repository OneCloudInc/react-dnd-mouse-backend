import {
  getEventClientOffset,
  getNodeClientOffset
} from './react-dnd-html5-backend/OffsetUtils.js';

import {
  createNativeDragSource,
  matchNativeItemType
} from './react-dnd-html5-backend/NativeDragSources';

export default class MouseBackend {
  constructor(manager) {
    this.actions = manager.getActions();
    this.monitor = manager.getMonitor();
    this.registry = manager.getRegistry();

    this.sourceNodes = {};
    this.targetNodes = {};

    this.mouseClientOffset = {};
    this.currentSourceId = null;
    this.currentNativeSource = null;
    this.currentNativeHandle = null;

    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.preventNextClick = this.preventNextClick.bind(this);
    this.preventNextMouseUp = this.preventNextMouseUp.bind(this);
    this.getSourceClientOffset = this.getSourceClientOffset.bind(this);

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

    window.addEventListener('dragenter', this.handleNativeDrag, true);
    window.addEventListener('dragover', this.handleNativeDrag, true);
    window.addEventListener('dragleave', this.handleNativeEndDrag, true);
    window.addEventListener('drop', this.handleNativeEndDrag, true);
  }

  teardown() {
    if (typeof window === 'undefined') {
      return;
    }

    this.constructor.isSetUp = false;
    this.removeDragCaptureListeners();

    window.removeEventListener('dragenter', this.handleNativeDrag, true);
    window.removeEventListener('dragover', this.handleNativeDrag, true);
    window.removeEventListener('dragleave', this.handleNativeEndDrag, true);
    window.removeEventListener('drop', this.handleNativeEndDrag, true);
  }

  //
  connectDragSource(sourceId, node) {
    this.sourceNodes[sourceId] = node;

    const handleStartDrag = this.handleStartDrag.bind(this, sourceId);
    node.addEventListener('mousedown', handleStartDrag);

    return () => {
      delete this.sourceNodes[sourceId];
      node.removeEventListener('mousedown', handleStartDrag);
    };
  }

  connectDropTarget(targetId, node) {
    this.targetNodes[targetId] = node;

    return () => {
      delete this.targetNodes[targetId];
    };
  }

  //
  handleStartDrag(sourceId, e) {
    if (e.which == 3) {
      return;
    }

    if (!this.monitor.canDragSource(sourceId)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const clientOffset = getEventClientOffset(e);
    if (!clientOffset) {
      return null;
    }

    this.currentSourceId = sourceId;
    this.mouseClientOffset = clientOffset;
    this.addDragCaptureListeners();
  }

  handleMouseMove(e) {
    const {currentSourceId} = this;
    const clientOffset = getEventClientOffset(e);

    if (currentSourceId == null || !clientOffset) {
      return;
    }

    if (!this.monitor.isDragging()) {
      if (
        Math.abs(this.mouseClientOffset.x - clientOffset.x) < 4 &&
        Math.abs(this.mouseClientOffset.y - clientOffset.y) < 4
      ) {
        return;
      }

      this.actions.beginDrag([currentSourceId], {
        clientOffset: this.mouseClientOffset,
        getSourceClientOffset: this.getSourceClientOffset,
        publishSource: false
      });
    }

    this.actions.publishDragSource();

    const matchingTargetIds = this.getMatchingTargetIds(e);
    this.actions.hover(matchingTargetIds, {
      clientOffset
    });
  }

  handleMouseUp(e) {
    if (e.which !== 3) {
      e.preventDefault();
      this.endDrag();
    }
  }

  handleKeydown(e) {
    if (e.code == 'Escape') {
      this.endDrag(true);
      window.addEventListener('click', this.preventNextClick, true);
      window.addEventListener('mouseup', this.preventNextMouseUp, true);
    }
  }

  endDrag(aborted = false) {
    this.currentSourceId = null;
    this.mouseClientOffset = {};
    this.removeDragCaptureListeners();

    if (this.monitor.isDragging()) {
      if (!aborted) {
        this.actions.drop();
      }
      this.actions.endDrag();
    }
  }

  preventDefault(e) {
    e.preventDefault();
  }

  preventNextClick(e) {
    e.stopPropagation();
    window.removeEventListener('click', this.preventNextClick, true);
  }

  preventNextMouseUp(e) {
    e.stopPropagation();
    window.removeEventListener('mouseup', this.preventNextMouseUp, true);
  }

  //
  addDragCaptureListeners() {
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp, true);
    window.addEventListener('keydown', this.handleKeydown);
    window.addEventListener('contextmenu', this.preventDefault, true);
    window.addEventListener('dragstart', this.preventDefault, true);
  }

  removeDragCaptureListeners() {
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp, true);
    window.removeEventListener('keydown', this.handleKeydown);
    window.removeEventListener('contextmenu', this.preventDefault, true);
    window.removeEventListener('dragstart', this.preventDefault, true);
  }

  getSourceClientOffset(sourceId) {
    return getNodeClientOffset(this.sourceNodes[sourceId]);
  }

  getMatchingTargetIds(e) {
    return Object.entries(this.targetNodes)
      .filter(([, node]) => node.contains(e.target))
      .sort(([, nodeA], [, nodeB]) => (nodeA.contains(nodeB) ? -1 : 1))
      .map(([id]) => id);
  }

  //
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

    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const clientOffset = getEventClientOffset(e);
    const matchingTargetIds = this.getMatchingTargetIds(e);
    this.actions.publishDragSource();
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
