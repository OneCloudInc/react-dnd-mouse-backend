'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getEmptyImage = exports.NativeTypes = undefined;

var _MouseBackend = require('./MouseBackend');

var _MouseBackend2 = _interopRequireDefault(_MouseBackend);

var _NativeTypes = require('./react-dnd-html5-backend/NativeTypes');

var NativeTypes = _interopRequireWildcard(_NativeTypes);

var _getEmptyImage = require('./react-dnd-html5-backend/getEmptyImage');

var _getEmptyImage2 = _interopRequireDefault(_getEmptyImage);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var createMouseBackend = function createMouseBackend(manager) {
  return new _MouseBackend2.default(manager);
};

exports.default = createMouseBackend;
exports.NativeTypes = NativeTypes;
exports.getEmptyImage = _getEmptyImage2.default;