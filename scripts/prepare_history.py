"""Создать резервную копию и проверить переименование истории в отдельном зеркале."""

import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path


# Ключи относятся к исходным коммитам; новые корректные русские сообщения сохраняются.
TITLES = dict(line.split(" ", 1) for line in """
909e5e4 начало проекта
6e42035 рабочая версия приложения
9b6a728 настройки публичного сервиса
2f4a1b4 ручная публикация приложения
988589c рабочая область геомаркетинга
0ae232c транзакции браузерного хранилища
96983cb разделение серверных модулей
6342424 проверка прямых импортов
81db43e карта и браузерные модули
a525466 границы модулей приложения
b82c87b контраст и крупный текст
17dc3d8 проверка обновлённой архитектуры
92053e9 карта и отменяемые анимации
7db9c3f проверка анимаций интерфейса
2caac11 доступность показателей и действий
c438cc2 проверка публикации интерфейса
7195dbe проверка опубликованного интерфейса
c4348fb тёмная рабочая область
1966a1b контраст выделения текста
456f59d проверка тёмной темы
56edbc4 анимация числовых показателей
209734b палитра и обновление карточек
f402439 контраст карты и выделения
d4a9ba5 цвет браузерной темы
c8c14a2 проверка палитры и счётчиков
10295c9 цвета карты и заголовок
9504400 проверка контраста и заголовка
e7033d2 маркеры и мобильные отступы
661ea50 плавное появление заголовка
1154e61 проверка карты и заголовка
5a85c3f оформление меню выбора
dbf8223 проверка меню выбора
ac9a4ae сценарии локального анализа
b56de83 план сценариев исследования
c04c9ff объяснение рекомендаций и источников
0102978 сохранение сценариев анализа
283472b исследования и сравнение мест
01dced1 восстановление старых отчётов
72135d5 проверка публикации исследований
0be19ea пересчёт при смене района
c8b09a2 проверка автоматического пересчёта
02bf554 расширение каталога районов
192864e исследование каталога районов
c294c63 план расширения каталога
d41bd10 маркеры домов и каталог
8845482 категории и импорт областей
4612732 районы и резервные снимки
4d20527 проверка формата импорта
945c535 доступность пунктов каталога
3ce97ff проверка расширенного каталога
e5605b0 описание палитры карты
7d48753 состояние расширенного каталога
fa94c81 проверка публикации каталога
a002719 план полевых проверок
8c33568 высота рабочей карты
87777f1 локальные полевые проверки
29505e0 цвета полевых проверок
a04c4c9 пояснения и сценарии исследований
c317035 анимация полевых проверок
0fbbbea локальные временные отчёты
a8908bb фокус исследования и печать
0d15077 описание адаптивной рабочей области
e9bb7c4 завершение анимаций интерфейса
d8a55d7 проверка сокращённых анимаций
ebe9e98 ожидание готовности списка
44c4f04 проверка публикации рабочей области
11a6faf открытие исследования на карте
9a15e57 проверка открытия исследований
52189ca план редакционного оформления
e1829b6 светлая обложка и карта
09a333e анимация главного экрана
a48e54e доступность увеличенной навигации
bab1e85 прокрутка компактного меню
8a4b2f7 контраст кнопки сохранения
42ce49e обложка и доступная навигация
03ae5c5 шрифты и якорная навигация
0944a9a видимость клавиатурного фокуса
56f3555 адаптивная типографика обложки
2f52942 проверка редакционного оформления
f1b0b78 тёплая палитра и анимации
41d1b59 проверка тёплой палитры
9a272f7 мобильная навигация и показатели
a251cb1 отклик настольной навигации
f16e2dd проверка сенсорного интерфейса
d8ff80e мобильный отклик и обновление
21ff945 проверка мобильного отклика
52ae2c6 выравнивание источников данных
f955bb7 обновление данных и координаты
fb248d1 диагностика подключения источника
27a7abd основной источник данных
32c10ac резервный источник данных
6cfff16 ограничение времени загрузки
90bab65 диагностика сетевого подключения
f87d22b варианты доставки данных
219a18f ежедневная выгрузка города
4f9ed55 доставка ежедневных данных
ec32578 проверка оценки населения
2e737b8 проверка ежедневной доставки
c9ff36f показатели и выбор места
f31ee4e отклик рекомендаций и палитра
b3a819e проверка публичной рабочей области
c0d38c0 пояснения показателей и документация
be7d13b русские описания и проверки
0b9f78b проверка статусов и иконок
c8a5167 мобильный анализ и настройки
913b5f8 выбор касанием и метрики
568fb42 проверка мобильного анализа
a456c89 мобильные переходы и расчёт
dc0c209 радиус архива и центр
b53b10e проверка мобильных взаимодействий
ebcf9d8 мобильная схема и стрелки
aa5511b проверка схемы и стрелок
8cb0185 рекомендации и сравнение мест
29a5ac2 проверка рекомендаций и сравнения
2d62a33 возврат к анализу
08d3dd0 проверка рабочего сценария
158c12d стрелки и состояния интерфейса
b6c7a2b проверка визуального оформления
5cfdded мобильные действия и данные
""".strip().splitlines())

