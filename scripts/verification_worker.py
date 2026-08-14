#!/usr/bin/env python3

import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

ENV_PATH = (
    ROOT /
    "apps/web/.env.local"
)

PLATFORM_URL = (
    os.environ.get(
        "AGENTBOUNTY_PLATFORM_URL",
        "http://localhost:3000",
    )
    .strip()
    .rstrip("/")
)

INTERVAL_SECONDS = int(
    os.environ.get(
        "AGENTBOUNTY_VERIFICATION_INTERVAL_SECONDS",
        "15",
    )
)


def load_internal_key():
    env_value = (
        os.environ.get(
            "AGENTBOUNTY_INTERNAL_KEY",
            ""
        )
        .strip()
    )

    if env_value:
        return env_value

    if ENV_PATH.exists():
        for raw in (
            ENV_PATH
            .read_text()
            .splitlines()
        ):
            line = raw.strip()

            if (
                not line
                or line.startswith("#")
                or "=" not in line
            ):
                continue

            key, value = line.split(
                "=",
                1
            )

            if (
                key ==
                "AGENTBOUNTY_INTERNAL_KEY"
            ):
                value = value.strip()

                if value:
                    return value

    raise RuntimeError(
        "AGENTBOUNTY_INTERNAL_KEY missing"
    )


def run_once():
    internal_key = (
        load_internal_key()
    )

    request = urllib.request.Request(
        PLATFORM_URL +
        "/api/v1/system/verification-queue",
        method="POST",
        headers={
            "x-internal-key":
                internal_key,

            "Content-Type":
                "application/json",
        },
    )

    with urllib.request.urlopen(
        request,
        timeout=60,
    ) as response:
        return json.load(
            response
        )


def main():
    print(
        "AgentBounty Verification Worker",
        flush=True,
    )

    print(
        f"Platform: {PLATFORM_URL}",
        flush=True,
    )

    print(
        f"Polling every "
        f"{INTERVAL_SECONDS}s",
        flush=True,
    )

    while True:
        try:
            data = run_once()

            scanned = data.get(
                "scanned",
                0
            )

            if scanned:
                print(
                    f"[verification] "
                    f"scanned "
                    f"{scanned} task(s)",
                    flush=True,
                )

                for item in data.get(
                    "results",
                    []
                ):
                    task_id = item.get(
                        "taskId",
                        "?"
                    )

                    result = (
                        item.get(
                            "verificationStatus"
                        )
                        or item.get(
                            "error"
                        )
                        or "unknown"
                    )

                    status = item.get(
                        "status",
                        ""
                    )

                    suffix = (
                        f" -> {status}"
                        if status
                        else ""
                    )

                    print(
                        f"  {task_id}: "
                        f"{result}"
                        f"{suffix}",
                        flush=True,
                    )

        except KeyboardInterrupt:
            print(
                "Verification worker stopped.",
                flush=True,
            )
            break

        except urllib.error.HTTPError as exc:
            body = (
                exc.read()
                .decode(
                    "utf-8",
                    errors="replace"
                )
            )

            print(
                f"[verification] "
                f"HTTP {exc.code}: "
                f"{body}",
                flush=True,
            )

        except Exception as exc:
            print(
                f"[verification] "
                f"error: {exc}",
                flush=True,
            )

        time.sleep(
            INTERVAL_SECONDS
        )


if __name__ == "__main__":
    main()
