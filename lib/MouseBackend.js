'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _OffsetUtils = require('./react-dnd-html5-backend/OffsetUtils.js');

var _NativeDragSources = require('./react-dnd-html5-backend/NativeDragSources');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MouseBackend = function () {
  function MouseBackend(manager) {
    _classCallCheck(this, MouseBackend);

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
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.preventNextClick = this.preventNextClick.bind(this);
    this.preventNextMouseUp = this.preventNextMouseUp.bind(this);
    this.getSourceClientOffset = this.getSourceClientOffset.bind(this);

    this.handleNativeDrag = this.handleNativeDrag.bind(this);
    this.handleNativeEndDrag = this.handleNativeEndDrag.bind(this);
  }

  _createClass(MouseBackend, [{
    key: 'setup',
    value: function setup() {
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
  }, {
    key: 'teardown',
    value: function teardown() {
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

  }, {
    key: 'connectDragSource',
    value: function connectDragSource(sourceId, node) {
      var _this = this;

      this.sourceNodes[sourceId] = node;

      var handleStartDrag = this.handleStartDrag.bind(this, sourceId);
      node.addEventListener('mousedown', handleStartDrag);

      return function () {
        delete _this.sourceNodes[sourceId];
        node.removeEventListener('mousedown', handleStartDrag);
      };
    }
  }, {
    key: 'connectDropTarget',
    value: function connectDropTarget(targetId, node) {
      var _this2 = this;

      this.targetNodes[targetId] = node;

      return function () {
        delete _this2.targetNodes[targetId];
      };
    }
  }, {
    key: 'connectDragPreview',
    value: function connectDragPreview() {}

    //

  }, {
    key: 'handleStartDrag',
    value: function handleStartDrag(sourceId, e) {
      if (e.which == 3) {
        return;
      }

      e.preventDefault();

      var clientOffset = (0, _OffsetUtils.getEventClientOffset)(e);
      if (!clientOffset) {
        return null;
      }

      this.currentSourceId = sourceId;
      this.mouseClientOffset = clientOffset;
      this.addDragCaptureListeners();
    }
  }, {
    key: 'handleMouseMove',
    value: function handleMouseMove(e) {
      var currentSourceId = this.currentSourceId;

      var clientOffset = (0, _OffsetUtils.getEventClientOffset)(e);

      if (currentSourceId == null || !clientOffset) {
        return;
      }

      if (!this.monitor.isDragging()) {
        if (Math.abs(this.mouseClientOffset.x - clientOffset.x) < 4 && Math.abs(this.mouseClientOffset.y - clientOffset.y) < 4) {
          return;
        }

        this.actions.beginDrag([currentSourceId], {
          clientOffset: this.mouseClientOffset,
          getSourceClientOffset: this.getSourceClientOffset,
          publishSource: false
        });
      }

      this.actions.publishDragSource();

      var matchingTargetIds = this.getMatchingTargetIds(clientOffset);
      this.actions.hover(matchingTargetIds, {
        clientOffset: clientOffset
      });
    }
  }, {
    key: 'handleMouseUp',
    value: function handleMouseUp(e) {
      if (e.which !== 3) {
        e.preventDefault();
        this.endDrag();
      }
    }
  }, {
    key: 'handleKeydown',
    value: function handleKeydown(e) {
      if (e.code == 'Escape') {
        this.endDrag(true);
        window.addEventListener('click', this.preventNextClick, true);
        window.addEventListener('mouseup', this.preventNextMouseUp, true);
      }
    }
  }, {
    key: 'endDrag',
    value: function endDrag() {
      var aborted = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

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
  }, {
    key: 'preventDefault',
    value: function preventDefault(e) {
      e.preventDefault();
    }
  }, {
    key: 'preventNextClick',
    value: function preventNextClick(e) {
      e.stopPropagation();
      window.removeEventListener('click', this.preventNextClick, true);
    }
  }, {
    key: 'preventNextMouseUp',
    value: function preventNextMouseUp(e) {
      e.stopPropagation();
      window.removeEventListener('mouseup', this.preventNextMouseUp, true);
    }

    //

  }, {
    key: 'addDragCaptureListeners',
    value: function addDragCaptureListeners() {
      window.addEventListener('mousemove', this.handleMouseMove);
      window.addEventListener('mouseup', this.handleMouseUp, true);
      window.addEventListener('keydown', this.handleKeydown);
      window.addEventListener('contextmenu', this.preventDefault, true);
      window.addEventListener('dragstart', this.preventDefault, true);
    }
  }, {
    key: 'removeDragCaptureListeners',
    value: function removeDragCaptureListeners() {
      window.removeEventListener('mousemove', this.handleMouseMove);
      window.removeEventListener('mouseup', this.handleMouseUp, true);
      window.removeEventListener('keydown', this.handleKeydown);
      window.removeEventListener('contextmenu', this.preventDefault, true);
      window.removeEventListener('dragstart', this.preventDefault, true);
    }
  }, {
    key: 'getSourceClientOffset',
    value: function getSourceClientOffset(sourceId) {
      return (0, _OffsetUtils.getNodeClientOffset)(this.sourceNodes[sourceId]);
    }
  }, {
    key: 'getMatchingTargetIds',
    value: function getMatchingTargetIds(clientOffset) {
      var _this3 = this;

      return Object.keys(this.targetNodes).filter(function (targetId) {
        var boundingRect = _this3.targetNodes[targetId].getBoundingClientRect();
        return clientOffset.x >= boundingRect.left && clientOffset.x < boundingRect.right && clientOffset.y >= boundingRect.top && clientOffset.y < boundingRect.bottom;
      });
    }

    //

  }, {
    key: 'handleNativeDrag',
    value: function handleNativeDrag(e) {
      var nativeType = (0, _NativeDragSources.matchNativeItemType)(e.dataTransfer);
      if (!nativeType) {
        return;
      }

      if (!this.monitor.isDragging()) {
        var SourceType = (0, _NativeDragSources.createNativeDragSource)(nativeType);
        this.currentNativeSource = new SourceType();
        this.currentNativeHandle = this.registry.addSource(nativeType, this.currentNativeSource);

        this.actions.beginDrag([this.currentNativeHandle]);
      }

      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';

      var clientOffset = (0, _OffsetUtils.getEventClientOffset)(e);
      var matchingTargetIds = this.getMatchingTargetIds(clientOffset);
      this.actions.publishDragSource();
      this.actions.hover(matchingTargetIds, {
        clientOffset: clientOffset
      });
    }
  }, {
    key: 'handleNativeEndDrag',
    value: function handleNativeEndDrag(e) {
      var nativeType = (0, _NativeDragSources.matchNativeItemType)(e.dataTransfer);
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
  }]);

  return MouseBackend;
}();

exports.default = MouseBackend;