import unittest
from studio import assemble, preview
D={'title':'<News>','body':'<script>alert(1)</script>','publishable':False,'editorial_status':'requires_human_review','revision':1}
A={'id':'cover','kind':'image','url':'https://example.org/image','source_url':'https://example.org/source','rights_status':'owned','alt':'Cover'}
class StudioTests(unittest.TestCase):
    def test_review_only(self):
        p=assemble(D,[A]); self.assertFalse(p['publishable']); self.assertEqual(len(p['layout']),3)
    def test_html_escape(self):
        self.assertIn('&lt;script&gt;',preview(assemble(D,[A])))
    def test_mobile(self):
        self.assertIn('width=device-width',preview(assemble(D,[])))
    def test_rights(self):
        with self.assertRaises(ValueError): assemble(D,[dict(A,rights_status='unknown')])
    def test_https(self):
        with self.assertRaises(ValueError): assemble(D,[dict(A,url='http://example.org/x')])
    def test_duplicate(self):
        with self.assertRaises(ValueError): assemble(D,[A,A])
    def test_publish_guard(self):
        with self.assertRaises(ValueError): assemble(dict(D,publishable=True),[])
    def test_digest(self):
        self.assertEqual(assemble(D,[A])['sha256'],assemble(D,[A])['sha256'])
if __name__=='__main__': unittest.main()
