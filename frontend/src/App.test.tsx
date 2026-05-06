import { expect, it } from "vitest";
import { App } from "./App";

it("renders the app shell", () => {
  const element = App();
  expect(element.props.className).toBe("app-shell");
  expect(element.props.children).toBe("2Design");
});
