const INNER = {
  viewport: { width: 2176, height: 1812 },
  deviceScaleFactor: 2.63,
  isMobile: true,
  hasTouch: true,
};

const COVER = {
  viewport: { width: 2316, height: 904 },
  deviceScaleFactor: 2.63,
  isMobile: true,
  hasTouch: true,
};

function getViewport(name) {
  return name === 'inner' ? INNER : COVER;
}

module.exports = { INNER, COVER, getViewport };