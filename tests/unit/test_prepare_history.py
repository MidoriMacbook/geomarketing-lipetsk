"""Проверки локальной подготовки истории с настоящей временной SSH-подписью."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from scripts import prepare_history as history


class HistoryPreparationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='geomarketing-history-')
        cls.root = Path(cls.temp.name)
        cls.repo = cls.root / 'source'
        cls.repo.mkdir()
        cls.env = os.environ.copy()
        cls.env.update({
            'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': os.devnull,
            'GIT_AUTHOR_NAME': 'History Test', 'GIT_AUTHOR_EMAIL': 'history-test@example.invalid',
            'GIT_COMMITTER_NAME': 'History Test', 'GIT_COMMITTER_EMAIL': 'history-test@example.invalid',
            'GIT_AUTHOR_DATE': '2020-01-02T03:04:05+0300',
            'GIT_COMMITTER_DATE': '2021-02-03T04:05:06-0200',
        })
        cls.run_git('init', '--initial-branch=main')
        blob = cls.run_git('hash-object', '-w', '--stdin', data=b'unchanged test file\n').strip()
        cls.tree = cls.run_git('mktree', data=b'100644 blob ' + blob + b'\tnote.txt\n').strip().decode()
        cls.plain = cls.commit('начало проверки')
        cls.key = cls.root / 'test-signing-key'
        cls.ssh_keygen = shutil.which('ssh-keygen')
        if not cls.ssh_keygen:
            raise RuntimeError('Для проверки настоящей тестовой подписи требуется ssh-keygen')
        subprocess.run([cls.ssh_keygen, '-q', '-t', 'ed25519', '-N', '', '-f', str(cls.key)],
                       check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        cls.signing = ('-c', 'gpg.format=ssh', '-c', f'user.signingkey={cls.key}')
        cls.run_git('config', 'gpg.ssh.program', cls.ssh_keygen.replace('\\', '/'))
        changed_blob = cls.run_git('hash-object', '-w', '--stdin', data=b'changed in signed revision\n').strip()
        changed_tree = cls.run_git('mktree', data=b'100644 blob ' + changed_blob + b'\tnote.txt\n').strip().decode()
        cls.signed = cls.commit('подписанная проверка', [cls.plain], signed=True, tree=changed_tree)
        cls.side = cls.commit('боковая проверка', [cls.plain])
        cls.merge = cls.commit('объединение проверки', [cls.signed, cls.side])
        cls.run_git('update-ref', 'refs/heads/main', cls.merge)
        cls.run_git('update-ref', 'refs/heads/osm-data', cls.signed)
        cls.run_git('update-ref', 'refs/heads/codex/site-workspace', cls.side)
        cls.raw_signed = cls.run_git('cat-file', 'commit', cls.signed)
        cls.raw_plain = cls.run_git('cat-file', 'commit', cls.plain)
        cls.source_refs = history.refs(cls.repo)
        # Подпись принадлежит только временной тестовой личности и проверяется Git.
        public = Path(str(cls.key) + '.pub').read_text(encoding='utf8').strip()
        allowed = cls.root / 'allowed-signers'
        allowed.write_text('history-test@example.invalid ' + public + '\n', encoding='utf8')
        cls.run_git('-c', f'gpg.ssh.allowedSignersFile={allowed}', 'verify-commit', cls.signed)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    @classmethod
    def run_git(cls, *args, data=None):
        result = subprocess.run(['git', '-C', str(cls.repo), *args], input=data,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=cls.env)
        if result.returncode:
            raise RuntimeError(result.stderr.decode('utf8', 'replace'))
        return result.stdout

    @classmethod
    def commit(cls, message, parents=(), signed=False, tree=None):
        command = [*cls.signing] if signed else []
        command.extend(['commit-tree', tree or cls.tree])
        if signed:
            command.append('-S')
        for parent in parents:
            command.extend(['-p', parent])
        return cls.run_git(*command, data=(message + '\n').encode()).strip().decode()

    def fields(self, raw):
        return history.parse_headers(raw.split(b'\n\n', 1)[0])

    def test_strip_whole_actual_multiline_signature_preserves_other_headers(self):
        mapped = 'a' * len(self.plain)
        raw, removed = history.rewrite_commit(self.raw_signed, {self.plain: mapped},
                                              'новое название', signature_mode='strip')
        old = self.fields(self.raw_signed)
        self.assertEqual(len(removed), 1)
        self.assertEqual(removed[0]['field'], 'gpgsig')
        signature = next(value for name, value in old if name == b'gpgsig')
        self.assertGreater(len(signature.splitlines()), 2)
        self.assertEqual(removed[0]['sha256'], hashlib.sha256(signature).hexdigest())
        self.assertNotIn(b'-----END SSH SIGNATURE-----', raw)
        self.assertEqual([value for name, value in self.fields(raw) if name != b'parent'],
                         [value for name, value in old if name not in (b'parent', b'gpgsig')])
        self.assertEqual([value for name, value in self.fields(raw) if name == b'parent'],
                         [b'parent ' + mapped.encode()])
        self.assertEqual(raw.split(b'\n\n', 1)[1], 'новое название\n'.encode())

    def test_sha256_field_parser_uses_actual_signature_bytes_without_forging_commit(self):
        signature = next(value for name, value in self.fields(self.raw_signed) if name == b'gpgsig')
        # Это только вход парсера; изменённое поле не выдаётся за действительную подпись.
        field = signature.replace(b'gpgsig ', b'gpgsig-sha256 ', 1)
        parsed = history.parse_headers(field)
        self.assertEqual(parsed, [(b'gpgsig-sha256', field)])
        header, message = self.raw_plain.split(b'\n\n', 1)
        changed, removed = history.rewrite_commit(header + b'\n' + field + b'\n\n' + message,
                                                  {}, 'начало проверки', signature_mode='strip')
        self.assertEqual(changed, self.raw_plain)
        self.assertEqual(removed[0]['field'], 'gpgsig-sha256')
        self.assertEqual(removed[0]['sha256'], hashlib.sha256(field).hexdigest())

    def test_unknown_multiline_field_is_preserved_and_continuation_is_not_parent(self):
        header, message = self.raw_plain.split(b'\n\n', 1)
        extra = b'x-review-note first line\n parent not-a-parent\n final line'
        raw, removed = history.rewrite_commit(header + b'\n' + extra + b'\n\n' + message,
                                              {}, 'начало проверки', signature_mode='strip')
        self.assertEqual(raw, header + b'\n' + extra + b'\n\n' + message)
        self.assertEqual(removed, [])

    def test_default_stops_on_signature_and_mergetag_stops_even_in_strip_mode(self):
        with self.assertRaisesRegex(RuntimeError, 'подпис|Подпис'):
            history.rewrite_commit(self.raw_signed, {self.plain: self.plain}, 'название проверки')
        # Настоящий аннотированный тег, не криптографическая подпись коммита.
        self.run_git('tag', '-a', 'test-tag', self.side, '-m', 'описание тега')
        tag = self.run_git('cat-file', 'tag', 'refs/tags/test-tag').rstrip(b'\n')
        header, message = self.raw_plain.split(b'\n\n', 1)
        embedded = b'mergetag ' + tag.replace(b'\n', b'\n ')
        try:
            with self.assertRaisesRegex(RuntimeError, 'mergetag'):
                history.rewrite_commit(header + b'\n' + embedded + b'\n\n' + message,
                                       {}, 'название проверки', signature_mode='strip')
        finally:
            self.run_git('tag', '-d', 'test-tag')

    def test_malformed_headers_and_unknown_mode_are_rejected(self):
        for raw in (b' orphan continuation', b'broken', b'parent\n value', b'\tbad value'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                history.parse_headers(raw)
        with self.assertRaises(ValueError):
            history.rewrite_commit(self.raw_plain, {}, 'название проверки', signature_mode='other')

    def test_complete_isolated_rehearsal_preserves_tree_people_dates_and_parent_order(self):
        output = self.repo / '.maintenance' / 'unsigned'
        result = history.prepare_history(self.repo, output, strip_signatures=True)
        rows = json.loads((output / 'mapping.json').read_text(encoding='utf8'))
        mapping = {item['old']: item['new'] for item in rows}
        mirror = output / 'rehearsal.git'
        for old, new in mapping.items():
            original = self.run_git('cat-file', 'commit', old)
            changed = history.git(mirror, 'cat-file', 'commit', new)
            old_fields, new_fields = self.fields(original), self.fields(changed)
            self.assertEqual([raw for name, raw in new_fields if name != b'parent'],
                             [raw for name, raw in old_fields if name not in (b'parent', b'gpgsig', b'gpgsig-sha256')])
            self.assertEqual([mapping[raw[7:].decode()] for name, raw in old_fields if name == b'parent'],
                             [raw[7:].decode() for name, raw in new_fields if name == b'parent'])
            self.assertFalse(any(name in (b'gpgsig', b'gpgsig-sha256') for name, _ in new_fields))
        signatures = json.loads((output / 'signatures.json').read_text(encoding='utf8'))
        verified = json.loads((output / 'verification.json').read_text(encoding='utf8'))
        self.assertEqual(len(signatures), 1)
        self.assertEqual(verified['removed_signature_fields'], 1)
        self.assertEqual(verified['signed_commits_stripped'], 1)
        self.assertTrue(verified['all_nonparent_nonsignature_headers_identical_bytes'])
        self.assertTrue(verified['no_signature_headers_remaining'])
        self.assertEqual(history.refs(self.repo), self.source_refs)
        self.assertEqual(verified['remote_mutations'], 0)
        self.assertEqual(result['commits'], 4)
        self.assertTrue((output / 'operation.md').is_file())
        bundle = output / 'before.bundle'
        self.assertEqual(hashlib.sha256(bundle.read_bytes()).hexdigest(), verified['backup_sha256'])
        restored_signed = history.git(output / 'restore-check.git', 'cat-file', 'commit', self.signed)
        self.assertEqual(restored_signed, self.raw_signed)

    def test_archive_publication_and_rollback_use_exact_leases(self):
        remote_refs = {'refs/heads/main': self.merge, 'refs/heads/osm-data': self.signed,
                       'refs/heads/codex/site-workspace': self.side}
        rewritten = {ref.replace('refs/', 'refs/remote-snapshot/', 1): str(index) * 40
                     for index, ref in enumerate(remote_refs, 1)}
        forward, rollback = history.publication_commands(remote_refs, rewritten, rename=True)
        self.assertIn('--atomic', forward)
        self.assertIn(f'--force-with-lease=refs/heads/codex/site-workspace:{self.side}', forward)
        self.assertIn('--force-with-lease=refs/heads/archive/rabochaya-oblast:', forward)
        self.assertIn(':refs/heads/codex/site-workspace', forward)
        self.assertIn('--force-with-lease=refs/heads/codex/site-workspace:', rollback)
        self.assertIn('--force-with-lease=refs/heads/archive/rabochaya-oblast:' + '3' * 40, rollback)
        self.assertIn(f'{self.side}:refs/heads/codex/site-workspace', rollback)
        self.assertIn(':refs/heads/archive/rabochaya-oblast', rollback)

    def test_isolated_remote_snapshot_generates_reviewable_archive_rollback(self):
        # Это отдельная локальная bare-копия, а не пользовательский GitHub remote.
        remote = self.root / 'remote.git'
        self.run_git('clone', '--bare', '--no-hardlinks', str(self.repo), str(remote))
        self.run_git('remote', 'add', 'origin', remote.as_uri())
        try:
            output = self.repo / '.maintenance' / 'with-remote'
            history.prepare_history(self.repo, output, refresh_remote=True, strip_signatures=True)
            inventory = json.loads((output / 'refs.json').read_text(encoding='utf8'))
            self.assertEqual(inventory['remote_refs'], self.source_refs)
            self.assertEqual(history.refs(remote), self.source_refs)
            self.assertEqual(history.refs(self.repo), self.source_refs)
            forward = (output / 'rename-lease-commands.ps1').read_text(encoding='utf8')
            rollback = (output / 'rename-rollback-commands.ps1').read_text(encoding='utf8')
            self.assertEqual(forward.count('git push --atomic'), 1)
            self.assertEqual(rollback.count('git push --atomic'), 1)
            self.assertIn('refs/heads/archive/rabochaya-oblast', forward)
            self.assertIn(f'{self.side}:refs/heads/codex/site-workspace', rollback)
        finally:
            self.run_git('remote', 'remove', 'origin')

    def test_default_preparation_keeps_backup_and_source_unchanged_when_signature_blocks(self):
        output = self.repo / '.maintenance' / 'blocked'
        with self.assertRaisesRegex(RuntimeError, 'Подписанный'):
            history.prepare_history(self.repo, output)
        self.assertTrue((output / 'before.bundle').is_file())
        self.assertEqual(history.refs(self.repo), self.source_refs)
        self.assertFalse((output / 'operation.md').exists())
        with self.assertRaises(ValueError):
            history.prepare_history(self.repo, output, strip_signatures=True)

    def test_commands_without_remote_snapshot_and_conflicting_modes_are_rejected(self):
        with self.assertRaises(ValueError):
            history.publication_commands({}, {}, rename=True)
        output = self.repo / '.maintenance' / 'conflicting-modes'
        with self.assertRaises(ValueError):
            history.prepare_history(self.repo, output, strip_signatures=True,
                                    retain_invalid_signatures=True)
        self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
