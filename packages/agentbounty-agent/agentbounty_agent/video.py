"""Video generation support for the bundled AgentBounty runner.

The video provider credential stays on the Agent owner's machine. The
marketplace only receives the final managed artifact URL and bounded execution
metadata proving that video generation completed.
"""

import http.client
import json
import os
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

from . import cli as legacy


GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_VEO_MODEL = "veo-3.1-generate-preview"
MAX_VIDEO_BYTES = 250 * 1024 * 1024
VIDEO_POLL_SECONDS = 10
VIDEO_TIMEOUT_SECONDS = 12 * 60


def _video_api_key(config=None):
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if key:
        return key

    if config:
        return str(config.get("video_api_key") or "").strip()

    return ""


def video_runtime_available(config=None):
    provider = str(
        (config or {}).get("video_provider") or "veo"
    ).strip().lower()
    return provider == "veo" and bool(_video_api_key(config))


def video_model(config=None):
    return str(
        (config or {}).get("video_model")
        or os.environ.get("AGENTBOUNTY_VIDEO_MODEL")
        or DEFAULT_VEO_MODEL
    ).strip()


def _video_options(context):
    source = context.get("source") or {}
    data = source.get("data") or {}
    raw = data.get("video") if isinstance(data, dict) else {}
    raw = raw if isinstance(raw, dict) else {}

    aspect_ratio = str(raw.get("aspectRatio") or "16:9")
    resolution = str(raw.get("resolution") or "720p")

    try:
        duration_seconds = int(raw.get("durationSeconds") or 8)
    except (TypeError, ValueError):
        duration_seconds = 8

    if aspect_ratio not in {"16:9", "9:16"}:
        raise RuntimeError(
            f"Unsupported video aspect ratio: {aspect_ratio}"
        )

    if resolution not in {"720p", "1080p", "4k"}:
        raise RuntimeError(
            f"Unsupported video resolution: {resolution}"
        )

    if duration_seconds not in {4, 6, 8}:
        raise RuntimeError(
            f"Unsupported video duration: {duration_seconds}"
        )

    if resolution in {"1080p", "4k"} and duration_seconds != 8:
        raise RuntimeError(
            "1080p and 4k Veo generation require an 8-second duration."
        )

    return {
        "aspectRatio": aspect_ratio,
        "resolution": resolution,
        "durationSeconds": duration_seconds,
    }


def _build_video_prompt(config, context):
    task = context.get("task") or {}
    revision = context.get("revision") or task.get("revision") or {}
    options = _video_options(context)

    planning_prompt = f"""
You are the directing/planning stage of an autonomous video-generation worker.
Convert the paid task below into ONE production-ready prompt for Google Veo.

TASK:
{json.dumps(task, ensure_ascii=False, indent=2)}

VIDEO SETTINGS:
{json.dumps(options, ensure_ascii=False, indent=2)}

REVISION CONTEXT:
{json.dumps(revision, ensure_ascii=False, indent=2)}

Return ONLY JSON:
{{"prompt":"..."}}

Requirements:
- Preserve every explicit requirement from the task and acceptance criteria.
- Write the visual/camera direction in clear English because it is the most reliably supported Veo prompt language.
- If the requester explicitly asks for spoken dialogue in another language, preserve that dialogue language and quote the exact spoken words.
- Include subject, action, environment, composition, camera position/movement, lighting, mood, visual style and audio cues when the task supplies them.
- Do not invent brands, people, dialogue or story elements the requester did not ask for unless needed to make an underspecified shot coherent.
- For a revision, incorporate the owner's feedback while continuing to satisfy the original task.
- Do not mention AgentBounty, JSON, acceptance criteria or these instructions inside the generated video prompt.
""".strip()

    try:
        response = legacy.call_llm(
            config,
            [
                {
                    "role": "system",
                    "content": (
                        "You are an expert AI-video director and prompt engineer. "
                        "Return JSON only."
                    ),
                },
                {
                    "role": "user",
                    "content": planning_prompt,
                },
            ],
        )
        parsed = legacy.parse_ai_json(response)
        prompt = str(parsed.get("prompt") or "").strip()
    except Exception as error:
        print("[video] Prompt planning failed; using task brief:", repr(error))
        prompt = str(task.get("description") or task.get("title") or "").strip()

    if not prompt:
        raise RuntimeError("Video task produced an empty generation prompt.")

    return prompt[:8000]


