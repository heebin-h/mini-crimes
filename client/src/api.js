const SERVER = import.meta.env.VITE_SERVER_URL || '';
export const api = (path) => `${SERVER}${path}`;
