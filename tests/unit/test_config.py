"""Development/production defaults and unchanged environment semantics."""
import unittest
from unittest.mock import patch

from src.config import server_host, server_port


class ServerConfigurationTests(unittest.TestCase):
    def test_entrypoint_defaults_and_environment_overrides(self):
        with patch.dict('os.environ', {}, clear=True):
            self.assertEqual(server_host('127.0.0.1'), '127.0.0.1')
            self.assertEqual(server_port(5001), 5001)
            self.assertEqual(server_host('0.0.0.0'), '0.0.0.0')
            self.assertEqual(server_port(8080), 8080)
        with patch.dict('os.environ', {'HOST': '::1', 'PORT': '5082'}, clear=True):
            self.assertEqual(server_host('127.0.0.1'), '::1')
            self.assertEqual(server_port(8080), 5082)
        with patch.dict('os.environ', {'HOST': '', 'PORT': 'invalid'}, clear=True):
            self.assertEqual(server_host('0.0.0.0'), '')
            with self.assertRaises(ValueError):
                server_port(8080)