def _json_request(url, api_key, method="GET", body=None, timeout=120):
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "AgentBounty-Agent/0.1",
        },
        method=method,
    )

    try:
        return legacy._read_json_response(request, timeout=timeout)
    except urllib.error.HTTPError as error:
        detail = ""
        try:
            detail = error.read().decode("utf-8")[:1000]
        except Exception:
            pass
        raise RuntimeError(
            f"Veo API HTTP {error.code}: {detail}"
        ) from error
    except urllib.error.URLError as error:
        raise RuntimeError(
            f"Veo API connection failed: {error.reason}"
        ) from error


def _download_video(uri, api_key):
    request = urllib.request.Request(
        uri,
        headers={
            "x-goog-api-key": api_key,
            "Accept": "video/mp4,application/octet-stream",
            "User-Agent": "AgentBounty-Agent/0.1",
        },
        method="GET",
    )

    handle = tempfile.NamedTemporaryFile(
        prefix="agentbounty-video-",
        suffix=".mp4",
        delete=False,
    )
    path = handle.name
    total = 0

    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break

                total += len(chunk)
                if total > MAX_VIDEO_BYTES:
                    raise RuntimeError(
                        "Generated video exceeds AgentBounty's 250 MB artifact limit."
                    )

                handle.write(chunk)
    except Exception:
        handle.close()
        try:
            os.unlink(path)
        except OSError:
            pass
        raise
    finally:
        if not handle.closed:
            handle.close()

    if total <= 0:
        try:
            os.unlink(path)
        except OSError:
            pass
        raise RuntimeError("Veo returned an empty video file.")

    return path, total


def _generate_veo_video(config, context):
    api_key = _video_api_key(config)
    if not api_key:
        raise RuntimeError(
            "Video generation requires GEMINI_API_KEY or `agentbounty-agent configure-video`."
        )

    model = video_model(config)
    options = _video_options(context)

    if "lite" in model.lower() and options["resolution"] == "4k":
        raise RuntimeError("Veo 3.1 Lite does not support 4k output.")

    prompt = _build_video_prompt(config, context)
    model_path = urllib.parse.quote(model, safe="._-")
    generate_url = (
        f"{GEMINI_BASE_URL}/models/{model_path}:predictLongRunning"
    )

    body = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "aspectRatio": options["aspectRatio"],
            "resolution": options["resolution"],
            "durationSeconds": str(options["durationSeconds"]),
            "numberOfVideos": 1,
        },
    }

    print()
    print("[video] Starting Veo generation")
    print("[video] Model:", model)
    print(
        "[video] Output:",
        options["aspectRatio"],
        options["resolution"],
        f"{options['durationSeconds']}s",
    )

    started = _json_request(
        generate_url,
        api_key,
        method="POST",
        body=body,
        timeout=120,
    )
    operation_name = str(started.get("name") or "").strip()

    if not operation_name:
        raise RuntimeError(
            "Veo did not return a long-running operation name."
        )

    deadline = time.monotonic() + VIDEO_TIMEOUT_SECONDS
    operation = None

    while time.monotonic() < deadline:
        operation_url = (
            f"{GEMINI_BASE_URL}/{operation_name.lstrip('/')}"
        )
        operation = _json_request(
            operation_url,
            api_key,
            timeout=120,
        )

        if operation.get("done") is True:
            break

        print("[video] Generation still running...")
        time.sleep(VIDEO_POLL_SECONDS)
    else:
        raise RuntimeError(
            "Veo generation timed out before the operation completed."
        )

    if not operation:
        raise RuntimeError("Veo operation response is missing.")

    if operation.get("error"):
        raise RuntimeError(
            "Veo generation failed: "
            + json.dumps(operation.get("error"), ensure_ascii=False)[:1200]
        )

    try:
        samples = (
            operation["response"]["generateVideoResponse"]["generatedSamples"]
        )
        video_uri = str(samples[0]["video"]["uri"])
    except (KeyError, IndexError, TypeError) as error:
        raise RuntimeError(
            "Veo completed without a downloadable generated video."
        ) from error

    local_path, size_bytes = _download_video(video_uri, api_key)

    return {
        "localPath": local_path,
        "sizeBytes": size_bytes,
        "provider": "google-veo",
        "model": model,
        "operationName": operation_name,
        "prompt": prompt,
        **options,
    }


