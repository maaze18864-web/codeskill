"""A real Bash PTY, controlled by JSONL over docker exec's private stdin."""
import argparse
import base64
import errno
import fcntl
import json
import os
import pty
import select
import signal
import struct
import sys
import termios
import time


def emit(kind, **values):
    print(json.dumps({"type": kind, **values}), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cols", type=int, default=80)
    parser.add_argument("--rows", type=int, default=24)
    parser.add_argument("--cwd", default="/work")
    args = parser.parse_args()
    os.chdir(args.cwd)
    child, master = pty.fork()
    if child == 0:
        env = dict(os.environ)
        for key in ("BASH_ENV", "ENV", "PROMPT_COMMAND"):
            env.pop(key, None)
        env.update({
            "TERM": "xterm-256color",
            "SHELL": "/bin/bash",
            "PS1": r"\[\e[32m\]codeskill\[\e[0m\]:\[\e[34m\]\w\[\e[0m\]\$ ",
            "HISTFILE": "/tmp/.codeskill_bash_history",
            "HISTCONTROL": "ignoredups:ignorespace",
        })
        os.execve("/bin/bash", ["bash", "--noprofile", "--norc", "-i"], env)

    closing = False
    status = None

    def shutdown(_signum, _frame):
        nonlocal closing
        closing = True

    def resize(cols, rows):
        if (not isinstance(cols, int) or not isinstance(rows, int)
                or not 20 <= cols <= 400 or not 4 <= rows <= 160):
            raise ValueError("Invalid terminal size")
        fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGHUP, shutdown)
    resize(args.cols, args.rows)
    os.set_blocking(master, False)
    incoming = bytearray()
    pending = bytearray()
    try:
        while not closing:
            readers, writers, _ = select.select(
                [sys.stdin.fileno(), master], [master] if pending else [], [], 0.25
            )
            if master in readers:
                try:
                    output = os.read(master, 8192)
                except OSError as exc:
                    if exc.errno == errno.EIO:
                        break
                    raise
                if not output:
                    break
                emit("data", data=base64.b64encode(output).decode("ascii"))
            if sys.stdin.fileno() in readers:
                chunk = os.read(sys.stdin.fileno(), 16384)
                if not chunk:
                    break
                incoming.extend(chunk)
                if len(incoming) > 65536:
                    raise ValueError("Terminal input exceeds its limit")
                while b"\n" in incoming:
                    line, _, rest = incoming.partition(b"\n")
                    incoming = bytearray(rest)
                    message = json.loads(line)
                    if message.get("type") == "input":
                        data = base64.b64decode(message["data"], validate=True)
                        if len(data) > 8192 or len(pending) + len(data) > 32768:
                            raise ValueError("Terminal input exceeds its limit")
                        pending.extend(data)
                    elif message.get("type") == "resize":
                        resize(message.get("cols"), message.get("rows"))
                    elif message.get("type") == "close":
                        closing = True
                    else:
                        raise ValueError("Invalid terminal action")
            if master in writers and pending:
                try:
                    written = os.write(master, pending)
                    del pending[:written]
                except BlockingIOError:
                    pass
    finally:
        try:
            os.close(master)
        except OSError:
            pass
        try:
            os.killpg(child, signal.SIGHUP)
        except ProcessLookupError:
            pass
        deadline = time.monotonic() + 1
        while time.monotonic() < deadline:
            pid, result = os.waitpid(child, os.WNOHANG)
            if pid:
                status = os.waitstatus_to_exitcode(result)
                break
            time.sleep(0.02)
        if status is None:
            try:
                os.killpg(child, signal.SIGKILL)
            except ProcessLookupError:
                pass
            _, result = os.waitpid(child, 0)
            status = os.waitstatus_to_exitcode(result)
        emit("exit", exitCode=status)


if __name__ == "__main__":
    main()
