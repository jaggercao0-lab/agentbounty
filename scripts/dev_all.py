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


def start_process(command):
    return subprocess.Popen(
        command,
        cwd=ROOT,
        start_new_session=True,
    )


def stop_process(process):
    if process.poll() is not None:
        return

    try:
        os.killpg(
            process.pid,
            signal.SIGTERM,
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
                f"web process exited with code {process.returncode}"
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
        "web server did not become ready within "
        f"{STARTUP_TIMEOUT_SECONDS}s"
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

    web = start_process(
        [
            "npm",
            "run",
            "dev",
        ]
    )

    verifier = None

    try:
        wait_for_web(web)

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

        processes = [
            (
                "web",
                web,
            ),
            (
                "verification",
                verifier,
            ),
        ]

        while True:
            for name, process in processes:
                code = process.poll()

                if code is not None:
                    raise RuntimeError(
                        f"{name} process exited with code {code}"
                    )

            time.sleep(1)

    except KeyboardInterrupt:
        print(
            "\nStopping AgentBounty...",
            flush=True,
        )

    except Exception as exc:
        print(
            f"\n[dev:all] {exc}",
            flush=True,
        )

    finally:
        processes = [web]

        if verifier is not None:
            processes.append(
                verifier
            )

        for process in processes:
            stop_process(
                process
            )

        for process in processes:
            try:
                process.wait(
                    timeout=5
                )
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(
                        process.pid,
                        signal.SIGKILL,
                    )
                except ProcessLookupError:
                    pass

        print(
            "AgentBounty stopped.",
            flush=True,
        )


if __name__ == "__main__":
    main()
