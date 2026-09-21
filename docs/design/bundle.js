/* @ds-bundle: {"format":4,"namespace":"CatNotice","components":[{"name":"Icon"},{"name":"Button"},{"name":"ShareButton"},{"name":"FavoriteButton"},{"name":"StatusBadge"},{"name":"AnimalCard"},{"name":"Chip"},{"name":"Segmented"},{"name":"Radio"},{"name":"Select"},{"name":"BottomSheet"},{"name":"SkeletonCard"},{"name":"Toast"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var cx = function () { return Array.prototype.filter.call(arguments, Boolean).join(' '); };

  /* One place to rename the service. Working name, name not decided yet. */
  var SERVICE_NAME = '냥공고';

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

  /* Stroke icons, 1.8px, currentColor. Names: heart, filter, close, back, chevron-down. */
  function Icon(p) {
    var s = p.size || 22, n = p.name;
    var P = function (d) { return h('path', { d: d }); };
    var body = n === 'heart' ? P('M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z')
      : n === 'filter' ? [P('M4 7h9'), P('M19 7h1'), h('circle', { cx: 16, cy: 7, r: 2.2 }), P('M4 17h1'), P('M11 17h9'), h('circle', { cx: 8, cy: 17, r: 2.2 })]
      : n === 'close' ? P('M6 6l12 12M18 6L6 18')
      : n === 'back' ? P('M15 5l-7 7 7 7')
      : n === 'chevron-down' ? P('M6 9l6 6 6-6') : null;
    return h('svg', { width: s, height: s, viewBox: '0 0 24 24', 'aria-hidden': true, fill: p.filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block', flex: 'none' } }, body);
  }

  function Button(p) {
    return h('button', { type: p.type || 'button', className: cx('cn-btn card-title', 'cn-btn--' + (p.variant || 'primary'), p.block && 'cn-btn--block', p.className), disabled: p.disabled, 'aria-label': p['aria-label'] || p.ariaLabel, onClick: p.onClick }, p.children);
  }
  function ShareButton(p) {
    return h('button', { type: 'button', className: cx('cn-btn card-title cn-btn--share', p.className), disabled: p.disabled, onClick: p.onClick }, h(ChatIcon), p.children || '카카오톡 공유');
  }
  function FavoriteButton(p) {
    var on = !!p.active;
    return h('button', { type: 'button', className: cx('cn-btn cn-btn--fav', p.className), disabled: p.disabled, 'aria-pressed': on, 'aria-label': on ? '찜 해제' : '찜하기', onClick: function () { if (p.onToggle) p.onToggle(!on); } }, h(Heart, { filled: on }));
  }

  /* variant: protected | soon | ended.  dDay: number | undefined */
  function badgeText(variant, dDay) {
    if (variant === 'ended') return '종료';
    var d = dDay === 0 ? 'D-day' : (typeof dDay === 'number' ? 'D-' + dDay : '');
    return (variant === 'soon' ? '임박' : '보호중') + (d ? ' · ' + d : '');
  }
  function StatusBadge(p) {
    return h('span', { className: cx('cn-badge badge', 'cn-badge--' + p.variant, p.onPhoto && 'cn-badge--photo', p.className) }, h('i'), badgeText(p.variant, p.dDay));
  }
  /* Domain to badge variant. protected within 3 days is soon. */
  function badgeVariant(a) { return a.status === 'ended' ? 'ended' : (a.dDay <= 3 ? 'soon' : 'protected'); }

  /* animal: Domain model only. { id, name?, region, shelterName, status, dDay, images[] } */
  function AnimalCard(p) {
    var a = p.animal, ended = a.status === 'ended';
    var v = badgeVariant(a);
    var Tag = p.href ? 'a' : 'button';
    var props = { className: cx('cn-card', ended && 'cn-card--ended', p.className), onClick: p.onClick };
    if (p.href) props.href = p.href; else props.type = 'button';
    return h(Tag, props,
      h('div', { className: 'cn-card__photo' },
        a.images && a.images[0] ? h('img', { src: a.images[0], alt: '', loading: p.priority ? 'eager' : 'lazy' }) : null,
        h('div', { className: 'cn-card__badge' }, h(StatusBadge, { variant: v, dDay: ended ? undefined : a.dDay, onPhoto: true }))),
      h('div', { className: 'cn-card__text' },
        h('p', { className: 'cn-card__name card-title' }, a.name || a.region),
        h('p', { className: 'cn-card__sub body' }, a.region + ' · ' + a.shelterName)));
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

  /* Absolute inside .cn-column (position:relative), never fixed to the viewport. */
  function BottomSheet(p) {
    return h('div', { className: 'cn-sheet-wrap', 'data-open': !!p.open },
      h('div', { className: 'cn-sheet-dim', onClick: p.onClose }),
      h('div', { className: 'cn-sheet', role: 'dialog', 'aria-modal': true, 'aria-label': p.title, 'aria-hidden': !p.open },
        h('button', { type: 'button', className: 'cn-sheet__handle-hit', 'aria-label': '닫기', onClick: p.onClose }, h('div', { className: 'cn-sheet__handle' })),
        p.title ? h('h2', { className: 'cn-sheet__title card-title' }, p.title) : null,
        p.children,
        p.footer));
  }
  function SkeletonCard(p) {
    return h('div', { className: cx('cn-skel', p.className), 'aria-hidden': true },
      h('div', { className: 'cn-skel__photo' }), h('div', { className: 'cn-skel__line' }), h('div', { className: 'cn-skel__line' }));
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

  /* Domain-shaped mock data. Not DTOs. */
  var MOCK_ANIMALS = [
    { id: 'a1', name: '나비', region: '서울 강남구', shelterName: '강남구 유기동물보호센터', status: 'protected', dDay: 9, sex: 'female', ageEstimate: '2살 추정', foundPlace: '역삼동 골목', noticePeriod: '09.12 ~ 09.30', images: [mockPhoto(0, 800, 1000), mockPhoto(2, 1000, 750), mockPhoto(4, 800, 1200)] },
    { id: 'a2', region: '경기 수원시', shelterName: '수원시 동물보호센터', status: 'protected', dDay: 2, sex: 'male', ageEstimate: '1살 추정', foundPlace: '영통동 공원', noticePeriod: '09.09 ~ 09.23', images: [mockPhoto(1, 900, 900), mockPhoto(3, 800, 1000)] },
    { id: 'a3', name: '보리', region: '부산 해운대구', shelterName: '부산 동물사랑센터', status: 'protected', dDay: 14, sex: 'male', ageEstimate: '3살 추정', foundPlace: '우동 시장 앞', noticePeriod: '09.16 ~ 10.05', images: [mockPhoto(2, 1000, 700), mockPhoto(6, 800, 1000)] },
    { id: 'a4', region: '인천 남동구', shelterName: '인천시 동물보호센터', status: 'protected', dDay: 1, sex: 'female', ageEstimate: '6개월 추정', foundPlace: '구월동 아파트 단지', noticePeriod: '09.08 ~ 09.22', images: [mockPhoto(3, 800, 1100)] },
    { id: 'a5', name: '두부', region: '대전 유성구', shelterName: '유성구 동물보호센터', status: 'protected', dDay: 6, sex: 'unknown', ageEstimate: '나이 미상', foundPlace: '궁동 대학가', noticePeriod: '09.13 ~ 09.27', images: [mockPhoto(4, 700, 1000), mockPhoto(5, 1000, 800)] },
    { id: 'a6', name: '모모', region: '대구 수성구', shelterName: '대구 동물보호센터', status: 'ended', dDay: 0, sex: 'female', ageEstimate: '4살 추정', foundPlace: '범어동 주택가', noticePeriod: '09.01 ~ 09.14', images: [mockPhoto(5, 900, 1100)] },
    { id: 'a7', region: '광주 북구', shelterName: '광주 동물보호센터', status: 'protected', dDay: 11, sex: 'male', ageEstimate: '2살 추정', foundPlace: '용봉동 공원', noticePeriod: '09.17 ~ 10.02', images: [mockPhoto(6, 800, 800), mockPhoto(7, 800, 1000)] },
    { id: 'a8', region: '제주 제주시', shelterName: '제주 동물보호센터', status: 'ended', dDay: 0, sex: 'unknown', ageEstimate: '1살 추정', foundPlace: '연동 해안도로', noticePeriod: '08.28 ~ 09.11', images: [mockPhoto(7, 1000, 1000)] }
  ];

  window.CatNotice = {
    SERVICE_NAME: SERVICE_NAME, MOCK_ANIMALS: MOCK_ANIMALS, mockPhoto: mockPhoto, badgeVariant: badgeVariant,
    Icon: Icon, Button: Button, ShareButton: ShareButton, FavoriteButton: FavoriteButton, StatusBadge: StatusBadge, AnimalCard: AnimalCard,
    Chip: Chip, Segmented: Segmented, Radio: Radio, Select: Select, BottomSheet: BottomSheet, SkeletonCard: SkeletonCard, Toast: Toast
  };
})();
