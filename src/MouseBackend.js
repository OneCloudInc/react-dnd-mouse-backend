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

    this.handleStartDrag = this.handleStartDrag.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleEndDrag = this.handleEndDrag.bind(this);
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

  connectDragPreview() {}

  //
  handleStartDrag(sourceId, e) {
    if (e.which == 3) {
      return;
    }

    e.preventDefault();

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

    const matchingTargetIds = this.getMatchingTargetIds(clientOffset);
    this.actions.hover(matchingTargetIds, {
      clientOffset
    });
  }

  handleEndDrag(e) {
    if (e.which == 3) {
      return;
    }

    e.preventDefault();
    this.currentSourceId = null;
    this.mouseClientOffset = {};
    this.removeDragCaptureListeners();

    if (this.monitor.isDragging()) {
      this.actions.drop();
      this.actions.endDrag();
    }
  }

  preventDefault(e) {
    e.preventDefault();
  }

  //
  addDragCaptureListeners() {
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleEndDrag, true);
    window.addEventListener('contextmenu', this.preventDefault, true);
    window.addEventListener('dragstart', this.preventDefault, true);
  }

  removeDragCaptureListeners() {
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleEndDrag, true);
    window.removeEventListener('contextmenu', this.preventDefault, true);
  }

  getSourceClientOffset(sourceId) {
    return getNodeClientOffset(this.sourceNodes[sourceId]);
  }

  getMatchingTargetIds(clientOffset) {
    return Object.keys(this.targetNodes).filter(targetId => {
      const boundingRect = this.targetNodes[targetId].getBoundingClientRect();
      return (
        clientOffset.x >= boundingRect.left &&
        clientOffset.x < boundingRect.right &&
        clientOffset.y >= boundingRect.top &&
        clientOffset.y < boundingRect.bottom
      );
    });
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
    const matchingTargetIds = this.getMatchingTargetIds(clientOffset);
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
