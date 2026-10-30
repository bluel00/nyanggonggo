import type { ComponentType, CSSProperties } from "react";
import { ANIMAL_COPY } from "./labels";
import type { CharacterSpecies } from "./species-character";

/**
 * 로딩 캐릭터(handoff (j) L2·L5, characters.md "로딩이 늦을 때", bundle.css .cn-skel__wait). 고양이·강아지 목록 첫 페이지 뼈대의
 * 첫 카드 사진 자리 가운데에 그 축종 캐릭터(정면 앉음, 96px)와 "공고를 불러오고 있어요"(body, text-2, 10px 아래)를 둔다.
 *
 * 언제 보일지는 CSS가 정한다(app/globals.css `data-loading-wait`): 뼈대와 함께 그려 두고 loading-character-delay(500ms) 동안 숨겼다가
 * loading-character-fade(200ms)로 나타난다. 목록 첫 페이지 뼈대는 서버 스트리밍 fallback이라 하이드레이션 전에도 같아야 해서
 * JS 타이머를 쓰지 않는다. 공고가 오면 뼈대와 함께 빠진다(붙잡아 두지 않음).
 *
 * 그림은 Rive가 아니라 인라인 SVG + CSS다(런타임을 받지 않으려고). 그림은 앱 사본(`public/characters/nyang-{cat,dog}.svg`)과 같고
 * 움직일 그룹을 `data-loading-motion` 그룹으로 감싼 것만 다르다. id는 문서 안에서 겹치지 않게 뺐다. 같은지는
 * `tests/design/characters-sync.test.ts`가 본다. 움직임: 숨쉬기(바닥 가운데 60,112 기준), 깜빡임(뜬 눈 가운데 기준 세로로 접힘),
 * 꼬리(꼬리 그룹 원점 = 뿌리 기준 회전). 움직임 줄이기면 정지 그림이다. 그림은 aria-hidden이고 뜻은 문구가 전한다.
 */
export function LoadingCharacter({ species }: { species: CharacterSpecies }) {
  const Drawing = DRAWINGS[species];
  return (
    <div data-slot="loading-character" data-loading-wait="" data-species={species} className="flex flex-col items-center gap-2.5">
      <svg aria-hidden viewBox="0 0 120 120" width="96" height="96" className="size-24">
        <Drawing />
      </svg>
      <p className="text-body text-text-2">{ANIMAL_COPY.listLoading}</p>
    </div>
  );
}

/** 감싼 그룹의 기준점(그 그룹 좌표) */
const origin = (x: number, y: number): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });

