import os
import unittest
from unittest import mock

from agentbounty_agent import runner
from agentbounty_agent import video


class VideoAgentTests(unittest.TestCase):
    def test_video_runtime_requires_local_key(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(video.video_runtime_available({}))
            self.assertTrue(
                video.video_runtime_available({
                    "video_provider": "veo",
                    "video_api_key": "local-secret",
                })
            )

    def test_environment_gemini_key_enables_video_runtime(self):
        with mock.patch.dict(
            os.environ,
            {"GEMINI_API_KEY": "environment-secret"},
            clear=True,
        ):
            self.assertTrue(video.video_runtime_available({}))

    def test_runtime_capabilities_include_video_only_when_configured(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertNotIn(
                "VIDEO_GENERATE",
                runner.runtime_action_capabilities({}),
            )
            self.assertNotIn(
                "VIDEO",
                runner.runtime_work_capabilities({}),
            )

            config = {
                "video_provider": "veo",
                "video_api_key": "secret",
            }
            self.assertIn(
                "VIDEO_GENERATE",
                runner.runtime_action_capabilities(config),
            )
            self.assertIn(
                "VIDEO",
                runner.runtime_work_capabilities(config),
            )

    def test_video_task_requires_generate_action_and_credentials(self):
        base = {
            "workType": "VIDEO",
            "deliveryType": "FILE",
            "sourceType": "MANUAL",
        }

        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(
                runner.can_execute_task(base, {})
            )
            self.assertFalse(
                runner.can_execute_task(
                    {
                        **base,
                        "requestedActions": ["VIDEO_GENERATE"],
                    },
                    {},
                )
            )
            self.assertTrue(
                runner.can_execute_task(
                    {
                        **base,
                        "requestedActions": ["VIDEO_GENERATE"],
                    },
                    {
                        "video_provider": "veo",
                        "video_api_key": "secret",
                    },
                )
            )

    def test_video_options_default_to_safe_mvp_settings(self):
        self.assertEqual(
            video._video_options({"source": {"data": None}}),
            {
                "aspectRatio": "16:9",
                "resolution": "720p",
                "durationSeconds": 8,
            },
        )

    def test_high_resolution_requires_eight_seconds(self):
        context = {
            "source": {
                "data": {
                    "video": {
                        "aspectRatio": "9:16",
                        "resolution": "4k",
                        "durationSeconds": 6,
                    }
                }
            }
        }

        with self.assertRaisesRegex(RuntimeError, "require an 8-second"):
            video._video_options(context)

    def test_lite_model_rejects_4k_before_api_call(self):
        context = {
            "task": {
                "title": "Test",
                "description": "Generate a test video",
            },
            "source": {
                "data": {
                    "video": {
                        "aspectRatio": "16:9",
                        "resolution": "4k",
                        "durationSeconds": 8,
                    }
                }
            },
        }
        config = {
            "video_provider": "veo",
            "video_model": "veo-3.1-lite-generate-preview",
            "video_api_key": "secret",
        }

        with mock.patch.object(
            video,
            "_build_video_prompt",
            return_value="prompt",
        ), self.assertRaisesRegex(RuntimeError, "does not support 4k"):
            video._generate_veo_video(config, context)

    def test_video_heartbeat_reports_work_and_action_capabilities(self):
        config = {
            "agent_id": "agent-1",
            "video_provider": "veo",
            "video_api_key": "secret",
        }
        captured = {}

        def fake_api_request(config_arg, path, method="GET", body=None):
            captured["path"] = path
            captured["method"] = method
            captured["body"] = body
            return {"ok": True}

        with mock.patch.dict(os.environ, {}, clear=True), mock.patch.object(
            runner.legacy,
            "api_request",
            side_effect=fake_api_request,
        ):
            runner.runtime_heartbeat(config)

        self.assertEqual(captured["method"], "POST")
        self.assertIn("VIDEO_GENERATE", captured["body"]["runtimeCapabilities"])
        self.assertIn("VIDEO", captured["body"]["runtimeWorkCapabilities"])


if __name__ == "__main__":
    unittest.main()
