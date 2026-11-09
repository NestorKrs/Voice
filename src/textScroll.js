// Chrome/Brave do not scroll a textarea to a programmatic selection, so the
// find box measures the text in a hidden mirror div and sets scrollTop by hand.

export function scrollTextareaToIndex(ta, index) {
  const css = getComputedStyle(ta);
  const div = document.createElement('div');
  const copy = {
    fontFamily: css.fontFamily,
    fontSize: css.fontSize,
    fontWeight: css.fontWeight,
    fontStyle: css.fontStyle,
    letterSpacing: css.letterSpacing,
    lineHeight: css.lineHeight,
    textTransform: css.textTransform,
    wordSpacing: css.wordSpacing,
    textIndent: css.textIndent,
    tabSize: css.tabSize,
    paddingTop: css.paddingTop,
    paddingRight: css.paddingRight,
    paddingBottom: css.paddingBottom,
    paddingLeft: css.paddingLeft,
    borderTopWidth: css.borderTopWidth,
    borderRightWidth: css.borderRightWidth,
    borderBottomWidth: css.borderBottomWidth,
    borderLeftWidth: css.borderLeftWidth,
    boxSizing: css.boxSizing,
  };
  for (const prop in copy) div.style[prop] = copy[prop];
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.top = '-99999px';
  div.style.left = '-99999px';
  div.style.width = ta.clientWidth + 'px';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.overflowWrap = 'break-word';
  // No border-style: the mirror must wrap like the textarea's content box.
  div.textContent = ta.value.slice(0, index);
  const span = document.createElement('span');
  span.textContent = '.';
  div.appendChild(span);
  document.body.appendChild(div);
  let y = 0;
  try {
    y = span.offsetTop;
  } finally {
    div.remove();
  }
  ta.scrollTop = Math.max(0, y - Math.round(ta.clientHeight / 2));
  return { y, scrollHeight: ta.scrollHeight, clientHeight: ta.clientHeight };
}