function CatDrawing() {
  return (
    <g data-loading-motion="breathe" style={origin(60, 112)}>
      <g transform="translate(60 112)">
        <g transform="translate(26 -6)">
          <g data-loading-motion="tail" style={origin(0, 0)}>
            <path d="M-4 -3C8 -2 17 -8 17 -19C17 -26 13 -30 9 -29C6 -28 6 -25 8 -23C11 -19 10 -13 6 -10C3 -8 -1 -8 -4 -9Z" fill="#A38D74" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M7.6 -8.8L8.2 -6.2M10.4 -12.6L14 -12.2M10.6 -21L15.4 -20.4" fill="none" stroke="#4A3E34" strokeWidth="2.6" strokeLinecap="round" />
          </g>
        </g>
        <g>
          <path d="M-26 0C-30 0 -32 -6 -30 -14C-27 -28 -20 -40 0 -40C20 -40 27 -28 30 -14C32 -6 30 0 26 0Z" fill="#A38D74" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M-26 -24.5C-23 -25.5 -20 -25 -17 -22.5C-20 -22.6 -23 -22.2 -25.6 -21.4ZM-29 -15.5C-25 -16.8 -21 -16.2 -18 -13.6C-21 -13.6 -25 -13 -29 -12.2ZM-29.8 -7C-26 -8 -22 -7.4 -19 -5.2C-22 -5.2 -26 -4.6 -29.8 -3.8ZM26 -24.5C23 -25.5 20 -25 17 -22.5C20 -22.6 23 -22.2 25.6 -21.4ZM29 -15.5C25 -16.8 21 -16.2 18 -13.6C21 -13.6 25 -13 29 -12.2ZM29.8 -7C26 -8 22 -7.4 19 -5.2C22 -5.2 26 -4.6 29.8 -3.8Z" fill="#4A3E34" />
          <path d="M-12 -22C-12 -31 -6 -36 0 -36C6 -36 12 -31 12 -22C12 -12 7 -4 0 -4C-7 -4 -12 -12 -12 -22Z" fill="#FFFFFF" />
        </g>
        <g transform="translate(-7 -22)">
          <path d="M-3.5 0A3.5 3.5 0 0 1 3.5 0A3.5 3.5 0 0 1 -3.5 0ZM-3 0L3 0L3 13.5L-1 13.5Z" fill="#FFFFFF" />
          <path d="M-7 22C-7 16 -4 13 -0.5 13C3 13 6 16 6 22Z" fill="#FFFFFF" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
        </g>
        <g transform="translate(7 -22)">
          <path d="M-3.5 0A3.5 3.5 0 0 1 3.5 0A3.5 3.5 0 0 1 -3.5 0ZM-3 0L3 0L1 13.5L-3 13.5Z" fill="#FFFFFF" />
          <path d="M-6 22C-6 16 -3 13 0.5 13C4 13 7 16 7 22Z" fill="#FFFFFF" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
        </g>
        <g transform="translate(0 -38)">
          <g transform="translate(-15 -34)">
            <path d="M-9 2L-6 -13Q-5 -17 -2 -14L9 2Z" fill="#A38D74" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M-5 0L-4 -8L3 0Z" fill="#D9B3A6" />
          </g>
          <g transform="translate(15 -34)">
            <path d="M9 2L6 -13Q5 -17 2 -14L-9 2Z" fill="#A38D74" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M5 0L4 -8L-3 0Z" fill="#D9B3A6" />
          </g>
          <path d="M-26 -20C-26 -34 -15 -42 0 -42C15 -42 26 -34 26 -20C26 -8 15 -2 0 -2C-15 -2 -26 -8 -26 -20Z" fill="#A38D74" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M-1.2 -41L1.2 -41L0.8 -32Q0 -31 -0.8 -32ZM-6.5 -40.5L-4.2 -41L-3.2 -33.5Q-4 -32.8 -4.6 -33.6ZM6.5 -40.5L4.2 -41L3.2 -33.5Q4 -32.8 4.6 -33.6ZM-11 -38.5L-9 -39.5L-7.6 -34.5Q-8.4 -34 -9 -34.6ZM11 -38.5L9 -39.5L7.6 -34.5Q8.4 -34 9 -34.6ZM-25 -22L-19.5 -20.8L-25 -19.6ZM-25 -17.4L-20 -16.6L-24.8 -15.4ZM25 -22L19.5 -20.8L25 -19.6ZM25 -17.4L20 -16.6L24.8 -15.4Z" fill="#4A3E34" />
          <path d="M-9 -11C-9 -15.5 -5 -17 0 -14.5C5 -17 9 -15.5 9 -11C9 -6 5 -3 0 -3C-5 -3 -9 -6 -9 -11Z" fill="#FFFFFF" />
          <path d="M-21 -13a3.5 2.2 0 1 0 7 0a3.5 2.2 0 1 0 -7 0ZM14 -13a3.5 2.2 0 1 0 7 0a3.5 2.2 0 1 0 -7 0Z" fill="#D7AE9F" />
          <g data-loading-motion="blink" style={origin(0, -22)}>
            <g transform="translate(0 -22)">
              <path d="M-12.6 0a2.6 3.2 0 1 0 5.2 0a2.6 3.2 0 1 0 -5.2 0ZM7.4 0a2.6 3.2 0 1 0 5.2 0a2.6 3.2 0 1 0 -5.2 0Z" fill="#111111" />
            </g>
          </g>
          <g transform="translate(0 -22)" opacity="0">
            <path d="M-13 -0.5Q-10 2.5 -7 -0.5M7 -0.5Q10 2.5 13 -0.5" fill="none" stroke="#3A2A20" strokeWidth="1.8" strokeLinecap="round" />
          </g>
          <g transform="translate(0 -22)" opacity="0">
            <path d="M-13 1Q-10 -2.5 -7 1M7 1Q10 -2.5 13 1" fill="none" stroke="#3A2A20" strokeWidth="1.8" strokeLinecap="round" />
          </g>
          <path d="M-2.8 -15.6Q0 -16.4 2.8 -15.6Q1.2 -12.6 0 -12.6Q-1.2 -12.6 -2.8 -15.6Z" fill="#C48B7D" />
          <path d="M0 -12.6V-11M-4 -10.6Q-2 -8.6 0 -11Q2 -8.6 4 -10.6" fill="none" stroke="#3A2A20" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g transform="translate(0 -36)">
          <path d="M-1.5 0C-5 -4 -11 -6.5 -12.5 -3.5C-13.5 -1 -13.5 2 -12.5 4.5C-11 7.5 -5 5 -1.5 1ZM1.5 0C5 -4 11 -6.5 12.5 -3.5C13.5 -1 13.5 2 12.5 4.5C11 7.5 5 5 1.5 1Z" fill="#9C3548" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M-9.5 -2.9l1.3 1.3l-1.3 1.3l-1.3 -1.3ZM-9.5 1.3l1.3 1.3l-1.3 1.3l-1.3 -1.3ZM-6 -0.7l1.3 1.3l-1.3 1.3l-1.3 -1.3ZM9.5 -2.9l1.3 1.3l-1.3 1.3l-1.3 -1.3ZM9.5 1.3l1.3 1.3l-1.3 1.3l-1.3 -1.3ZM6 -0.7l1.3 1.3l-1.3 1.3l-1.3 -1.3Z" fill="#FFFFFF" />
          <path d="M-2.6 -2.8H2.6Q3.6 -2.8 3.6 -1.8V2.2Q3.6 3.2 2.6 3.2H-2.6Q-3.6 3.2 -3.6 2.2V-1.8Q-3.6 -2.8 -2.6 -2.8Z" fill="#9C3548" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
        </g>
      </g>
    </g>
  );
}

