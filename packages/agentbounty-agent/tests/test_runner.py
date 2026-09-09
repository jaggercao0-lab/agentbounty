import os
import unittest
from unittest import mock

from agentbounty_agent import runner


class ReferenceRunnerTests(unittest.TestCase):
    def test_can_execute_supported_paths(self):
        supported = [
            {
                "workType": "CODE",
                "deliveryType": "PULL_REQUEST",
            },
            {
                "workType": "RESEARCH",
                "deliveryType": "TEXT",
            },
            {
                "workType": "RESEARCH",
                "deliveryType": "JSON",
            },
            {
                "workType": "DATA",
                "deliveryType": "TEXT",
            },
            {
                "workType": "DATA",
                "deliveryType": "JSON",
            },
            {
                "workType": "AUTOMATION",
                "deliveryType": "TEXT",
            },
            {
                "workType": "AUTOMATION",
                "deliveryType": "JSON",
            },
            {
                "workType": "OTHER",
                "deliveryType": "TEXT",
            },
            {
                "workType": "OTHER",
                "deliveryType": "JSON",
            },
        ]

        for task in supported:
            with self.subTest(task=task):
                self.assertTrue(runner.can_execute_task(task))

    def test_can_execute_rejects_unsupported_paths(self):
        unsupported = [
            {
                "workType": "IMAGE",
                "deliveryType": "FILE",
            },
            {
                "workType": "IMAGE",
                "deliveryType": "JSON",
            },
            {
                "workType": "VIDEO",
                "deliveryType": "FILE",
            },
            {
                "workType": "VIDEO",
                "deliveryType": "TEXT",
            },
            {
                "workType": "CODE",
                "deliveryType": "TEXT",
            },
            {
                "workType": "OTHER",
                "deliveryType": "URL",
            },
        ]

        for task in unsupported:
            with self.subTest(task=task):
                self.assertFalse(runner.can_execute_task(task))

    def test_web_search_action_requires_local_credentials(self):
        task = {
            "workType": "RESEARCH",
            "deliveryType": "TEXT",
            "sourceType": "MANUAL",
            "requestedActions": ["WEB_SEARCH"],
        }

        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(
                runner.can_execute_task(task, {})
            )
            self.assertTrue(
                runner.can_execute_task(
                    task,
                    {"search_api_key": "local-secret"},
                )
            )

    def test_source_fetch_action_requires_external_source(self):
        base = {
            "workType": "DATA",
            "deliveryType": "JSON",
            "requestedActions": ["SOURCE_FETCH"],
        }

        self.assertFalse(
            runner.can_execute_task(
                {**base, "sourceType": "MANUAL"},
                {},
            )
        )
        self.assertTrue(
            runner.can_execute_task(
                {**base, "sourceType": "URL"},
                {},
            )
        )

    def test_unknown_action_is_not_accepted(self):
        task = {
            "workType": "RESEARCH",
            "deliveryType": "TEXT",
            "sourceType": "MANUAL",
            "requestedActions": ["SEND_MONEY"],
        }

        self.assertFalse(runner.can_execute_task(task, {}))

    def test_required_web_search_cannot_fall_back_to_model_only(self):
        context = {
            "task": {
                "workType": "RESEARCH",
                "requestedActions": ["WEB_SEARCH"],
            }
        }

        with mock.patch.object(
            runner,
            "_BASE_COLLECT_RESEARCH_EVIDENCE",
            return_value=(
                [],
                {
                    "researchMode": "model_only",
                    "sourceCount": 0,
                },
            ),
        ):
            with self.assertRaisesRegex(
                RuntimeError,
                "requires WEB_SEARCH",
            ):
                runner._collect_required_research_evidence(
                    {"search_api_key": "secret"},
                    context,
                )

    def test_required_source_fetch_must_succeed(self):
        context = {
            "task": {
                "requestedActions": ["SOURCE_FETCH"],
            },
            "source": {
                "type": "URL",
                "url": "https://example.com/data.json",
            },
        }

        with mock.patch.object(
            runner,
            "_BASE_HYDRATE_TASK_SOURCE",
            return_value=(
                context,
                {
                    "sourceFetch": {
                        "attempted": True,
                        "ok": False,
                        "error": "http_503",
                    }
                },
            ),
        ):
            with self.assertRaisesRegex(
                RuntimeError,
                "requires SOURCE_FETCH",
            ):
                runner._hydrate_required_source(context)

    def test_try_bid_ignores_unsupported_highest_bounty(self):
        config = {
            "agent_id": "agent-1",
            "min_bounty_cents": 100,
            "max_bounty_cents": 100000,
        }
        tasks = [
            {
                "id": "image",
                "title": "Generate image",
                "bountyCents": 90000,
                "workType": "IMAGE",
                "deliveryType": "JSON",
            },
            {
                "id": "research",
                "title": "Research task",
                "bountyCents": 5000,
                "workType": "RESEARCH",
                "deliveryType": "TEXT",
            },
        ]
        calls = []

        def fake_api_request(config_arg, path, method="GET", body=None):
            calls.append(path)
            return {
                "alreadyExists": False,
                "id": "bid-1",
            }

        with mock.patch.object(
            runner.v04,
            "get_open_tasks",
            return_value=tasks,
        ), mock.patch.object(
            runner.legacy,
            "api_request",
            side_effect=fake_api_request,
        ):
            runner.try_bid(config)

        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0].endswith("/research/bids"))

    def test_stored_search_key_is_applied_locally(self):
        config = {
            "search_api_key": "stored-secret",
        }

        with mock.patch.dict(os.environ, {}, clear=True):
            runner._apply_local_runtime_secrets(config)
            self.assertEqual(
                os.environ.get("TAVILY_API_KEY"),
                "stored-secret",
            )

    def test_environment_search_key_takes_precedence(self):
        config = {
            "search_api_key": "stored-secret",
        }

        with mock.patch.dict(
            os.environ,
            {"TAVILY_API_KEY": "environment-secret"},
            clear=True,
        ):
            runner._apply_local_runtime_secrets(config)
            self.assertEqual(
                os.environ.get("TAVILY_API_KEY"),
                "environment-secret",
            )

    def test_reconfigure_preserves_search_credentials(self):
        before = {
            "marketplace_url": "http://old",
            "search_provider": "tavily",
            "search_api_key": "search-secret",
            "video_provider": "veo",
            "video_model": "veo-3.1-generate-preview",
            "video_api_key": "video-secret",
        }
        after = {
            "marketplace_url": "http://new",
            "agent_id": "agent-1",
        }
        saved = []
        loads = [before, after]

        with mock.patch.object(
            runner.legacy,
            "load_config",
            side_effect=lambda: loads.pop(0),
        ), mock.patch.object(
            runner,
            "_LEGACY_CONFIGURE",
        ) as legacy_configure, mock.patch.object(
            runner.legacy,
            "save_config",
            side_effect=lambda value: saved.append(dict(value)),
        ):
            runner.configure_preserving_integrations()

        legacy_configure.assert_called_once_with()
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0]["marketplace_url"], "http://new")
        self.assertEqual(saved[0]["search_provider"], "tavily")
        self.assertEqual(saved[0]["search_api_key"], "search-secret")
        self.assertEqual(saved[0]["video_provider"], "veo")
        self.assertEqual(saved[0]["video_model"], "veo-3.1-generate-preview")
        self.assertEqual(saved[0]["video_api_key"], "video-secret")

    def test_revision_prompt_keeps_original_contract_and_previous_delivery(self):
        context = {
            "task": {
                "id": "task-1",
                "title": "Compare Git and SVN",
                "description": (
                    "Explain version-control model, branching, collaboration, "
                    "advantages, disadvantages, and give a recommendation."
                ),
                "workType": "RESEARCH",
                "deliveryType": "TEXT",
                "acceptanceCriteria": [
                    "Compare the version-control models",
                    "Give a clear final recommendation",
                ],
                "revision": {
                    "number": 1,
                    "feedback": (
                        "Add a Markdown comparison table with at least four "
                        "dimensions."
                    ),
                    "previousSubmission": {
                        "deliveryType": "TEXT",
                        "textContent": (
                            "Git is distributed. SVN is centralized. "
                            "Both have trade-offs."
                        ),
                    },
                },
            },
            "source": {
                "type": "MANUAL",
                "url": None,
                "data": None,
            },
        }

        prompt = runner.revision_aware_prompt(context)

        self.assertIn("Explain version-control model", prompt)
        self.assertIn("Give a clear final recommendation", prompt)
        self.assertIn("Add a Markdown comparison table", prompt)
        self.assertIn("Git is distributed. SVN is centralized.", prompt)
        self.assertIn(
            "revision feedback supplements the original contract",
            prompt.lower(),
        )
        self.assertIn("COMPLETE replacement deliverable", prompt)
        self.assertIn("EVERY original acceptance criterion", prompt)

    def test_select_runnable_job_skips_cooldown_job(self):
        jobs = [
            {"id": "cooling"},
            {"id": "ready"},
        ]
        failed_until = {
            "cooling": 160.0,
            "ready": 0.0,
        }

        selected = runner._select_runnable_job(
            jobs,
            failed_until,
            now=100.0,
        )

        self.assertEqual(selected, {"id": "ready"})

    def test_select_runnable_job_returns_none_when_all_cooling(self):
        jobs = [
            {"id": "one"},
            {"id": "two"},
        ]
        failed_until = {
            "one": 120.0,
            "two": 180.0,
        }

        selected = runner._select_runnable_job(
            jobs,
            failed_until,
            now=100.0,
        )

        self.assertIsNone(selected)


if __name__ == "__main__":
    unittest.main()