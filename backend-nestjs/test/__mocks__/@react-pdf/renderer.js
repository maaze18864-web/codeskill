module.exports = {
  renderToStream: jest.fn().mockResolvedValue({
    pipe: jest.fn((res) => res.end('mock-pdf-stream')),
  }),
  StyleSheet: {
    create: (styles) => styles,
  },
  Font: {
    register: jest.fn(),
  },
  Document: () => null,
  Page: () => null,
  Text: () => null,
  View: () => null,
  Image: () => null,
  Svg: () => null,
  Path: () => null,
  Circle: () => null,
  Rect: () => null,
  G: () => null,
  Line: () => null,
};
