import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const socket = io(URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: localStorage.getItem('mc_token') ?? '' }),
});