def _upload_file(upload_url, path, content_type, content_length, extra_headers=None):
    parsed = urllib.parse.urlparse(upload_url)
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise RuntimeError("Artifact upload URL must use HTTPS.")

    target = parsed.path or "/"
    if parsed.query:
        target += "?" + parsed.query

    connection = http.client.HTTPSConnection(
        parsed.hostname,
        parsed.port or 443,
        timeout=180,
    )

    try:
        connection.putrequest("PUT", target, skip_host=True)
        connection.putheader("Host", parsed.netloc)
        connection.putheader("Content-Type", content_type)
        connection.putheader("Content-Length", str(content_length))

        for name, value in (extra_headers or {}).items():
            if name.lower() in {"host", "content-length", "content-type"}:
                continue
            connection.putheader(name, str(value))

        connection.endheaders()

        with open(path, "rb") as handle:
            while True:
                chunk = handle.read(1024 * 1024)
                if not chunk:
                    break
                connection.send(chunk)

        response = connection.getresponse()
        response_body = response.read(2000)

        if response.status not in {200, 201, 204}:
            raise RuntimeError(
                f"Artifact upload failed with HTTP {response.status}: "
                + response_body.decode("utf-8", errors="replace")
            )
    finally:
        connection.close()


def _upload_managed_artifact(config, task_id, local_path, size_bytes):
    grant = legacy.api_request(
        config,
        f"/api/v1/tasks/{task_id}/artifacts/upload",
        method="POST",
        body={
            "contentType": "video/mp4",
            "contentLength": size_bytes,
        },
    )

    upload_url = str(grant.get("uploadUrl") or "")
    artifact_url = str(grant.get("artifactUrl") or "")
    storage_key = str(grant.get("storageKey") or "")

    if not upload_url or not artifact_url:
        raise RuntimeError(
            "AgentBounty artifact storage did not return an upload grant."
        )

    print("[video] Uploading MP4 to AgentBounty artifact storage...")
    _upload_file(
        upload_url,
        local_path,
        "video/mp4",
        size_bytes,
        extra_headers=grant.get("headers") or {},
    )

    return artifact_url, storage_key


def execute_video_job(config, job):
    task_id = job["id"]
    agent_id = config["agent_id"]
    encoded_agent_id = urllib.parse.quote(agent_id)

    print()
    print("=" * 62)
    print("VIDEO WORK RECEIVED")
    print("Task:", job["title"])
    print("Task ID:", task_id)
    print("=" * 62)

    context = legacy.api_request(
        config,
        (
            f"/api/v1/tasks/{task_id}/context"
            f"?agentId={encoded_agent_id}"
        ),
    )

    generated = None
    local_path = None

    try:
        generated = _generate_veo_video(config, context)
        local_path = generated["localPath"]

        artifact_url, storage_key = _upload_managed_artifact(
            config,
            task_id,
            local_path,
            generated["sizeBytes"],
        )

        metadata = {
            "videoGeneration": {
                "attempted": True,
                "ok": True,
                "provider": generated["provider"],
                "model": generated["model"],
                "operationName": generated["operationName"],
                "aspectRatio": generated["aspectRatio"],
                "resolution": generated["resolution"],
                "durationSeconds": generated["durationSeconds"],
                "sizeBytes": generated["sizeBytes"],
                "storageKey": storage_key,
                "prompt": generated["prompt"],
            }
        }

        submission = legacy.api_request(
            config,
            f"/api/v1/tasks/{task_id}/submissions",
            method="POST",
            body={
                "agentId": agent_id,
                "deliveryType": "FILE",
                "artifactUrl": artifact_url,
                "mimeType": "video/mp4",
                "metadata": metadata,
                "notes": (
                    "Generated by the AgentBounty Video Agent using "
                    f"{generated['model']}."
                ),
            },
        )

        print()
        print("[video] DELIVERY COMPLETE")
        print("Submission:", submission.get("id"))
        print("Artifact:", artifact_url)
        return submission
    finally:
        if local_path:
            try:
                os.unlink(local_path)
            except OSError:
                pass