BRANCH_NAMES = dict(line.split(" ", 1) for line in """
animated-number-counters archive/schetchiki
architecture-editorial-redesign archive/arhitektura
cartography-motion-redesign archive/kartografiya
catalog-and-map-colors archive/katalog
contrast-and-typed-intro archive/kontrast
dark-motion-redesign archive/temnaya-tema
district-auto-calculation archive/raiony
editorial-map-hero archive/oblozhka
harmonious-map-mobile-spacing archive/otstupy
research-open-motion archive/otkrytie-issledovaniya
scenarios-and-explainability archive/scenarii
site-workspace archive/rabochaya-oblast
styled-select-menus archive/menyu
touch-motion-polish archive/kasaniya
warm-motion-polish archive/teplaya-palitra
workspace-flow-field-checks archive/polevye-proverki
""".strip().splitlines())


def git(repo, *args, data=None):
    """Передавать содержимое объектов побайтно, без преобразования переводов строк."""
    result = subprocess.run(["git", "-C", str(repo), *args], input=data,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(result.stderr.decode("utf-8", "replace"))
    return result.stdout


def refs(repo):
    return dict(line.split(" ", 1) for line in git(
        repo, "for-each-ref", "--format=%(refname) %(objectname)").decode().splitlines())


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def title(sha, message, overrides):
    if sha in overrides:
        result = overrides[sha]
    elif sha[:7] in TITLES:
        result = TITLES[sha[:7]]
    elif message.startswith(b"data: daily Lipetsk OSM extract"):
        result = "ежедневные данные города"
    else:
        result = message.decode("utf-8").strip()
    if not re.fullmatch(r"[а-яё]+(?: [а-яё]+){1,4}", result):
        raise ValueError(f"Нужно русское название из 2–5 слов: {sha}: {result!r}")
    return result


SIGNATURE_FIELDS = frozenset((b"gpgsig", b"gpgsig-sha256"))


def parse_headers(header):
    """Разобрать полные поля Git, сохранив их исходные байты и строки продолжения."""
    fields = []
    for line in header.split(b"\n"):
        if line.startswith(b" "):
            if not fields:
                raise ValueError("Продолжение заголовка Git без исходного поля")
            name, raw = fields[-1]
            fields[-1] = name, raw + b"\n" + line
            continue
        name, separator, _ = line.partition(b" ")
        if not separator or not re.fullmatch(rb"[\x21-\x7e]+", name):
            raise ValueError("Некорректное поле заголовка Git")
        fields.append((name, line))
    return fields


def commit_fields(raw):
    header, separator, message = raw.partition(b"\n\n")
    if not separator:
        raise ValueError("Нет разделителя заголовка и сообщения Git")
    fields = parse_headers(header)
    for name in (b"tree", b"author", b"committer"):
        if sum(key == name for key, _ in fields) != 1:
            raise ValueError(f"Нужно ровно одно поле {name.decode()} в коммите")
    return fields, message


def rewrite_commit(raw, parent_mapping, new_title, *, signature_mode="reject"):
    """Менять только сообщение, ссылки родителей и явно разрешённые поля подписи."""
    if signature_mode not in ("reject", "strip", "retain"):
        raise ValueError("Неизвестный режим обработки подписей")
    fields, message = commit_fields(raw)
    if any(name == b"mergetag" for name, _ in fields):
        raise RuntimeError("mergetag содержит встроенный тег: нужна отдельная политика, поле не удалено")
    if signature_mode == "reject" and any(name in SIGNATURE_FIELDS for name, _ in fields):
        raise RuntimeError("Подписанный коммит требует явного режима обработки подписей")
    changed, removed = [], []
    for index, (name, value) in enumerate(fields):
        if name in SIGNATURE_FIELDS and signature_mode == "strip":
            removed.append({"field": name.decode(), "header_index": index,
                            "sha256": hashlib.sha256(value).hexdigest(), "bytes": len(value)})
            continue
        if name == b"parent":
            parent = value.removeprefix(b"parent ")
            if not re.fullmatch(rb"(?:[0-9a-f]{40}|[0-9a-f]{64})", parent):
                raise ValueError("Некорректная ссылка parent")
            try:
                replacement = parent_mapping[parent.decode()]
            except KeyError as exc:
                raise RuntimeError(f"Родитель отсутствует в mapping: {parent.decode()}") from exc
            if not re.fullmatch(r"(?:[0-9a-f]{40}|[0-9a-f]{64})", replacement):
                raise ValueError("Некорректная новая ссылка parent")
            value = b"parent " + replacement.encode()
        changed.append(value)
    # Уже корректное сообщение сохраняется вместе с исходным завершающим LF.
    new_message = message if message.decode("utf-8").strip() == new_title else (new_title + "\n").encode()
    return b"\n".join(changed) + b"\n\n" + new_message, removed


def publication_commands(remote_refs, rewritten, *, rename=False):
    """Сформировать прямую и обратную операции; ни одна команда здесь не выполняется."""
    if not remote_refs:
        raise ValueError("Команды публикации требуют непустого снимка удалённых ссылок")
    forward_leases, forward, rollback_leases, rollback = [], [], [], []
    targets = set()
    for ref, old_sha in remote_refs.items():
        trial_ref = ref.replace("refs/", "refs/remote-snapshot/", 1)
        new_sha = rewritten[trial_ref]
        target = ref
        if rename and ref.startswith("refs/heads/codex/"):
            proposed = BRANCH_NAMES.get(ref.removeprefix("refs/heads/codex/"))
            if not proposed:
                raise RuntimeError(f"Нужно предложение нейтрального названия: {ref}")
            target = "refs/heads/" + proposed
            if target in remote_refs:
                raise RuntimeError(f"Предлагаемое название уже занято: {target}")
        if target in targets:
            raise RuntimeError(f"Несколько веток используют одно новое имя: {target}")
        targets.add(target)
        forward_leases.append(f"--force-with-lease={ref}:{old_sha}")
        if target != ref:
            forward_leases.append(f"--force-with-lease={target}:")
            forward.extend([f"{new_sha}:{target}", f":{ref}"])
            rollback_leases.extend([f"--force-with-lease={ref}:", f"--force-with-lease={target}:{new_sha}"])
            rollback.extend([f"{old_sha}:{ref}", f":{target}"])
        else:
            forward.append(f"{new_sha}:{ref}")
            rollback_leases.append(f"--force-with-lease={ref}:{new_sha}")
            rollback.append(f"{old_sha}:{ref}")
    def command(leases, updates):
        return "git push --atomic " + " ".join(leases) + " $historyRemote " + " ".join(updates)
    return command(forward_leases, forward), command(rollback_leases, rollback)


def prepare_history(source, output, *, refresh_remote=False, titles=None,
                    strip_signatures=False, retain_invalid_signatures=False):
    """Создать новую изолированную репетицию; исходные и удалённые refs не изменяются."""
    if strip_signatures and retain_invalid_signatures:
        raise ValueError("Режимы удаления и сохранения старых подписей несовместимы")
    signature_mode = "strip" if strip_signatures else "retain" if retain_invalid_signatures else "reject"
    source, output = Path(source).resolve(), Path(output).resolve()
    allowed = (source / ".maintenance").resolve()
    if not output.is_relative_to(allowed) or output == allowed or output.exists():
        raise ValueError("Нужна новая отдельная папка внутри .maintenance; перезапись запрещена")
    output.mkdir(parents=True)
    original = refs(source)
    source_head = git(source, "rev-parse", "HEAD").decode().strip()
    inventory = {
        "utc": datetime.now(timezone.utc).isoformat(), "source": str(source),
        "source_head": source_head, "source_refs": original,
        "worktrees": git(source, "worktree", "list", "--porcelain").decode(),
        "remotes": git(source, "remote").decode().splitlines(),
    }
    mirror = output / "rehearsal.git"
    git(source, "clone", "--mirror", "--no-hardlinks", str(source), str(mirror))
    # У зеркала не должно быть направления случайной публикации в исходную рабочую копию.
    git(mirror, "config", "--remove-section", "remote.origin")
    remote_refs = {}
    if refresh_remote:
        remote_url = git(source, "remote", "get-url", "origin").decode().strip()
        listing = git(source, "ls-remote", "--heads", "--tags", remote_url).decode()
        remote_refs = {ref: sha for sha, ref in (line.split() for line in listing.splitlines())
                       if not ref.endswith("^{}")}
        git(mirror, "fetch", "--no-tags", remote_url,
            "+refs/heads/*:refs/remote-snapshot/heads/*",
            "+refs/tags/*:refs/remote-snapshot/tags/*")
        for ref, sha in remote_refs.items():
            trial_ref = ref.replace("refs/", "refs/remote-snapshot/", 1)
            if git(mirror, "rev-parse", trial_ref).decode().strip() != sha:
                raise RuntimeError("Удалённая ссылка изменилась во время снимка; повторите в новой папке")
        final_listing = git(source, "ls-remote", "--heads", "--tags", remote_url).decode()
        if final_listing != listing:
            raise RuntimeError("Удалённые ссылки изменились во время загрузки; повторите в новой папке")
    inventory["remote_refs"] = remote_refs
    snapshot = refs(mirror)
    if any(snapshot.get(ref) != sha for ref, sha in original.items()):
        raise RuntimeError("Изолированное зеркало не содержит все исходные ссылки")
    inventory["snapshot_refs"] = snapshot
    bundle = output / "before.bundle"
    git(mirror, "bundle", "create", str(bundle), "--all")
    verify = git(mirror, "bundle", "verify", str(bundle)).decode()
    bundle_heads = {ref: sha for sha, ref in
                    (line.split() for line in git(mirror, "bundle", "list-heads", str(bundle)).decode().splitlines())}
    if any(bundle_heads.get(ref) != sha for ref, sha in snapshot.items()):
        raise RuntimeError("Резервная копия не содержит все исходные ссылки")
    inventory["backup"] = {"path": str(bundle), "sha256": hashlib.sha256(bundle.read_bytes()).hexdigest(),
                           "verified": True, "verification_stdout": verify}
    restored = output / "restore-check.git"
    git(source, "clone", "--mirror", str(bundle), str(restored))
    if any(refs(restored).get(ref) != sha for ref, sha in snapshot.items()):
        raise RuntimeError("Из резервной копии восстановлены не все ссылки")
    git(restored, "fsck", "--full", "--no-reflogs")
    inventory["backup"]["independent_restore_verified"] = True
    write_json(output / "refs.json", inventory)
    overrides = titles or {}
    mapping, rows, objects, signatures = {}, [], {}, []
    commits = git(mirror, "rev-list", "--all", "--topo-order", "--reverse").decode().splitlines()
    for sha in commits:
        raw = git(mirror, "cat-file", "commit", sha)
        fields, message = commit_fields(raw)
        signed = any(name in SIGNATURE_FIELDS for name, _ in fields)
        new_title = title(sha, message, overrides)
        new_raw, removed = rewrite_commit(raw, mapping, new_title, signature_mode=signature_mode)
        _, new_message = commit_fields(new_raw)
        new_sha = git(mirror, "hash-object", "-t", "commit", "-w", "--stdin", data=new_raw).decode().strip()
        mapping[sha] = new_sha
        if signed:
            signatures.append({"old": sha, "new": new_sha,
                               "removed_fields": removed,
                               "signature_header_preserved_bytes": signature_mode == "retain",
                               "status": "removed" if signature_mode == "strip" else "retained_invalid",
                               "publication_blocked_until_signature_decision": signature_mode == "retain"})
        objects[sha] = (raw, new_raw)
        rows.append({"old": sha, "new": new_sha, "old_message": message.decode("utf-8"), "new_message": new_message.decode("utf-8")})
    # Сначала проверить ВСЕ объекты, лишь затем передвигать ссылки пробного зеркала.
    for sha, new_sha in mapping.items():
        raw, expected = objects[sha]
        actual = git(mirror, "cat-file", "commit", new_sha)
        if actual != expected:
            raise RuntimeError(f"Побайтовая проверка не пройдена: {sha}")
        old_fields, _ = commit_fields(raw)
        new_fields, _ = commit_fields(actual)
        allowed_omissions = SIGNATURE_FIELDS if strip_signatures else frozenset()
        if ([value for name, value in old_fields if name != b"parent" and name not in allowed_omissions]
                != [value for name, value in new_fields if name != b"parent"]):
            raise RuntimeError(f"Изменены метаданные или дерево: {sha}")
        if ([mapping[value[7:].decode()] for name, value in old_fields if name == b"parent"]
                != [value[7:].decode() for name, value in new_fields if name == b"parent"]):
            raise RuntimeError(f"Изменена топология родителей: {sha}")
        if strip_signatures and any(name in SIGNATURE_FIELDS for name, _ in new_fields):
            raise RuntimeError(f"Старое поле подписи осталось в новом коммите: {sha}")
    tag_mapping = {}

    def map_object(sha):
        if sha in mapping:
            return mapping[sha]
        kind = git(mirror, "cat-file", "-t", sha).strip()
        if kind != b"tag":
            return sha
        if sha in tag_mapping:
            return tag_mapping[sha]
        raw = git(mirror, "cat-file", "tag", sha)
        if b"-----BEGIN PGP SIGNATURE-----" in raw or b"-----BEGIN SSH SIGNATURE-----" in raw:
            raise RuntimeError(f"Подписанный тег требует отдельного решения: {sha}")
        first, rest = raw.split(b"\n", 1)
        target = map_object(first.removeprefix(b"object ").decode())
        new_raw = b"object " + target.encode() + b"\n" + rest
        result = git(mirror, "hash-object", "-t", "tag", "-w", "--stdin", data=new_raw).decode().strip()
        if git(mirror, "cat-file", "tag", result) != new_raw:
            raise RuntimeError(f"Не пройдена проверка тега: {sha}")
        tag_mapping[sha] = result
        return result

    rewritten = {ref: map_object(sha) for ref, sha in snapshot.items()}
    commands = "start\n" + "".join(f"update {ref} {rewritten[ref]} {sha}\n" for ref, sha in snapshot.items()) + "prepare\ncommit\n"
    git(mirror, "update-ref", "--stdin", data=commands.encode())
    git(mirror, "fsck", "--full", "--no-reflogs")
    if refs(mirror) != rewritten:
        raise RuntimeError("Ссылки зеркала не соответствуют проверенному mapping")
    if set(git(mirror, "rev-list", "--all").decode().splitlines()) != set(mapping.values()):
        raise RuntimeError("Достижимая история зеркала не соответствует полному mapping")
    if refs(source) != original or git(source, "rev-parse", "HEAD").decode().strip() != source_head:
        raise RuntimeError("Исходные ссылки изменились параллельно; снимок требует обновления")
    write_json(output / "mapping.json", rows)
    write_json(output / "rewritten-refs.json", rewritten)
    write_json(output / "tag-mapping.json", tag_mapping)
    write_json(output / "signatures.json", signatures)
    branches = []
    for ref, sha in snapshot.items():
        if not (ref.startswith("refs/heads/") or ref.startswith("refs/remote-snapshot/heads/")):
            continue
        branches.append({"ref": ref, "sha": sha, "unique_vs_main": int(git(
            mirror, "rev-list", "--count", sha, "^" + source_head).decode()),
            "new_sha": rewritten[ref],
            "proposed_name": BRANCH_NAMES.get(ref.split("/codex/")[-1])})
    write_json(output / "branches.json", branches)
    table = ["| старый SHA | старое название | новое название | новый SHA |", "|---|---|---|---|"]
    for row in rows:
        old = row["old_message"].strip().replace("|", "\\|").replace("\n", "<br>")
        table.append(f"| {row['old']} | {old} | {row['new_message'].strip()} | {row['new']} |")
    (output / "messages.md").write_text("\n".join(table) + "\n", encoding="utf-8")
    command_header = ("# Подготовлено для рассмотрения владельцем; НЕ ВЫПОЛНЕНО.\n"
                      "# Перед прямой операцией приостановить workflow и сверить refs.json.\n"
                      "# Перед обратной операцией сохранить новую работу и импортировать before.bundle.\n"
                      "if ([string]::IsNullOrWhiteSpace($historyRemote)) { throw 'Нужен проверенный адрес historyRemote' }\n")
    if remote_refs:
        for rename, prefix in ((False, ""), (True, "rename-")):
            forward, backward = publication_commands(remote_refs, rewritten, rename=rename)
            (output / f"{prefix}lease-commands.ps1").write_text(command_header + forward + "\n", encoding="utf-8")
            (output / f"{prefix}rollback-commands.ps1").write_text(command_header + backward + "\n", encoding="utf-8")
    removed_count = sum(len(item["removed_fields"]) for item in signatures)
    remaining = sum(name in SIGNATURE_FIELDS for _, new_raw in objects.values()
                    for name, _ in commit_fields(new_raw)[0])
    verification = {
        "commits": len(mapping), "tags": len(tag_mapping), "refs": len(snapshot),
        "all_trees_identical": True, "all_nonparent_headers_identical_bytes": removed_count == 0,
        "all_nonparent_nonsignature_headers_identical_bytes": True,
        "ordered_parent_topology_verified": True, "all_original_refs_in_bundle": True,
        "source_refs_unchanged": True, "remote_mutations": 0,
        "signature_mode": signature_mode, "removed_signature_fields": removed_count,
        "signed_commits_stripped": len(signatures) if strip_signatures else 0,
        "signature_headers_remaining": remaining, "no_signature_headers_remaining": remaining == 0,
        "signed_commits_invalidated": len(signatures) if retain_invalid_signatures else 0,
        "publication_blocked_until_signature_decision": bool(signatures) and retain_invalid_signatures,
        "publication_requires_owner_confirmation": True,
        "backup_sha256": inventory["backup"]["sha256"],
    }
    write_json(output / "verification.json", verification)
    local_plan = []
    for ref, sha in original.items():
        target = ref
        if ref.startswith("refs/heads/codex/"):
            proposed = BRANCH_NAMES.get(ref.removeprefix("refs/heads/codex/"))
            if proposed:
                target = "refs/heads/" + proposed
        elif ref.startswith("refs/remotes/") and "/codex/" in ref:
            remote_prefix, branch = ref.split("/codex/", 1)
            if branch in BRANCH_NAMES:
                target = remote_prefix + "/" + BRANCH_NAMES[branch]
        local_plan.append({"source_ref": ref, "expected_old": sha, "target_ref": target,
                           "new_sha": rewritten[ref]})
    write_json(output / "local-ref-plan.json", local_plan)
    operation_table = ["| исходная ссылка | исходный SHA | новая ссылка | новый SHA |", "|---|---|---|---|"]
    for ref, sha in remote_refs.items():
        target = "refs/heads/" + BRANCH_NAMES[ref.removeprefix("refs/heads/codex/")] if ref.startswith("refs/heads/codex/") else ref
        operation_table.append(f"| {ref} | {sha} | {target} | {rewritten[ref.replace('refs/', 'refs/remote-snapshot/', 1)]} |")
    signature_note = (f"Удалено полей подписей: {removed_count}; затронуто подписанных коммитов: {verification['signed_commits_stripped']}.\n"
                      "Разрешены только полные поля gpgsig/gpgsig-sha256. Подписанные оригиналы остаются в before.bundle.\n"
                      if strip_signatures else
                      f"Режим подписей: {signature_mode}. Сохранённых полей: {remaining}. При retain подписи недействительны;\n"
                      "публикация запрещена до отдельного решения. Для текущего направления используйте --strip-signatures.\n")
    (output / "operation.md").write_text(
        "# Подготовленная операция истории\n\n"
        "Операция не выполнена. Требуется отдельное подтверждение владельца перед force-push.\n"
        f"Папка операции: `{output}`.\n"
        f"Снимок: {inventory['utc']}; исходный HEAD: {source_head}.\n"
        f"Коммитов: {len(mapping)}; refs: {len(snapshot)}; тегов: {len(tag_mapping)}; удалённых heads/tags: {len(remote_refs)}.\n\n"
        "Резервная копия: before.bundle; проверены bundle verify, независимое восстановление и fsck.\n"
        f"SHA-256: `{inventory['backup']['sha256']}`.\n\n"
        + signature_note + "\n"
        "Деревья файлов, авторы/коммитеры/даты и прочие поля совпадают побайтно. Порядок родителей сохранён по mapping.\n"
        "Сообщения: messages.md; mapping: mapping.json; удалённые поля: signatures.json; проверки: verification.json.\n"
        "Все исходные локальные и вспомогательные refs включены в bundle и rewritten-refs.json.\n\n"
        "## Порядок исполнения после подтверждения\n\n"
        "1. Проверить фактическое состояние операции после любого прерывания; не повторять push/rollback вслепую.\n"
        "2. Приостановить osm-data workflow; дождаться завершения или явно отменить все старые running/queued runs,\n"
        "   исключить ручные запуски до возобновления. Повторно сверить все remote heads/tags с refs.json.\n"
        "3. Любое расхождение, занятое archive-имя, новая рабочая копия или незаписанная работа — остановка и новая подготовка.\n"
        "4. Из rehearsal.git задать проверенный публичный адрес historyRemote без credentials. Для варианта archive\n"
        "   рассмотреть rename-lease-commands.ps1: одна atomic операция, точные leases и отсутствие новых имён.\n"
        "   Отказ lease/atomic/защиты веток не обходить ослаблением условий. Все codex tips сохраняются в archive.\n"
        "5. Сверить полученные remote refs с ожидаемыми SHA. Обновить локальные heads, origin/*, auxiliary commit refs\n"
        "   и связанные worktrees по local-ref-plan.json/rewritten-refs.json, с проверкой ожидаемых старых SHA.\n"
        "   Различающиеся локальный и удалённый tips не подменять друг другом; текущие файлы сохранить.\n"
        "6. Возобновить workflow уже с новой main. Проверить первый новый data-коммит (сообщение уже\n"
        "   «ежедневные данные города»), отсутствие старых родителей, CI, Render и публичный сайт.\n\n"
        "## Восстановление\n\n"
        "Сначала сохранить любую новую работу, сверить текущее состояние и SHA копии. Восстановить bundle\n"
        "в отдельную папку и проверить refs.json. Для archive использовать rename-rollback-commands.ps1:\n"
        "старые имена защищены ожидаемым отсутствием, новые — конкретными SHA. Если появилась новая работа,\n"
        "остановиться; не заменять leases и не стирать её. Вариант без переноса имён имеет свои lease/rollback файлы.\n\n"
        + "\n".join(operation_table)
        + "\n\nВнешние клоны, кэши, PR refs и reflog не входят в гарантированную область очистки.\n",
        encoding="utf-8")
    if hashlib.sha256(bundle.read_bytes()).hexdigest() != inventory["backup"]["sha256"]:
        raise RuntimeError("Контрольная сумма резервной копии изменилась")
    return {"output": str(output), "commits": len(mapping), "refs": len(snapshot),
            "removed_signature_fields": removed_count,
            "signed_commits_stripped": verification["signed_commits_stripped"],
            "backup_sha256": inventory["backup"]["sha256"]}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, help="Новая папка внутри .maintenance")
    parser.add_argument("--refresh-remote", action="store_true",
                        help="Считать удалённые головы и теги только в отдельное зеркало")
    parser.add_argument("--titles", type=Path, help="Дополнительный JSON: полный старый SHA и новое название")
    signatures = parser.add_mutually_exclusive_group()
    signatures.add_argument("--strip-signatures", action="store_true",
                            help="Удалить полные поля gpgsig/gpgsig-sha256; подписанные оригиналы остаются в копии")
    signatures.add_argument("--retain-invalid-signatures-for-rehearsal", action="store_true",
                            help="Исторический режим пробы: сохранить недействительные подписи; не для публикации")
    args = parser.parse_args(argv)
    overrides = json.loads(args.titles.read_text(encoding="utf-8")) if args.titles else {}
    result = prepare_history(Path(__file__).resolve().parents[1], args.output,
                             refresh_remote=args.refresh_remote, titles=overrides,
                             strip_signatures=args.strip_signatures,
                             retain_invalid_signatures=args.retain_invalid_signatures_for_rehearsal)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
