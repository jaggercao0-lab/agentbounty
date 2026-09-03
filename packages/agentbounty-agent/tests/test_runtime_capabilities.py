import os
import unittest
from unittest import mock

from agentbounty_agent import runner


class RuntimeCapabilityTests(unittest.TestCase):
    def test_source_fetch_is_always_available_in_reference_runner(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(
                runner.runtime_action_capabilities({}),
                {"SOURCE_FETCH"},
            )

    def test_web_search_is_advertised_only_with_real_credentials(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(
                runner.runtime_action_capabilities(
                    {"search_api_key": "local-secret"}
                ),
                {"SOURCE_FETCH", "WEB_SEARCH"},
            )

        with mock.patch.dict(
            os.environ,
            {"TAVILY_API_KEY": "environment-secret"},
            clear=True,
        ):
            self.assertEqual(
                runner.runtime_action_capabilities({}),
                {"SOURCE_FETCH", "WEB_SEARCH"},
            )

    def test_runtime_heartbeat_reports_only_local_action_capabilities(self):
        config = {
            "agent_id": "agent-1",
            "search_api_key": "search-secret",
        }

        with mock.patch.object(
            runner.legacy,
            "api_request",
            return_value={"ok": True},
        ) as request:
            result = runner.runtime_heartbeat(config)

        self.assertEqual(result, {"ok": True})
        request.assert_called_once_with(
            config,
            "/api/v1/agents/agent-1/heartbeat",
            method="POST",
            body={
                "runtimeCapabilities": [
                    "SOURCE_FETCH",
                    "WEB_SEARCH",
                ],
            },
        )

    def test_task_gate_uses_same_runtime_capability_detection(self):
        task = {
            "workType": "RESEARCH",
            "deliveryType": "TEXT",
            "sourceType": "MANUAL",
            "requestedActions": ["WEB_SEARCH"],
        }

        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(runner.can_execute_task(task, {}))
            self.assertTrue(
                runner.can_execute_task(
                    task,
                    {"search_api_key": "search-secret"},
                )
            )


if __name__ == "__main__":
    unittest.main()
