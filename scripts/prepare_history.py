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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, help="Новая папка внутри .maintenance")
    parser.add_argument("--refresh-remote", action="store_true",
                        help="Считать удалённые головы и теги только в отдельное зеркало")
    parser.add_argument("--titles", type=Path, help="Дополнительный JSON: полный старый SHA → название")
    parser.add_argument("--retain-invalid-signatures-for-rehearsal", action="store_true",
                        help="Только проба: сохранить байты подписи с явной отметкой её недействительности")
    args = parser.parse_args()
    source = Path(__file__).resolve().parents[1]
    output = Path(args.output).resolve()
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
    if args.refresh_remote:
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
    overrides = json.loads(args.titles.read_text(encoding="utf-8")) if args.titles else {}
    mapping, rows, objects, signatures = {}, [], {}, []
    commits = git(mirror, "rev-list", "--all", "--topo-order", "--reverse").decode().splitlines()
    for sha in commits:
        raw = git(mirror, "cat-file", "commit", sha)
        header, message = raw.split(b"\n\n", 1)
        signed = any(line.startswith((b"gpgsig ", b"gpgsig-sha256 ", b"mergetag ")) for line in header.splitlines())
        if signed and not args.retain_invalid_signatures_for_rehearsal:
            raise RuntimeError(f"Подписанный объект требует отдельного решения владельца: {sha}")
        new_title = title(sha, message, overrides)
        changed_header = b"\n".join(b"parent " + mapping[line[7:].decode()].encode()
                                    if line.startswith(b"parent ") else line
                                    for line in header.split(b"\n"))
        # Не менять уже корректное сообщение, включая завершающий перевод строки.
        new_message = message if message.decode("utf-8").strip() == new_title else (new_title + "\n").encode()
        new_raw = changed_header + b"\n\n" + new_message
        new_sha = git(mirror, "hash-object", "-t", "commit", "-w", "--stdin", data=new_raw).decode().strip()
        mapping[sha] = new_sha
        if signed:
            signatures.append({"old": sha, "new": new_sha,
                               "signature_header_preserved_bytes": True,
                               "status": "invalidated_by_message_change",
                               "publication_blocked": True})
        objects[sha] = (raw, new_raw)
        rows.append({"old": sha, "new": new_sha, "old_message": message.decode("utf-8"), "new_message": new_message.decode("utf-8")})
    # Сначала проверить ВСЕ объекты, лишь затем передвигать ссылки пробного зеркала.
    for sha, new_sha in mapping.items():
        raw, expected = objects[sha]
        actual = git(mirror, "cat-file", "commit", new_sha)
        if actual != expected:
            raise RuntimeError(f"Побайтовая проверка не пройдена: {sha}")
        old_header = raw.split(b"\n\n", 1)[0].split(b"\n")
        new_header = actual.split(b"\n\n", 1)[0].split(b"\n")
        if [x for x in old_header if not x.startswith(b"parent ")] != [x for x in new_header if not x.startswith(b"parent ")]:
            raise RuntimeError(f"Изменены метаданные или дерево: {sha}")
        if [mapping[x[7:].decode()] for x in old_header if x.startswith(b"parent ")] != [x[7:].decode() for x in new_header if x.startswith(b"parent ")]:
            raise RuntimeError(f"Изменена топология родителей: {sha}")
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
    leases = ["# Подготовлено для рассмотрения владельцем; НЕ ВЫПОЛНЕНО.",
              "# Только из проверенного rehearsal.git; сначала приостановить workflow и сверить refs.json."]
    reverse = ["# Восстановление только после согласования; сначала импортировать before.bundle."]
    if remote_refs:
        lease_args, updates, rollback_args, rollback_updates = [], [], [], []
        rename_leases, rename_updates = [], []
        for ref, old_sha in remote_refs.items():
            trial_ref = ref.replace("refs/", "refs/remote-snapshot/", 1)
            new_sha = rewritten[trial_ref]
            lease_args.append(f"--force-with-lease={ref}:{old_sha}")
            updates.append(f"{new_sha}:{ref}")
            rollback_args.append(f"--force-with-lease={ref}:{new_sha}")
            rollback_updates.append(f"{old_sha}:{ref}")
            rename_leases.append(f"--force-with-lease={ref}:{old_sha}")
            if ref.startswith("refs/heads/codex/"):
                proposed = BRANCH_NAMES.get(ref.removeprefix("refs/heads/codex/"))
                if not proposed:
                    raise RuntimeError(f"Нужно предложение нейтрального названия: {ref}")
                target = "refs/heads/" + proposed
                if target in remote_refs:
                    raise RuntimeError(f"Предлагаемое название уже занято: {target}")
                rename_leases.append(f"--force-with-lease={target}:")
                rename_updates.extend([f"{new_sha}:{target}", f":{ref}"])
            else:
                rename_updates.append(f"{new_sha}:{ref}")
        # URL с credentials не включается в отчёты: использовать публичный origin, заданный вручную.
        leases.append("git push --atomic " + " ".join(lease_args) + " $historyRemote " + " ".join(updates))
        reverse.append("git push --atomic " + " ".join(rollback_args) + " $historyRemote " + " ".join(rollback_updates))
        (output / "rename-lease-commands.ps1").write_text(
            "# НЕ ВЫПОЛНЕНО. Удаляет старые имена codex/*: нужно отдельное подтверждение владельца.\n"
            "# Новые archive/* сохраняют всю работу; пустой lease запрещает перезапись существующей ветки.\n"
            "git push --atomic " + " ".join(rename_leases) + " $historyRemote " + " ".join(rename_updates) + "\n",
            encoding="utf-8")
    (output / "lease-commands.ps1").write_text("\n".join(leases) + "\n", encoding="utf-8")
    (output / "rollback-commands.ps1").write_text("\n".join(reverse) + "\n", encoding="utf-8")
    write_json(output / "verification.json", {
        "commits": len(mapping), "tags": len(tag_mapping), "refs": len(snapshot),
        "all_trees_identical": True, "all_nonparent_headers_identical_bytes": True,
        "ordered_parent_topology_verified": True, "all_original_refs_in_bundle": True,
        "source_refs_unchanged": True, "remote_mutations": 0,
        "signed_commits_invalidated": len(signatures),
        "publication_blocked_until_signature_decision": bool(signatures),
        "backup_sha256": inventory["backup"]["sha256"],
    })
    if hashlib.sha256(bundle.read_bytes()).hexdigest() != inventory["backup"]["sha256"]:
        raise RuntimeError("Контрольная сумма резервной копии изменилась")
    print(json.dumps({"output": str(output), "commits": len(mapping), "refs": len(snapshot),
                      "backup_sha256": inventory["backup"]["sha256"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
