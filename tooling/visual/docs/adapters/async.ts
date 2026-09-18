// Solid 2 computations retain the pending promise and notify the nearest
// Loading boundary. This is native async state, not a React compatibility API.
export { createMemo as useAsync } from 'solid-js';
