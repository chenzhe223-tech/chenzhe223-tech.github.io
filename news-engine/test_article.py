import unittest
from article import build_draft

C = {'id':'test1','title':'Example announcement','source_urls':['https://example.org/announcement']}
E = {'claim':'Example published an announcement.', 'source_url':'https://example.org/announcement', 'verified':True, 'checked_at':'2026-11-18T00:00:00+00:00','source_published_at':'2026-11-17T00:00:00+00:00'}

class DraftTests(unittest.TestCase):
    def test_verified_claim_has_citation(self):
        d=build_draft(C,[E]); self.assertIn('https://example.org/announcement',d['body']); self.assertFalse(d['publishable'])
    def test_unverified_never_enters_body(self):
        d=build_draft(C,[dict(E,verified=False)]); self.assertEqual(d['body'],''); self.assertEqual(len(d['unresolved']),1)
    def test_wrong_source_never_enters_body(self):
        d=build_draft(C,[dict(E,source_url='https://other.org/x')]); self.assertEqual(d['body'],'')
    def test_missing_publication_date_never_enters_body(self):
        d=build_draft(C,[dict(E,source_published_at=None)]); self.assertEqual(d['body'],'')
    def test_naive_timestamp_rejected(self):
        d=build_draft(C,[dict(E,checked_at='2026-11-18T00:00:00')]); self.assertEqual(d['body'],'')
    def test_revision_increments(self):
        first=build_draft(C,[E]); second=build_draft(C,[E],[first]); self.assertEqual(second['revision'],2)
    def test_deterministic_digest(self):
        self.assertEqual(build_draft(C,[E])['content_sha256'],build_draft(C,[E])['content_sha256'])
    def test_bad_input_fails(self):
        with self.assertRaises(ValueError): build_draft({},[])

if __name__=='__main__': unittest.main()