function DogDrawing() {
  return (
    <g data-loading-motion="breathe" style={origin(60, 112)}>
      <g transform="translate(60 112)">
        <g transform="translate(24 -8)">
          <g data-loading-motion="tail" style={origin(0, 0)}>
            <path d="M-3 -2C5 -3 10 -9 12 -18C13 -22 9 -24 7 -20C5 -13 1 -9 -4 -7Z" fill="#D9C8B2" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
          </g>
        </g>
        <g>
          <path d="M-26 0C-30 0 -32 -6 -30 -14C-27 -28 -20 -40 0 -40C20 -40 27 -28 30 -14C32 -6 30 0 26 0Z" fill="#D9C8B2" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M-11 -20C-11 -29 -6 -34 0 -34C6 -34 11 -29 11 -20C11 -11 6 -5 0 -5C-6 -5 -11 -11 -11 -20Z" fill="#F7F3EE" />
        </g>
        <g transform="translate(-8 -20)">
          <path d="M0 19V12" fill="none" stroke="#3A2A20" strokeWidth="1.8" strokeLinecap="round" />
        </g>
        <g transform="translate(8 -20)">
          <path d="M0 19V12" fill="none" stroke="#3A2A20" strokeWidth="1.8" strokeLinecap="round" />
        </g>
        <g transform="translate(0 -38)">
          <path d="M-25 -21C-25 -35 -14 -43 0 -43C14 -43 25 -35 25 -21C25 -8 14 -2 0 -2C-14 -2 -25 -8 -25 -21Z" fill="#D9C8B2" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M3 -25a7 6.5 0 1 0 14 0a7 6.5 0 1 0 -14 0Z" fill="#BFA88E" />
          <path d="M-10 -12a10 7.5 0 1 0 20 0a10 7.5 0 1 0 -20 0Z" fill="#F7F3EE" />
          <path d="M-19 -12a3.5 2.2 0 1 0 7 0a3.5 2.2 0 1 0 -7 0ZM12 -12a3.5 2.2 0 1 0 7 0a3.5 2.2 0 1 0 -7 0Z" fill="#EBD7CA" />
          <g transform="translate(-20 -36)">
            <path d="M3 -3C-5 -5 -12 1 -12 11C-12 19 -8 23 -4 21C0 19 4 10 4 2Z" fill="#A68F76" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
          </g>
          <g transform="translate(20 -36)">
            <path d="M-3 -3C5 -5 12 1 12 11C12 19 8 23 4 21C0 19 -4 10 -4 2Z" fill="#A68F76" stroke="#3A2A20" strokeWidth="1.8" strokeLinejoin="round" />
          </g>
          <g data-loading-motion="blink" style={origin(0, -25)}>
            <g transform="translate(0 -25)">
              <path d="M-12.6 0a2.6 3.2 0 1 0 5.2 0a2.6 3.2 0 1 0 -5.2 0ZM7.4 0a2.6 3.2 0 1 0 5.2 0a2.6 3.2 0 1 0 -5.2 0Z" fill="#111111" />
            </g>
          </g>
          <g transform="translate(0 -25)" opacity="0">
            <path d="M-13 -0.5Q-10 2.5 -7 -0.5M7 -0.5Q10 2.5 13 -0.5" fill="none" stroke="#3A2A20" strokeWidth="1.8" strokeLinecap="round" />
          </g>
          <g transform="translate(0 -25)" opacity="0">
            <path d="M-13 1Q-10 -2.5 -7 1M7 1Q10 -2.5 13 1" fill="none" stroke="#3A2A20" strokeWidth="1.8" strokeLinecap="round" />
          </g>
          <path d="M-4.2 -16.5C-4.2 -19 4.2 -19 4.2 -16.5C4.2 -14.4 1.6 -13 0 -13C-1.6 -13 -4.2 -14.4 -4.2 -16.5Z" fill="#111111" />
          <path d="M0 -13V-10.5M-4.5 -9.5Q-2 -7.5 0 -10.5Q2 -7.5 4.5 -9.5" fill="none" stroke="#3A2A20" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </g>
  );
}

const DRAWINGS: Record<CharacterSpecies, ComponentType> = { cat: CatDrawing, dog: DogDrawing };
