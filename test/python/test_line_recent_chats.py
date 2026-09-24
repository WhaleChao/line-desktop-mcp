import datetime as dt
import sqlite3
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[2] / 'src' / 'extensions' / 'python'))
from line_scoped_core import ReaderError, read_recent_chats, reference, validate_scope

TZ = dt.timezone(dt.timedelta(hours=8))
NOW = dt.datetime(2026, 9, 24, 12, 0, tzinfo=TZ)


class TracedConnection:
    def __init__(self, db):
        self.db = db
        self.sql = []

    def execute(self, sql, parameters=()):
        self.sql.append(sql)
        return self.db.execute(sql, parameters)


class RecentChatsTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.executescript('''
          CREATE TABLE _groupChat(_chatMid TEXT, _chatName TEXT);
          CREATE TABLE _chat(_id TEXT, _midType INTEGER);
          CREATE TABLE _contact(_mid TEXT, _displayNameOverridden TEXT, _displayName TEXT);
          CREATE TABLE _profile(_mid TEXT);
          CREATE TABLE _message(_chatId TEXT, _createdTime INTEGER, _text TEXT,
            _contentMetadata BLOB, _contentInfo BLOB);
        ''')
        self.connection = TracedConnection(self.db)

    def tearDown(self):
        self.db.close()

    def stamp(self, day, hour=0):
        return int(dt.datetime.fromisoformat(f'{day}T{hour:02}:00:00+08:00').timestamp() * 1000)

    def add(self, chat_id, when):
        self.db.execute('INSERT INTO _message VALUES (?,?,?,?,?)',
                        (chat_id, when, 'SECRET TEXT', b'SECRET MEDIA', b'SECRET INFO'))

    def test_boundaries_types_names_query_cap_and_no_content_select(self):
        self.db.execute('INSERT INTO _profile VALUES (?)', ('own',))
        for chat_id, name in [('g1', '同名'), ('g2', '同名'), ('g3', 'Other'),
                              ('blank', ''), ('conflict', 'First')]:
            self.db.execute('INSERT INTO _groupChat VALUES (?,?)', (chat_id, name))
        self.db.execute('INSERT INTO _groupChat VALUES (?,?)', ('conflict', 'Second'))
        for chat_id, name in [('d1', '同名'), ('unknown', None), ('nondirect', 'Hidden')]:
            self.db.execute('INSERT INTO _chat VALUES (?,?)', (chat_id, 0 if chat_id != 'nondirect' else 1))
            self.db.execute('INSERT INTO _contact VALUES (?,?,?)', (chat_id, None, name))
        first14 = self.stamp('2026-09-11')
        first30 = self.stamp('2026-08-26')
        for chat_id, when in [('g1', first14), ('g2', first14 + 1),
                              ('d1', self.stamp('2026-09-24', 9)),
                              ('g3', first30), ('blank', self.stamp('2026-09-24')),
                              ('unknown', self.stamp('2026-09-24')),
                              ('conflict', self.stamp('2026-09-24')),
                              ('nondirect', self.stamp('2026-09-24')),
                              ('too_old', first30 - 1),
                              ('tomorrow', self.stamp('2026-09-25'))]:
            self.add(chat_id, when)
        result = read_recent_chats(self.connection, {'mode': 'recentChats', 'days': 14}, now=NOW)
        self.assertEqual((result['dateFrom'], result['dateTo']), ('2026-09-11', '2026-09-24'))
        self.assertEqual([item['chatRef'] for item in result['chats']],
                         [reference('chat', 'd1'), reference('chat', 'g2'), reference('chat', 'g1')])
        self.assertEqual([item['chatType'] for item in result['chats']], ['direct', 'group', 'group'])
        self.assertEqual(result['ownSenderRef'], reference('sender', 'own'))
        self.assertEqual(len(result['warnings']), 2)
        thirty = read_recent_chats(self.connection, {'mode': 'recentChats', 'days': 30,
                             'query': 'OTHER'}, now=NOW)
        self.assertEqual([item['chatName'] for item in thirty['chats']], ['Other'])
        self.assertEqual(thirty['dateFrom'], '2026-08-26')
        capped = read_recent_chats(self.connection, {'mode': 'recentChats', 'days': 14,
                            'limit': 2}, now=NOW)
        self.assertEqual(len(capped['chats']), 2)
        self.assertTrue(capped['hasMore'])
        self.assertTrue(all('_text' not in sql and '_contentMetadata' not in sql
                            and '_contentInfo' not in sql for sql in self.connection.sql))
        self.assertTrue(all('SECRET' not in str(item) for item in result['chats']))

    def test_closed_mode_and_bounded_activity_count(self):
        for bad in ({'mode': 'recentChats', 'days': 15},
                    {'mode': 'recentChats', 'days': 14, 'chatName': 'x'},
                    {'mode': 'recentChats', 'days': 14, 'mediaMode': 'metadata'},
                    {'mode': 'recentChats', 'days': 14, 'identityOnly': True},
                    {'mode': 'recentChats', 'days': 14, 'query': ''},
                    {'mode': 'recentChats', 'days': 14, 'limit': 51}):
            with self.assertRaises(ReaderError):
                validate_scope(bad)
        self.assertEqual(len(validate_scope({'mode': 'recentChats', 'days': 14})), 3)
        self.db.executemany('INSERT INTO _message VALUES (?,?,?,?,?)',
                            [(f'chat{i}', self.stamp('2026-09-24'), None, None, None)
                             for i in range(1001)])
        with self.assertRaisesRegex(ReaderError, 'RECENT_SCOPE_TOO_LARGE'):
            read_recent_chats(self.connection, {'mode': 'recentChats', 'days': 14}, now=NOW)


if __name__ == '__main__':
    unittest.main()
