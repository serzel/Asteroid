import { UI_ACTION } from "./UIActionTypes.js";

export function pointInRect(mx, my, rect) {
  return mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h;
}

export function mouseToCanvas(pointerTransform, e) {
  const mx = (e.clientX - pointerTransform.left) * pointerTransform.scaleX;
  const my = (e.clientY - pointerTransform.top) * pointerTransform.scaleY;
  return { mx, my };
}

export function getHoveredButtonId(state, mx, my, titleButtons, menuButton, gameState) {
  if (state === gameState.TITLE) {
    for (const button of titleButtons) {
      if (pointInRect(mx, my, button)) {
        return button.id;
      }
    }
  } else if (state === gameState.GAME_OVER_READY) {
    if (pointInRect(mx, my, menuButton)) return menuButton.id;
  }

  return null;
}

export function resolvePointerDownAction(state, mx, my, titleButtons, menuButton, gameState) {
  if (state === gameState.TITLE) {
    for (const button of titleButtons) {
      if (pointInRect(mx, my, button)) {
        return { type: UI_ACTION.START_GAME, difficulty: button.id };
      }
    }
  }

  if (state === gameState.GAME_OVER_READY && pointInRect(mx, my, menuButton)) {
    return { type: UI_ACTION.GO_TO_MENU };
  }

  return null;
}
