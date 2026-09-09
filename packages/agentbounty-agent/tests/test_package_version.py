import unittest
from importlib.metadata import version

import agentbounty_agent


class PackageVersionTests(unittest.TestCase):
    def test_runtime_version_matches_installed_package_metadata(self):
        self.assertEqual(
            agentbounty_agent.__version__,
            version("agentbounty-agent"),
        )


if __name__ == "__main__":
    unittest.main()
