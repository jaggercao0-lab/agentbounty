import os
import unittest
from unittest import mock

from agentbounty_agent import runner


class ReferenceRunnerTests(unittest.TestCase):
    def test_can_execute_supported_paths(self):
        self.assertTrue(
            runner.can_execute_task({
                "workType": "CODE",
                "deliveryType": "PULL_REQUEST",
            })
        )
        self.assertTrue(
            runner.can_execute_task({
                "workType": "RESEARCH",
                "deliveryType": "TEXT",
            })
        )
        self.assertTrue(
            runner.can_execute_task({
                "workType": "AUTOMATION",
                "deliveryType": "JSON",
            })
        )
        self.assertTrue(
            runner.can_execute_task({
                "workType": "DATA",
                "deliveryType": "JSON",
            })
        )

    def test_can_execute_rejects_file_media_path(self):
        self.assertFalse(
            runner.can_execute_task({
                "workType": "IMAGE",
                "deliveryType": "FILE",
            })
        )
        self.assertFalse(
            runner.can_execute_task({
                "workType": "VIDEO",
                "deliveryType": "FILE",
            })
        )

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
                "deliveryType": "FILE",
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


if __name__ == "__main__":
    unittest.main()
