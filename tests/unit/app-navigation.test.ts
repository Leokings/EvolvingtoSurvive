import {describe, expect, it} from "vitest";

import {readAppView, urlForAppView} from "../../src/app-navigation";

describe("app navigation", () => {
  it("treats the existing lobby URL as Home", () => {
    expect(readAppView("?demo=1&view=lobby")).toBe("home");
    expect(readAppView("?view=how-to-play")).toBe("guide");
    expect(readAppView("?demo=1", "/how-to-play")).toBe("guide");
    expect(readAppView("?phase=plan")).toBe("play");
  });

  it("preserves simulation and phase parameters while changing screens", () => {
    expect(urlForAppView("https://example.test/?demo=1&phase=plan", "guide"))
      .toBe("/how-to-play?demo=1&phase=plan");
    expect(urlForAppView("https://example.test/?demo=1&phase=plan&view=home", "play"))
      .toBe("/?demo=1&phase=plan");
    expect(urlForAppView("https://example.test/how-to-play?demo=1&phase=plan", "home"))
      .toBe("/?demo=1&phase=plan&view=home");
  });
});
