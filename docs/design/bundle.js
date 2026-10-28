/* @ds-bundle: {"format":4,"namespace":"CatNotice","components":[{"name":"Icon"},{"name":"Button"},{"name":"ShareButton"},{"name":"FavoriteButton"},{"name":"StatusBadge"},{"name":"AnimalCard"},{"name":"Chip"},{"name":"Segmented"},{"name":"Radio"},{"name":"Select"},{"name":"BottomSheet"},{"name":"SkeletonCard"},{"name":"Toast"},{"name":"FilterButton"},{"name":"DetailInfo"},{"name":"Logo"},{"name":"DeadlineText"},{"name":"ShelterInfo"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var cx = function () { return Array.prototype.filter.call(arguments, Boolean).join(' '); };

  /* One place for the service name and tagline (code: shared/config/service.ts). Old name: 냥공고. */
  var SERVICE_NAME = '멍냥공고';
  var SERVICE_TAGLINE = '보호 중인 아이들의 공고가\n더 많은 사람에게 닿도록.';

  function Heart(p) {
    return h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', 'aria-hidden': true, fill: p.filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round' },
      h('path', { d: 'M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z' }));
  }
  function ChatIcon() {
    return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': true, fill: 'currentColor' },
      h('path', { d: 'M12 3.5c-5.2 0-9.3 3.3-9.3 7.4 0 2.6 1.7 4.9 4.3 6.2l-.9 3.3c-.1.3.2.5.5.4l3.9-2.6c.5.1 1 .1 1.5.1 5.2 0 9.3-3.3 9.3-7.4S17.200 3.500 12 3.500z' }));
  }
  function Chevron() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', 'aria-hidden': true, fill: 'none', stroke: 'var(--text-2)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: 'M6 9l6 6 6-6' }));
  }

  /* Stroke icons, 1.8px, currentColor. Names: heart, filter, close, back, chevron-down,
     map-pin, phone, image-off, info (lucide MapPin, Phone, ImageOff, Info in the app). Placeholders for lucide. */
  function Icon(p) {
    var s = p.size || 22, n = p.name;
    var P = function (d) { return h('path', { d: d }); };
    var body = n === 'heart' ? P('M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z')
      : n === 'filter' ? [P('M4 7h9'), P('M19 7h1'), h('circle', { cx: 16, cy: 7, r: 2.2 }), P('M4 17h1'), P('M11 17h9'), h('circle', { cx: 8, cy: 17, r: 2.2 })]
      : n === 'close' ? P('M6 6l12 12M18 6L6 18')
      : n === 'back' ? P('M15 5l-7 7 7 7')
      : n === 'chevron-down' ? P('M6 9l6 6 6-6')
      : n === 'chevron-right' ? P('M9 6l6 6-6 6')
      : n === 'map-pin' ? [P('M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0z'), h('circle', { cx: 12, cy: 10, r: 3 })]
      : n === 'phone' ? P('M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z')
      : n === 'info' ? [h('circle', { cx: 12, cy: 12, r: 9 }), P('M12 11v5'), P('M12 7.6v.2')]
      : n === 'share' ? [h('circle', { cx: 18, cy: 5, r: 3 }), h('circle', { cx: 6, cy: 12, r: 3 }), h('circle', { cx: 18, cy: 19, r: 3 }), P('M8.59 13.51l6.83 3.98'), P('M15.41 6.51l-6.82 3.98')]
      : n === 'link' ? [P('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'), P('M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71')]
      : n === 'image-off' ? [P('M2 2l20 20'), P('M10.4 4.8H19a2 2 0 0 1 2 2v8.6'), P('M21 21H5a2 2 0 0 1-2-2V5'), P('M3 16l5-5 3 3'), h('circle', { cx: 15.5, cy: 8.5, r: 1.5 })] : null;
    return h.apply(null, ['svg', { width: s, height: s, viewBox: '0 0 24 24', 'aria-hidden': true, fill: p.filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block', flex: 'none' } }].concat(body));
  }

  /* variant small-action: the small text button at the end of a row (C5). text-2 caption + 14px icon,
     44x44 hit area, the row height does not change. href renders a link (external: new tab). */
  function Button(p) {
    if (p.variant === 'small-action') {
      var Tag = p.href ? 'a' : 'button';
      var pr = { className: cx('cn-small-action caption', p.className), 'aria-label': p['aria-label'] || p.ariaLabel, onClick: p.onClick };
      if (p.href) { pr.href = p.href; if (p.external) { pr.target = '_blank'; pr.rel = 'noopener noreferrer'; } } else { pr.type = 'button'; pr.disabled = p.disabled; }
      return h(Tag, pr, p.icon ? h(Icon, { name: p.icon, size: 14 }) : null, p.children);
    }
    return h('button', { type: p.type || 'button', className: cx('cn-btn card-title', 'cn-btn--' + (p.variant || 'primary'), p.block && 'cn-btn--block', p.className), disabled: p.disabled, 'aria-label': p['aria-label'] || p.ariaLabel, onClick: p.onClick }, p.children);
  }
  /* Share actions in the detail CTA bar (2026-10-27, canvas board "상세 하단 바 · 다른 앱으로 공유", draft 2).
     Default: Kakao Yellow primary, takes the remaining width.
     variant 'other': the second share button, a white pill as wide as its content (14px label + 18px icon).
       canShare true (default): "다른 앱으로 공유" + share icon, opens the OS share sheet (Web Share).
       canShare false (share sheet unavailable, some desktop browsers): "링크 복사" + link icon; the caller copies the link and shows Toast "링크가 복사됐어요".
     The visible label is the accessible name. */
  function ShareButton(p) {
    if (p.variant === 'other') {
      var copy = p.canShare === false;
      return h('button', { type: 'button', className: cx('cn-btn cn-btn--share-other', p.className), disabled: p.disabled, onClick: p.onClick },
        h(Icon, { name: copy ? 'link' : 'share', size: 18 }), h('span', null, copy ? '링크 복사' : '다른 앱으로 공유'));
    }
    return h('button', { type: 'button', className: cx('cn-btn card-title cn-btn--share', p.className), disabled: p.disabled, onClick: p.onClick }, h(ChatIcon), p.children || '카카오톡 공유');
  }
  /* Favourite toggle. Default: 44x44 surface pill in the detail CTA bar.
     onPhoto: the card form (list and favourites), a 40px photo-pill circle inside a 44px hit area;
     the widget passes it into AnimalCard's action slot. calm (ended): fill only, no pop. */
  function FavoriteButton(p) {
    var on = !!p.active;
    var pop = React.useState(0), popKey = pop[0], setPop = pop[1];
    var label = on ? '관심 공고에서 빼기' : '관심 공고에 담기';
    var toggle = function () { var next = !on; if (p.onPhoto && next && !p.calm) setPop(popKey + 1); if (p.onToggle) p.onToggle(next); };
    if (!p.onPhoto) {
      return h('button', { type: 'button', className: cx('cn-btn cn-btn--fav', p.className), disabled: p.disabled, 'aria-pressed': on, 'aria-label': label, onClick: toggle }, h(Heart, { filled: on }));
    }
    var d = 'M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z';
    return h('button', { type: 'button', className: cx('cn-fav-photo', p.calm && 'cn-fav-photo--calm', p.className), 'data-on': on, 'aria-pressed': on, 'aria-label': label, disabled: p.disabled, onClick: toggle },
      h('span', { className: 'cn-fav-photo__circle' },
        h('svg', { key: 'h' + popKey, className: popKey > 0 && on && !p.calm ? 'cn-heart cn-heart--pop' : 'cn-heart', width: 22, height: 22, viewBox: '0 0 24 24', 'aria-hidden': true },
          h('path', { className: 'cn-heart__fill', d: d, fill: 'currentColor' }),
          h('path', { d: d, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round' }))));
  }

  /* variant: protected | nearDeadline | ended (code getStatusVariant). nearDeadline = protected with the deadline D-3 or less:
     same words, only the colour changes (no 임박). dDay: number | undefined. result: the API's ended result as written.
     context 'card' (default): "보호중 · 마감 D-N" / "보호중 · 오늘 마감". context 'detail': the badge shows the state only ("보호중");
     the deadline goes next to it as DeadlineText. Ended: "종료 · <결과>", or "종료" without one. */
  function cardDeadlineText(dDay) { return dDay === 0 ? '오늘 마감' : (typeof dDay === 'number' ? '마감 D-' + dDay : ''); }
  function detailDeadlineText(dDay) { return dDay === 0 ? '오늘 마감' : (typeof dDay === 'number' ? '공고 마감 D-' + dDay : ''); }
  function badgeText(variant, dDay, result, context) {
    if (variant === 'ended') return result ? '종료 · ' + result : '종료';
    if (context === 'detail') return '보호중';
    var d = cardDeadlineText(dDay);
    return '보호중' + (d ? ' · ' + d : '');
  }
  var kebab = function (v) { return v === 'nearDeadline' ? 'near-deadline' : v; };
  function StatusBadge(p) {
    return h('span', { className: cx('cn-badge badge', 'cn-badge--' + kebab(p.variant), p.onPhoto && 'cn-badge--photo', p.className) }, h('i'), badgeText(p.variant, p.dDay, p.result, p.context));
  }
  /* Detail: the deadline next to the badge, large (title), in the status text colour. Nothing for ended notices. */
  function DeadlineText(p) {
    if (p.variant === 'ended') return null;
    var t = detailDeadlineText(p.dDay);
    return t ? h('span', { className: cx('cn-deadline title', 'cn-deadline--' + kebab(p.variant), p.className) }, t) : null;
  }
  /* Domain to badge variant. protected within 3 days is nearDeadline. */
  function badgeVariant(a) { return a.status === 'ended' ? 'ended' : (a.dDay <= 3 ? 'nearDeadline' : 'protected'); }
  var SEX = { female: '암컷', male: '수컷' };
  /* "암컷 · 2026년생 · 60일 미만"; unknown parts read "성별 미상" / "나이 미상". */
  function sexAgeText(a) { return (SEX[a.sex] || '성별 미상') + ' · ' + (a.ageText || '나이 미상'); }

  /* animal: Domain model only. { id, region, shelterName, foundPlace, noticeNo, status, dDay, result?, images[] }. The Domain has no name.
     Lines: title = region (other species: "<동물> · <지역>", card-title) / shelter name, or the found place without one (body, text-2) /
     "공고 번호 <번호>" (caption, text-2, one line, left out when empty).
     action: optional ReactNode for the photo's top-right; the widget passes FavoriteButton onPhoto
     (entities do not know features). It is a sibling of the card link, never nested in it. */
  function AnimalCard(p) {
    var a = p.animal, ended = a.status === 'ended';
    var v = badgeVariant(a);
    var Tag = p.href ? 'a' : 'button';
    var props = { className: 'cn-card__link', onClick: p.onClick };
    if (p.href) props.href = p.href; else props.type = 'button';
    return h('div', { className: cx('cn-card', ended && 'cn-card--ended', p.className) },
      h(Tag, props,
        h('div', { className: 'cn-card__photo' },
          a.images && a.images[0] ? h('img', { src: a.images[0], alt: '', loading: p.priority ? 'eager' : 'lazy' }) : null,
          h('div', { className: 'cn-card__badge' }, h(StatusBadge, { variant: v, dDay: ended ? undefined : a.dDay, result: a.result, onPhoto: true }))),
        h('div', { className: 'cn-card__text' },
          h('p', { className: 'cn-card__name card-title' }, a.title || a.region),
          h('p', { className: 'cn-card__sub body' }, a.shelterName || a.foundPlace),
          a.noticeNo ? h('p', { className: 'cn-card__no caption', 'data-slot': 'notice-no' }, '공고 번호 ' + a.noticeNo) : null)),
      p.action ? h('div', { className: 'cn-card__action' }, p.action) : null);
  }

  /* List header filter button. sexLabel (암컷 / 수컷) when a sex is chosen: filled like a selected Chip,
     accessible name "필터, 암컷". Other conditions are not shown. */
  function FilterButton(p) {
    var on = !!p.sexLabel;
    return h('button', { type: 'button', className: cx('cn-chip cn-chip--filter body', p.className), 'aria-pressed': on, 'aria-label': on ? '필터, ' + p.sexLabel : '필터', onClick: p.onClick },
      h(Icon, { name: 'filter', size: 16 }), '필터');
  }

  function Chip(p) {
    return h('button', { type: 'button', className: cx('cn-chip body', p.className), 'aria-pressed': !!p.selected, disabled: p.disabled, onClick: p.onClick }, p.children);
  }
  function Segmented(p) {
    return h('div', { className: cx('cn-seg body', p.className), role: 'radiogroup', 'aria-label': p.label },
      p.options.map(function (o) {
        return h('button', { key: o.value, type: 'button', role: 'radio', 'aria-checked': p.value === o.value, disabled: p.disabled, onClick: function () { p.onChange && p.onChange(o.value); } }, o.label);
      }));
  }
  function Radio(p) {
    return h('button', { type: 'button', role: 'radio', 'aria-checked': !!p.checked, disabled: p.disabled, className: cx('cn-radio body', p.className), onClick: p.onChange }, h('i'), p.children);
  }
  function Select(p) {
    return h('label', { className: cx('cn-select body', p.className) },
      h('select', { value: p.value, disabled: p.disabled, 'aria-label': p.label, onChange: function (e) { p.onChange && p.onChange(e.target.value); } },
        p.options.map(function (o) { return h('option', { key: o.value, value: o.value }, o.label); })),
      h(Chevron));
  }

  /* Absolute inside .cn-column (position:relative), never fixed to the viewport.
     With footer (filter sheet): head (handle + title), body (scrolls), fixed footer with shadow-bar on top.
     Without footer (shelter info sheet, C6): handle + title + content, no fixed bottom area.
     Max height min(85%, 85svh). Close: dim tap, handle tap, Esc. No drag-to-close. */
  function BottomSheet(p) {
    React.useEffect(function () {
      if (!p.open || !p.onClose) return undefined;
      var k = function (e) { if (e.key === 'Escape') p.onClose(); };
      document.addEventListener('keydown', k);
      return function () { document.removeEventListener('keydown', k); };
    }, [p.open, p.onClose]);
    return h('div', { className: cx('cn-sheet-wrap', !p.footer && 'cn-sheet-wrap--nofoot'), 'data-open': !!p.open },
      h('div', { className: 'cn-sheet-dim', onClick: p.onClose }),
      h('div', { className: 'cn-sheet', role: 'dialog', 'aria-modal': true, 'aria-label': p.title, 'aria-hidden': !p.open },
        h('div', { className: 'cn-sheet__head' },
          h('button', { type: 'button', className: 'cn-sheet__handle-hit', 'aria-label': '닫기', onClick: p.onClose }, h('div', { className: 'cn-sheet__handle' })),
          p.title ? h('h2', { className: 'cn-sheet__title card-title' }, p.title) : null),
        h('div', { className: 'cn-sheet__body' }, p.children),
        p.footer ? h('div', { className: 'cn-sheet__foot' }, p.footer) : null));
  }

  /* Detail info rows (widgets/animal-detail in the app). Order: 발견 장소 → 보호소 → 공고 번호 → 공고 기간 → 종료 사유 → 특이사항;
     empty values are left out. 주소 / 전화 are not here: they are in the shelter info sheet (ShelterInfo).
     The 보호소 row ends in [보호소 정보] (small-action, info icon) unless the notice is ended or has neither address nor phone.
     Ended: 종료 사유 shown, 특이사항 dropped when it equals 종료 사유. The person in charge is never shown. */
  function detailRows(a) {
    var ended = a.status === 'ended';
    var hasContact = !!(a.address || a.phone);
    var rows = [
      ['발견 장소', a.foundPlace],
      ['보호소', a.shelterName, !ended && hasContact && { kind: 'shelter-info', icon: 'info', label: '보호소 정보', aria: '보호소 정보 보기' }],
      ['공고 번호', a.noticeNo],
      ['공고 기간', a.noticePeriod],
      ended && ['종료 사유', a.endReason],
      ['특이사항', ended && a.endReason && a.notes === a.endReason ? null : a.notes]
    ];
    return rows.filter(function (r) { return r && r[1]; });
  }
  /* Shelter info sheet rows: 주소 <주소> [지도] → 전화 <번호> [전화]. Empty rows are left out;
     a phone without digits keeps its row but drops [전화]. [지도] opens a map search in a new tab, [전화] is tel:. */
  function shelterRows(a) {
    var digits = (a.phone || '').replace(/\D/g, '');
    return [
      ['주소', a.address, a.address && { icon: 'map-pin', label: '지도', aria: '지도에서 주소 보기(새 탭)', href: 'https://map.kakao.com/?q=' + encodeURIComponent(a.address), external: true }],
      ['전화', a.phone, digits && { icon: 'phone', label: '전화', aria: '보호소에 전화', href: 'tel:' + digits }]
    ].filter(function (r) { return r[1]; });
  }
  function InfoList(rows, onAction, className) {
    return h('dl', { className: cx('cn-info', className) }, rows.map(function (r) {
      var act = r[2];
      return h('div', { key: r[0], className: cx('cn-info__row', act && 'cn-info__row--action') },
        h('dt', { className: 'body' }, r[0]),
        h('dd', { className: 'body' }, h('span', { className: 'cn-info__val' }, r[1]),
          act ? h(Button, { variant: 'small-action', icon: act.icon, href: act.href, external: act.external, 'aria-label': act.aria,
            onClick: act.kind === 'shelter-info' ? onAction : undefined }, act.label) : null));
    }));
  }
  function DetailInfo(p) { return InfoList(detailRows(p.animal), p.onShelterInfo, p.className); }
  /* Content of the shelter info sheet. Put it in a BottomSheet without footer, titled with the shelter name. */
  function ShelterInfo(p) { return InfoList(shelterRows(p.animal), null, cx('cn-info--sheet', p.className)); }

  /* 멍냥공고 logo (2026-10-26). Symbol C "나란히 두 얼굴": cream faces (bg) with #3A2A20 line, 48 grid.
     variant: 'line' (no tile, 56px and up only) | 'tile' (peach tile, 32–48px) | 'tile-small' (thicker line, 24px and below).
     Without variant the size picks it. 'line' below 56px falls back to the tile variant for that size.
     lockup: true adds the wordmark 멍냥공고 (Jua display-logo 20/28, text) to the right.
     Accessible names come from SERVICE_NAME. The wordmark glyphs are a fixed string here; in the app the lockup is an outlined SVG. */
  var LOGO_LINE = "<path d=\"M38.4 17.2C43.6 15.4 47.4 18.6 47.4 25.4C47.4 31.8 45.6 36 43 35.6C40.6 35.2 40 30.8 39.4 26.6C39 23.4 38.8 20 38.4 17.2Z\" fill=\"#FFF8EE\" stroke=\"#3A2A20\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/><path d=\"M21 27.4C21 20.2 26.2 16 32.6 16C39 16 44.2 20.2 44.2 27.4C44.2 34.4 39 39.2 32.6 39.2C26.2 39.2 21 34.4 21 27.4Z\" fill=\"#FFF8EE\" stroke=\"#3A2A20\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/><circle cx=\"29.8\" cy=\"26.2\" r=\"1.7\" fill=\"#3A2A20\"/><circle cx=\"37\" cy=\"26.2\" r=\"1.7\" fill=\"#3A2A20\"/><path d=\"M31.2 30Q33.6 28.9 36 30Q35.6 32.6 33.6 32.6Q31.6 32.6 31.2 30Z\" fill=\"#3A2A20\"/><path d=\"M3.8 30.4C3.2 26.6 3.4 23 4.6 20L5 12.4Q5.3 10.4 7 11.6L12 16.8Q15.2 16 18.8 16.8L23.8 11.6Q25.5 10.4 25.8 12.4L26.2 20C27.4 23 27.6 26.6 27 30.4C26 36.4 21.2 40 15.4 40C9.6 40 4.8 36.4 3.8 30.4Z\" fill=\"#FFF8EE\" stroke=\"#3A2A20\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/><circle cx=\"11\" cy=\"28\" r=\"1.7\" fill=\"#3A2A20\"/><circle cx=\"19.8\" cy=\"28\" r=\"1.7\" fill=\"#3A2A20\"/><path d=\"M13.8 31.2Q15.4 30.6 17 31.2Q16.4 33 15.4 33Q14.4 33 13.8 31.2Z\" fill=\"#3A2A20\"/>";
  var LOGO_SMALL = "<path d=\"M38.4 17.2C43.6 15.4 47.4 18.6 47.4 25.4C47.4 31.8 45.6 36 43 35.6C40.6 35.2 40 30.8 39.4 26.6C39 23.4 38.8 20 38.4 17.2Z\" fill=\"#FFF8EE\" stroke=\"#3A2A20\" stroke-width=\"2.8\" stroke-linejoin=\"round\"/><path d=\"M21 27.4C21 20.2 26.2 16 32.6 16C39 16 44.2 20.2 44.2 27.4C44.2 34.4 39 39.2 32.6 39.2C26.2 39.2 21 34.4 21 27.4Z\" fill=\"#FFF8EE\" stroke=\"#3A2A20\" stroke-width=\"2.8\" stroke-linejoin=\"round\"/><circle cx=\"29.8\" cy=\"26.2\" r=\"2.3\" fill=\"#3A2A20\"/><circle cx=\"37\" cy=\"26.2\" r=\"2.3\" fill=\"#3A2A20\"/><path d=\"M31.2 30Q33.6 28.9 36 30Q35.6 32.6 33.6 32.6Q31.6 32.6 31.2 30Z\" fill=\"#3A2A20\"/><path d=\"M3.8 30.4C3.2 26.6 3.4 23 4.6 20L5 12.4Q5.3 10.4 7 11.6L12 16.8Q15.2 16 18.8 16.8L23.8 11.6Q25.5 10.4 25.8 12.4L26.2 20C27.4 23 27.6 26.6 27 30.4C26 36.4 21.2 40 15.4 40C9.6 40 4.8 36.4 3.8 30.4Z\" fill=\"#FFF8EE\" stroke=\"#3A2A20\" stroke-width=\"2.8\" stroke-linejoin=\"round\"/><circle cx=\"11\" cy=\"28\" r=\"2.3\" fill=\"#3A2A20\"/><circle cx=\"19.8\" cy=\"28\" r=\"2.3\" fill=\"#3A2A20\"/><path d=\"M13.8 31.2Q15.4 30.6 17 31.2Q16.4 33 15.4 33Q14.4 33 13.8 31.2Z\" fill=\"#3A2A20\"/>";
  function logoVariant(size, v) {
    var auto = size <= 24 ? 'tile-small' : (size < 56 ? 'tile' : 'line');
    if (!v) return auto;
    if (v === 'line' && size < 56) return auto;
    return v;
  }
  function Logo(p) {
    var size = p.size || 48;
    var v = logoVariant(size, p.variant);
    var gid = 'cnlogo' + String(React.useId()).replace(/[^a-zA-Z0-9]/g, '');
    var label = p.lockup ? undefined : (p.label || SERVICE_NAME);
    var svgProps = { viewBox: '0 0 48 48', width: size, height: size, style: { display: 'block', flex: 'none' } };
    if (p.lockup || p.decorative) svgProps['aria-hidden'] = true; else { svgProps.role = 'img'; svgProps['aria-label'] = label; }
    var mark;
    if (v === 'line') {
      mark = h('svg', svgProps, h('g', { dangerouslySetInnerHTML: { __html: LOGO_LINE } }));
    } else {
      var small = v === 'tile-small', pad = small ? 0.03 : 0.08, k = 1 - 2 * pad, off = 48 * pad;
      mark = h('svg', svgProps,
        h('defs', null, h('linearGradient', { id: gid, x1: 0, y1: 0, x2: 1, y2: 1 },
          h('stop', { offset: 0, style: { stopColor: 'var(--apply-from)' } }), h('stop', { offset: 1, style: { stopColor: 'var(--apply-to)' } }))),
        h('rect', { width: 48, height: 48, rx: small ? 9 : 10.5, fill: 'url(#' + gid + ')' }),
        h('g', { transform: 'translate(' + off + ' ' + off + ') scale(' + k + ')', dangerouslySetInnerHTML: { __html: small ? LOGO_SMALL : LOGO_LINE } }));
    }
    if (!p.lockup) return h('span', { className: cx('cn-logo', p.className), 'data-variant': v }, mark);
    return h('span', { className: cx('cn-logo cn-logo--lockup', p.className), 'data-variant': v, role: 'img', 'aria-label': p.label || SERVICE_NAME, style: { gap: v === 'line' ? 10 : 8 } },
      mark, h('span', { className: 'cn-logo__word display-logo', 'aria-hidden': true }, '멍냥공고'));
  }

  function SkeletonCard(p) {
    return h('div', { className: cx('cn-skel', p.className), 'aria-hidden': true },
      h('div', { className: 'cn-skel__photo' }),
      h('div', { className: 'cn-skel__lines' }, h('div', { className: 'cn-skel__line' }), h('div', { className: 'cn-skel__line' }), h('div', { className: 'cn-skel__line' })));
  }
  function Toast(p) {
    return h('div', { className: 'cn-toast body', 'data-visible': !!p.visible, role: 'status', 'aria-live': 'polite' }, h('span', null, p.message));
  }

  /* Placeholder cat-ish photos with different aspect ratios, for mocks only. */
  function mockPhoto(i, w, hgt) {
    var pal = [['#F3D9B8', '#C98F5A', '#7A4B2A'], ['#EAD7C6', '#B9B0A6', '#4C4640'], ['#F6E3C4', '#E0A85E', '#8A5A22'], ['#DCE3D4', '#8D9A82', '#3F4A38'], ['#F2D6C9', '#D9A088', '#6E3B2C'], ['#E6DCCB', '#A69076', '#54432F'], ['#F7E8CF', '#D8B27A', '#6A5230'], ['#D9D3CC', '#8C857D', '#39352F']][i % 8];
    w = w || 800; hgt = hgt || 1000;
    var cx0 = w / 2, cy = hgt * 0.5, r = Math.min(w, hgt) * 0.26;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + hgt + '" viewBox="0 0 ' + w + ' ' + hgt + '">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + pal[0] + '"/><stop offset="1" stop-color="#FBF3E6"/></linearGradient></defs>' +
      '<rect width="100%" height="100%" fill="url(#g)"/>' +
      '<polygon points="' + (cx0 - r) + ',' + (cy - r * .2) + ' ' + (cx0 - r * .95) + ',' + (cy - r * 1.35) + ' ' + (cx0 - r * .25) + ',' + (cy - r * .85) + '" fill="' + pal[1] + '"/>' +
      '<polygon points="' + (cx0 + r) + ',' + (cy - r * .2) + ' ' + (cx0 + r * .95) + ',' + (cy - r * 1.35) + ' ' + (cx0 + r * .25) + ',' + (cy - r * .85) + '" fill="' + pal[1] + '"/>' +
      '<ellipse cx="' + cx0 + '" cy="' + (cy + r * .1) + '" rx="' + r * 1.1 + '" ry="' + r + '" fill="' + pal[1] + '"/>' +
      '<ellipse cx="' + cx0 + '" cy="' + (cy + r * .45) + '" rx="' + r * .55 + '" ry="' + r * .4 + '" fill="#FBF3E6" opacity=".8"/>' +
      '<ellipse cx="' + (cx0 - r * .42) + '" cy="' + (cy - r * .1) + '" rx="' + r * .11 + '" ry="' + r * .16 + '" fill="' + pal[2] + '"/>' +
      '<ellipse cx="' + (cx0 + r * .42) + '" cy="' + (cy - r * .1) + '" rx="' + r * .11 + '" ry="' + r * .16 + '" fill="' + pal[2] + '"/>' +
      '<polygon points="' + (cx0 - r * .1) + ',' + (cy + r * .25) + ' ' + (cx0 + r * .1) + ',' + (cy + r * .25) + ' ' + cx0 + ',' + (cy + r * .36) + '" fill="' + pal[2] + '"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* Domain-shaped mock data. Not DTOs. Every value is invented (region "가나시 다라구", notice number "가나-가나-2026-00001" style). */
  var MOCK_ANIMALS = [
    { id: 'a1', region: '가나시 다라구', shelterName: '가나시 동물보호센터', status: 'protected', dDay: 9, sex: 'female', ageText: '2024년생', foundPlace: '다라동 골목', noticeNo: '가나-가나-2026-00001', address: '가나시 다라구 마바로 1', phone: '000-0000-0000', noticePeriod: '10.20 ~ 11.05', notes: '줄무늬 꼬리', images: [mockPhoto(0, 800, 1000), mockPhoto(2, 1000, 750), mockPhoto(4, 800, 1200)] },
    { id: 'a2', region: '마바시 사아구', shelterName: '마바시 동물보호센터', status: 'protected', dDay: 2, sex: 'male', ageText: '2026년생 · 60일 미만', foundPlace: '사아동 공원', noticeNo: '마바-사아-2026-00002', address: '마바시 사아구 자차로 2', phone: '000-0000-0000', noticePeriod: '10.17 ~ 10.29', images: [mockPhoto(1, 900, 900), mockPhoto(3, 800, 1000)] },
    { id: 'a3', region: '자차시 카타구', shelterName: '자차 동물사랑센터', status: 'protected', dDay: 14, sex: 'male', ageText: '2023년생', foundPlace: '카타동 시장 앞', noticeNo: '자차-카타-2026-00003', address: '자차시 카타구 파하로 3', noticePeriod: '10.25 ~ 11.10', images: [mockPhoto(2, 1000, 700), mockPhoto(6, 800, 1000)] },
    { id: 'a4', region: '파하시 가나구', foundPlace: '가나동 아파트 단지', status: 'protected', dDay: 1, sex: 'female', ageText: '2026년생 · 60일 미만', noticeNo: '파하-가나-2026-00004', noticePeriod: '10.16 ~ 10.28', images: [mockPhoto(3, 800, 1100)] },
    { id: 'a5', region: '가나시 마바구', shelterName: '가나 마바 보호소', status: 'protected', dDay: 0, sex: 'unknown', foundPlace: '마바동 대학가', phone: '보호소 문의', noticePeriod: '10.13 ~ 10.27', images: [mockPhoto(4, 700, 1000), mockPhoto(5, 1000, 800)] },
    { id: 'a6', region: '다라시 사아구', shelterName: '다라시 동물보호센터', status: 'ended', result: '입양', endReason: '입양 완료', dDay: 0, sex: 'female', ageText: '2022년생', foundPlace: '사아동 주택가', noticeNo: '다라-사아-2026-00006', address: '다라시 사아구 가나로 6', phone: '000-0000-0000', noticePeriod: '10.01 ~ 10.14', notes: '온순함', images: [mockPhoto(5, 900, 1100)] },
    { id: 'a7', region: '사아시 자차구', shelterName: '사아시 동물보호센터', status: 'protected', dDay: 11, sex: 'male', ageText: '2024년생', foundPlace: '자차동 공원', noticeNo: '사아-자차-2026-00007', noticePeriod: '10.22 ~ 11.07', images: [mockPhoto(6, 800, 800), mockPhoto(7, 800, 1000)] },
    { id: 'a8', region: '카타시 파하구', shelterName: '카타 동물보호센터', status: 'ended', dDay: 0, sex: 'unknown', foundPlace: '파하동 해안도로', noticePeriod: '09.28 ~ 10.11', images: [mockPhoto(7, 1000, 1000)] }
  ];

  window.CatNotice = {
    SERVICE_NAME: SERVICE_NAME, SERVICE_TAGLINE: SERVICE_TAGLINE, MOCK_ANIMALS: MOCK_ANIMALS, mockPhoto: mockPhoto, badgeVariant: badgeVariant,
    Icon: Icon, Button: Button, ShareButton: ShareButton, FavoriteButton: FavoriteButton, StatusBadge: StatusBadge, AnimalCard: AnimalCard,
    Chip: Chip, Segmented: Segmented, Radio: Radio, Select: Select, BottomSheet: BottomSheet, SkeletonCard: SkeletonCard, Toast: Toast,
    FilterButton: FilterButton, DetailInfo: DetailInfo, badgeText: badgeText, detailRows: detailRows,
    DeadlineText: DeadlineText, ShelterInfo: ShelterInfo, shelterRows: shelterRows, cardDeadlineText: cardDeadlineText,
    detailDeadlineText: detailDeadlineText, sexAgeText: sexAgeText,
    Logo: Logo, logoVariant: logoVariant
  };
})();
