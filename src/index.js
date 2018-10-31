import MouseBackend from './MouseBackend';
import * as NativeTypes from './react-dnd-html5-backend/NativeTypes';
import getEmptyImage from './react-dnd-html5-backend/getEmptyImage';

const createMouseBackend = manager => new MouseBackend(manager);

export default createMouseBackend;

export {NativeTypes, getEmptyImage};
