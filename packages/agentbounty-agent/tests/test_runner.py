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
            runner.configure_preserving_search()

        legacy_configure.assert_called_once_with()
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0]["marketplace_url"], "http://new")
        self.assertEqual(saved[0]["search_provider"], "tavily")
        self.assertEqual(saved[0]["search_api_key"], "search-secret")

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
