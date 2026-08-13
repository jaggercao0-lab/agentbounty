#!/usr/bin/env python3

import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

WEB_HOST = "127.0.0.1"
WEB_PORT = 3000

STARTUP_TIMEOUT_SECONDS = 30
SHUTDOWN_TIMEOUT_SECONDS = 5


def start_process(command):
    return subprocess.Popen(
        command,
        cwd=ROOT,
        start_new_session=True,
    )


def terminate_process(process):
    if process is None:
        return

    if process.poll() is not None:
        return

    try:
        os.killpg(
            process.pid,
            signal.SIGTERM,
        )
    except ProcessLookupError:
        pass


def kill_process(process):
    if process is None:
        return

    if process.poll() is not None:
        return

    try:
        os.killpg(
            process.pid,
            signal.SIGKILL,
        )
    except ProcessLookupError:
        pass


def wait_for_web(process):
    print(
        "Waiting for web server...",
        flush=True,
    )

    deadline = (
        time.time()
        + STARTUP_TIMEOUT_SECONDS
    )

    while time.time() < deadline:
        if process.poll() is not None:
            raise RuntimeError(
                "web process exited "
                f"with code {process.returncode}"
            )

        try:
            with socket.create_connection(
                (
                    WEB_HOST,
                    WEB_PORT,
                ),
                timeout=1,
            ):
                print(
                    "Web server ready.",
                    flush=True,
                )

                return

        except OSError:
            time.sleep(0.25)

    raise RuntimeError(
        "web server did not become ready "
        f"within {STARTUP_TIMEOUT_SECONDS}s"
    )


def shutdown_processes(processes):
    print(
        "Stopping services...",
        flush=True,
    )

    for process in processes:
        terminate_process(
            process
        )

    deadline = (
        time.time()
        + SHUTDOWN_TIMEOUT_SECONDS
    )

    while (
        time.time() <
        deadline
    ):
        running = [
            process
            for process in processes
            if (
                process is not None
                and
                process.poll()
                is None
            )
        ]

        if not running:
            break

        time.sleep(0.1)

    for process in processes:
        if (
            process is not None
            and
            process.poll()
            is None
        ):
            kill_process(
                process
            )

    for process in processes:
        if process is None:
            continue

        try:
            process.wait(
                timeout=1
            )

        except (
            subprocess.TimeoutExpired,
            KeyboardInterrupt,
        ):
            kill_process(
                process
            )

    print(
        "AgentBounty stopped.",
        flush=True,
    )


def main():
    print(
        "AgentBounty local platform",
        flush=True,
    )

    print(
        "Starting web...",
        flush=True,
    )

    print(
        "Runner remains a separate process.",
        flush=True,
    )

    web = None
    verifier = None

    try:
        web = start_process(
            [
                "npm",
                "run",
                "dev",
            ]
        )

        wait_for_web(
            web
        )

        print(
            "Starting verification worker...",
            flush=True,
        )

        verifier = start_process(
            [
                sys.executable,
                "scripts/verification_worker.py",
            ]
        )

        while True:
            if (
                web.poll()
                is not None
            ):
                raise RuntimeError(
                    "web process exited "
                    f"with code {web.returncode}"
                )

            if (
                verifier.poll()
                is not None
            ):
                raise RuntimeError(
                    "verification process exited "
                    f"with code {verifier.returncode}"
                )

            time.sleep(1)

    except KeyboardInterrupt:
        print(
            "\nShutdown requested.",
            flush=True,
        )

    except Exception as exc:
        print(
            f"\n[dev:all] {exc}",
            flush=True,
        )

    finally:
        # Ignore additional Control+C signals while cleanup
        # is already in progress.
        try:
            signal.signal(
                signal.SIGINT,
                signal.SIG_IGN,
            )
        except ValueError:
            pass

        shutdown_processes(
            [
                verifier,
                web,
            ]
        )


if __name__ == "__main__":
    main()
