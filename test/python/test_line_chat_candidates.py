import json
from pathlib import Path
import sqlite3
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'src/extensions/python'))
from line_scoped_core import ReaderError, read_scoped, reference, validate_scope

class CandidateTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.db.executescript('CREATE TABLE _contact(_mid TEXT,_displayName TEXT,_displayNameOverridden TEXT);'
          'CREATE TABLE _chat(_id TEXT,_midType INTEGER);CREATE TABLE _groupChat(_chatMid TEXT,_chatName TEXT);'
          'CREATE TABLE _profile(_mid TEXT);CREATE TABLE _message(_text TEXT);')
        self.db.execute('INSERT INTO _profile VALUES(?)',('self-private-id',))
        self.db.executemany('INSERT INTO _contact VALUES(?,?,?)',[
          ('existing-private-id','Jerry',None),('unopened-private-id','Jerry',''),
          ('renamed-private-id','Jerry','Renamed'),('override-private-id','Other','Jerry'),
          ('unrelated-private-id','Other',None)])
        self.db.executemany('INSERT INTO _chat VALUES(?,0)',[('existing-private-id',),('override-private-id',)])
        self.db.execute('INSERT INTO _groupChat VALUES(?,?)',('group-private-id','Jerry'))
        self.db.execute('INSERT INTO _message VALUES(?)',('private message text',))
        self.db.set_authorizer(lambda action,table,column,*_: sqlite3.SQLITE_DENY
          if action==sqlite3.SQLITE_READ and table=='_message' else sqlite3.SQLITE_OK)
    def tearDown(self):
        self.db.close()
    def test_exact_name_metadata_never_reads_messages_or_exposes_raw_ids(self):
        result=read_scoped(self.db,{'mode':'chatCandidates','chatName':'Jerry'}, {})
        self.assertEqual(len(result['candidates']),4)
        self.assertEqual(result['ownSenderRef'],reference('sender','self-private-id'))
        by_ref={c['chatRef']:c for c in result['candidates']}
        self.assertFalse(by_ref[reference('chat','unopened-private-id')]['existingChat'])
        self.assertTrue(by_ref[reference('chat','existing-private-id')]['existingChat'])
        serialized=json.dumps(result)
        for forbidden in ['private-id','private message','Renamed','Other']:
            self.assertNotIn(forbidden,serialized)
    def test_bound_size_reports_truncation(self):
        result=read_scoped(self.db,{'mode':'chatCandidates','chatName':'Jerry','limit':1},{})
        self.assertEqual(len(result['candidates']),1)
        self.assertTrue(result['hasMore'])
    def test_no_match_does_not_invent_a_target(self):
        result=read_scoped(self.db,{'mode':'chatCandidates','chatName':'Missing'},{})
        self.assertEqual(result['candidates'],[])
        self.assertFalse(result['hasMore'])
    def test_request_is_closed_and_account_ambiguity_is_not_guessed(self):
        for extra in [{'dateFrom':'2026-10-12'},{'identityOnly':True},{'limit':21},{'limit':True}]:
            with self.assertRaises(ReaderError):validate_scope({'mode':'chatCandidates','chatName':'Jerry',**extra})
        self.db.execute('INSERT INTO _profile VALUES(?)',('another-private-id',))
        self.assertIsNone(read_scoped(self.db,{'mode':'chatCandidates','chatName':'Jerry'},{})['ownSenderRef'])

if __name__=='__main__':unittest.main()
