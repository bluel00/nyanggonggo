`FavoriteButton` is the neutral 관심 공고 toggle (in the app: `features/animal-favorite`). Consumer provides `active` and `onToggle(next)`; it sets `aria-pressed` and the Korean aria-label "관심 공고에 담기" / "관심 공고에서 빼기". Toasts: "관심 공고에 담았어요" / "관심 공고에서 뺐어요". Active fills the heart with `text`, never a colour. 관심 공고 stores ids only.

- **Detail CTA bar** (default): a 44x44 `surface` pill with `shadow-control` and no outline, heart icon in `text`. Favourite and share stay active on ended notices too.
- **On a card photo** (`onPhoto`): the form the list and 관심 공고 widgets put into `AnimalCard`'s `action` slot, at the photo's top-right. A 40px `photo-pill` circle inside a 44px hit area. Turning on fills at once and pops 1 → `heart-scale` 1.2 (at 45%) → 1 over `heart-duration` with `ease-heart` on each half, inside the circle, which keeps its size; turning off fades the fill over `heart-off-duration`. On ended cards (`calm`) it only toggles the fill.
- The list header heart is a plain `icon` Button linking to /favorites, named "관심 공고".
- Reduced motion: fill only.
