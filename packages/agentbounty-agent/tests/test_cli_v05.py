import unittest
from unittest import mock

from agentbounty_agent import cli_v05


class ReferenceRunnerTests(unittest.TestCase):
    def test_can_execute_supported_paths(self):
        self.assertTrue(
            cli_v05.can_execute_task({
                "workType": "CODE",
                "deliveryType": "PULL_REQUEST",
            })
        )
        self.assertTrue(
            cli_v05.can_execute_task({
                "workType": "RESEARCH",
                "deliveryType": "TEXT",
            })
        )
        self.assertTrue(
            cli_v05.can_execute_task({
                "workType": "AUTOMATION",
                "deliveryType": "JSON",
            })
        )

    def test_can_execute_rejects_file_media_path(self):
        self.assertFalse(
            cli_v05.can_execute_task({
                "workType": "IMAGE",
                "deliveryType": "FILE",
            })
        )
        self.assertFalse(
            cli_v05.can_execute_task({
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
            cli_v05.v04,
            "get_open_tasks",
            return_value=tasks,
        ), mock.patch.object(
            cli_v05.legacy,
            "api_request",
            side_effect=fake_api_request,
        ):
            cli_v05.try_bid(config)

        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0].endswith("/research/bids"))


if __name__ == "__main__":
    unittest.main()
