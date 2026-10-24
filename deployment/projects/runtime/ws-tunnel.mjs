// Raw tunnel inside the sandbox. The destination is fixed, never user supplied.
import net from "node:net";
const socket = net.connect({ host: "127.0.0.1", port: 4173 });
socket.on("error", () => process.exit(1));
socket.on("close", () => process.exit(0));
process.stdin.pipe(socket);
socket.pipe(process.stdout);
process.stdin.on("end", () => socket.end());
