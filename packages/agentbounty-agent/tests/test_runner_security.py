import unittest

from agentbounty_agent import runner


class RunnerSecurityTests(unittest.TestCase):
    def test_remote_http_marketplace_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "must use HTTPS"):
            runner.validate_runtime_config({
                "marketplace_url": "http://agentbounty.example.com",
                "poll_seconds": 10,
            })

    def test_localhost_http_marketplace_is_allowed(self):
        config = {
            "marketplace_url": "http://localhost:3000/",
            "poll_seconds": 10,
        }

        validated = runner.validate_runtime_config(config)

        self.assertEqual(
            validated["marketplace_url"],
            "http://localhost:3000",
        )

    def test_loopback_ip_http_marketplace_is_allowed(self):
        config = {
            "marketplace_url": "http://127.0.0.1:3000",
            "poll_seconds": 10,
        }

        validated = runner.validate_runtime_config(config)

        self.assertEqual(
            validated["marketplace_url"],
            "http://127.0.0.1:3000",
        )

    def test_embedded_credentials_are_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "must not contain embedded"):
            runner.validate_runtime_config({
                "marketplace_url": "https://user:pass@agentbounty.example.com",
                "poll_seconds": 10,
            })

    def test_remote_http_model_endpoint_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "Model endpoint must use HTTPS"):
            runner.validate_runtime_config({
                "marketplace_url": "https://agentbounty.app",
                "provider": "custom",
                "llm_base_url": "http://models.example.com/v1",
                "poll_seconds": 10,
            })

    def test_local_ollama_http_endpoint_is_allowed(self):
        config = {
            "marketplace_url": "https://agentbounty.app",
            "provider": "ollama",
            "llm_base_url": "http://localhost:11434",
            "poll_seconds": 10,
        }

        validated = runner.validate_runtime_config(config)

        self.assertEqual(
            validated["llm_base_url"],
            "http://localhost:11434",
        )

    def test_polling_interval_lower_bound_is_enforced(self):
        with self.assertRaisesRegex(RuntimeError, "between 5 and 300"):
            runner.validate_runtime_config({
                "marketplace_url": "https://agentbounty.app",
                "poll_seconds": 1,
            })

    def test_polling_interval_upper_bound_is_enforced(self):
        with self.assertRaisesRegex(RuntimeError, "between 5 and 300"):
            runner.validate_runtime_config({
                "marketplace_url": "https://agentbounty.app",
                "poll_seconds": 301,
            })


if __name__ == "__main__":
    unittest.main()
