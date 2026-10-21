"""Regression checks for actual import controller paths and gateway limits (no AWS)."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


class ImportGatewayTests(unittest.TestCase):
    def test_waf_exempts_actual_import_routes_only(self):
        waf = (ROOT / 'terraform/modules/waf/main.tf').read_text()
        pattern = re.search(r'regex_string\s*=\s*"([^"]+)"', waf).group(1)
        for domain in ['students', 'questions']:
            controller = (ROOT / f'backend-nestjs/src/{domain}/{domain}.controller.ts').read_text()
            routes = re.findall(r"@Post\('(import(?:/[^']*)?)'\)", controller)
            self.assertTrue(routes)
            for route in routes:
                for suffix in ['', '/']:
                    with self.subTest(route=route, suffix=suffix):
                        self.assertRegex(f'/api/admin/{domain}/{route}{suffix}', pattern)
        for route in ['/api/admin/questions', '/api/admin/questions/import/preview',
                      '/api/admin/questions/import/confirm/extra', '/api/admin/students/import/auto',
                      '/api/admin/students/imported', '/api/admin/users/import', '/api/submissions']:
            self.assertNotRegex(route, pattern)
        self.assertIn('name = "SizeRestrictions_BODY"', waf)
        self.assertIn('name     = "BlockOversizeBodyOutsideBulkImport"', waf)
        self.assertIn('awswaf:managed:aws:core-rule-set:SizeRestrictions_Body', waf)

    def test_proxy_can_forward_maximum_question_file_with_multipart_overhead(self):
        for source in ['terraform/userdata/app.sh.tftpl', 'terraform/modules/asg/main.tf']:
            template = (ROOT / source).read_text()
            proxy_mib = int(re.search(r'client_max_body_size\s+(\d+)M;', template).group(1))
            self.assertGreater(proxy_mib * 1024 * 1024, 15 * 1024 * 1024 + 65536)
        for domain, limit in [('questions', 15), ('students', 10)]:
            controller = (ROOT / f'backend-nestjs/src/{domain}/{domain}.controller.ts').read_text()
            self.assertIn(f'fileSize: {limit} * 1024 * 1024', controller)
        self.assertRegex((ROOT / 'backend-nestjs/src/main.ts').read_text(), r"limit:\s*['\"]4mb['\"]")


if __name__ == '__main__':
    unittest.main()
