#!/usr/bin/env python3

import json
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
    "http://localhost:3000"
)

INTERVAL_SECONDS = 15


def load_internal_key():
    for raw in ENV_PATH.read_text().splitlines():
        line = raw.strip()

        if (
            not line
            or line.startswith("#")
            or "=" not in line
        ):
            continue

        key, value = line.split("=", 1)

        if (
            key ==
            "AGENTBOUNTY_INTERNAL_KEY"
        ):
            return value

    raise RuntimeError(
        "AGENTBOUNTY_INTERNAL_KEY missing"
    )


def run_once():
    internal_key = load_internal_key()

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
        return json.load(response)


def main():
    print(
        "AgentBounty Verification Worker"
    )

    print(
        f"Polling every {INTERVAL_SECONDS}s"
    )

    print(
        "Press Control+C to stop."
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
                    f"\n[verification] scanned {scanned} task(s)"
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
                        f"{suffix}"
                    )

        except KeyboardInterrupt:
            print(
                "\nVerification worker stopped."
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
                f"[verification] HTTP {exc.code}: {body}"
            )

        except Exception as exc:
            print(
                f"[verification] error: {exc}"
            )

        time.sleep(
            INTERVAL_SECONDS
        )


if __name__ == "__main__":
    main()
