import os
import unittest
from unittest import mock

from agentbounty_agent import cli_v04


class ProtocolV04Tests(unittest.TestCase):
    def test_source_body_to_text_strips_scripts(self):
        html = b"""
        <html>
          <head><style>.x { color: red; }</style></head>
          <body>
            <h1>Example title</h1>
            <script>alert('ignore')</script>
            <p>Hello <strong>world</strong>.</p>
          </body>
        </html>
        """

        text = cli_v04._source_body_to_text(
            html,
            "text/html; charset=utf-8",
            "utf-8",
        )

        self.assertIn("Example title", text)
        self.assertIn("Hello world", text)
        self.assertNotIn("alert", text)
        self.assertNotIn("color: red", text)

    def test_validate_public_https_url_rejects_localhost(self):
        with self.assertRaises(RuntimeError):
            cli_v04._validate_public_https_url(
                "https://localhost/private"
            )

    def test_validate_public_https_url_rejects_private_dns_result(self):
        private_result = [
            (
                2,
                1,
                6,
                "",
                ("192.168.1.20", 443),
            )
        ]

        with mock.patch(
            "agentbounty_agent.cli_v04.socket.getaddrinfo",
            return_value=private_result,
        ):
            with self.assertRaises(RuntimeError):
                cli_v04._validate_public_https_url(
                    "https://example.com/source"
                )

    def test_validate_public_https_url_accepts_public_dns_result(self):
        public_result = [
            (
                2,
                1,
                6,
                "",
                ("93.184.216.34", 443),
            )
        ]

        with mock.patch(
            "agentbounty_agent.cli_v04.socket.getaddrinfo",
            return_value=public_result,
        ):
            value = cli_v04._validate_public_https_url(
                "https://example.com/source"
            )

        self.assertEqual(
            value,
            "https://example.com/source",
        )

    def test_try_bid_skips_existing_bid_and_continues(self):
        config = {
            "agent_id": "agent-1",
            "min_bounty_cents": 100,
            "max_bounty_cents": 100000,
        }
        tasks = [
            {
                "id": "high",
                "title": "High",
                "bountyCents": 10000,
                "workType": "CODE",
            },
            {
                "id": "research",
                "title": "Research",
                "bountyCents": 5000,
                "workType": "RESEARCH",
            },
        ]
        calls = []

        def fake_api_request(config_arg, path, method="GET", body=None):
            calls.append((path, method, body))
            if path.endswith("/high/bids"):
                return {"alreadyExists": True}
            if path.endswith("/research/bids"):
                return {"alreadyExists": False, "id": "bid-2"}
            raise AssertionError(path)

        with mock.patch.object(
            cli_v04,
            "get_open_tasks",
            return_value=tasks,
        ), mock.patch.object(
            cli_v04.legacy,
            "api_request",
            side_effect=fake_api_request,
        ):
            cli_v04.try_bid(config)

        self.assertEqual(len(calls), 2)
        self.assertTrue(calls[0][0].endswith("/high/bids"))
        self.assertTrue(calls[1][0].endswith("/research/bids"))

    def test_research_without_tavily_key_is_model_only(self):
        context = {
            "task": {
                "workType": "RESEARCH",
                "title": "Test research",
            }
        }

        with mock.patch.dict(os.environ, {}, clear=True):
            evidence, metadata = (
                cli_v04._collect_research_evidence(
                    {},
                    context,
                )
            )

        self.assertEqual(evidence, [])
        self.assertEqual(metadata["researchMode"], "model_only")
        self.assertEqual(metadata["sourceCount"], 0)

    def test_execute_text_job_submits_markdown_and_revision_context(self):
        config = {
            "agent_id": "agent-1",
        }
        job = {
            "id": "task-1",
            "title": "Revise report",
            "workType": "RESEARCH",
            "deliveryType": "TEXT",
        }
        context = {
            "task": {
                "id": "task-1",
                "title": "Revise report",
                "workType": "RESEARCH",
                "deliveryType": "TEXT",
                "revision": {
                    "number": 1,
                    "feedback": "Add a comparison table.",
                    "previousSubmission": {
                        "textContent": "Old answer",
                    },
                },
            },
            "source": {
                "type": "MANUAL",
                "url": None,
                "data": None,
            },
            "submit": {
                "deliveryType": "TEXT",
            },
        }
        submitted = {}
        llm_messages = []

        def fake_api_request(config_arg, path, method="GET", body=None):
            if path.startswith("/api/v1/tasks/task-1/context"):
                return context
            if path == "/api/v1/tasks/task-1/submissions":
                submitted.update(body or {})
                return {"id": "submission-1"}
            raise AssertionError(path)

        def fake_llm(config_arg, messages):
            llm_messages.extend(messages)
            return "# Revised report\n\nUpdated result."

        with mock.patch.object(
            cli_v04.legacy,
            "api_request",
            side_effect=fake_api_request,
        ), mock.patch.object(
            cli_v04.legacy,
            "call_llm",
            side_effect=fake_llm,
        ), mock.patch.object(
            cli_v04,
            "_hydrate_task_source",
            return_value=(
                context,
                {"sourceFetch": {"attempted": False}},
            ),
        ), mock.patch.object(
            cli_v04,
            "_collect_research_evidence",
            return_value=(
                [],
                {
                    "researchMode": "model_only",
                    "sourceCount": 0,
                },
            ),
        ):
            cli_v04.execute_general_job(config, job)

        self.assertEqual(submitted["deliveryType"], "TEXT")
        self.assertEqual(
            submitted["textContent"],
            "# Revised report\n\nUpdated result.",
        )
        self.assertEqual(
            submitted["metadata"]["researchMode"],
            "model_only",
        )
        prompt = llm_messages[-1]["content"]
        self.assertIn("Add a comparison table.", prompt)
        self.assertIn("Old answer", prompt)

    def test_execute_json_job_submits_parsed_object(self):
        config = {
            "agent_id": "agent-2",
        }
        job = {
            "id": "task-2",
            "title": "Normalize data",
            "workType": "DATA",
            "deliveryType": "JSON",
        }
        context = {
            "task": {
                "id": "task-2",
                "title": "Normalize data",
                "workType": "DATA",
                "deliveryType": "JSON",
            },
            "source": {
                "type": "MANUAL",
                "url": None,
                "data": {"value": 7},
            },
            "submit": {
                "deliveryType": "JSON",
            },
        }
        submitted = {}

        def fake_api_request(config_arg, path, method="GET", body=None):
            if path.startswith("/api/v1/tasks/task-2/context"):
                return context
            if path == "/api/v1/tasks/task-2/submissions":
                submitted.update(body or {})
                return {"id": "submission-2"}
            raise AssertionError(path)

        with mock.patch.object(
            cli_v04.legacy,
            "api_request",
            side_effect=fake_api_request,
        ), mock.patch.object(
            cli_v04.legacy,
            "call_llm",
            return_value='{"normalized": 7, "ok": true}',
        ), mock.patch.object(
            cli_v04,
            "_hydrate_task_source",
            return_value=(
                context,
                {"sourceFetch": {"attempted": False}},
            ),
        ):
            cli_v04.execute_general_job(config, job)

        self.assertEqual(submitted["deliveryType"], "JSON")
        self.assertEqual(
            submitted["jsonContent"],
            {"normalized": 7, "ok": True},
        )
        self.assertEqual(
            submitted["metadata"]["researchMode"],
            "not_applicable",
        )


if __name__ == "__main__":
    unittest.main()
